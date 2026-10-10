from __future__ import annotations

import os
import re
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Type
from pydantic import ValidationError, TypeAdapter

from ruamel.yaml import YAML

from hrnx.models.base import NodeType, SourceLocation
from hrnx.models.schema import (
    ADR,
    ContextSlice,
    Directive,
    EvalSpec,
    HarnessNode,
    Skill,
    ToolSpec,
)


class BodyReference:
    """Represents an embedded reference to another node found inside the markdown body."""
    def __init__(
        self,
        target_id: str,
        line: int,
        col_start: int,
        col_end: int,
        raw_text: str,
    ):
        self.target_id = target_id
        self.line = line  # 1-indexed relative to entire document
        self.col_start = col_start  # 1-indexed
        self.col_end = col_end  # 1-indexed
        self.raw_text = raw_text

    def __repr__(self) -> str:
        return f"<BodyReference target={self.target_id} line={self.line}:{self.col_start}>"


class ParseDiagnostic:
    """Diagnostic reporting a parse, syntax, or validation error with precise location."""
    def __init__(
        self,
        message: str,
        line: int = 1,
        column: int = 1,
        severity: str = "error",
        source: str = "hrnx-parser",
    ):
        self.message = message
        self.line = line
        self.column = column
        self.severity = severity
        self.source = source

    def __repr__(self) -> str:
        return f"[{self.severity.upper()}] Line {self.line}:{self.column} - {self.message}"


class ParsedDocument:
    """Encapsulates a parsed HRNX node file, its frontmatter, body AST, and diagnostics."""
    def __init__(
        self,
        node: Optional[HarnessNode],
        frontmatter_raw: str,
        frontmatter_data: Dict[str, Any],
        body_raw: str,
        frontmatter_lines: int,
        file_path: Optional[str] = None,
        diagnostics: Optional[List[ParseDiagnostic]] = None,
        body_references: Optional[List[BodyReference]] = None,
    ):
        self.node = node
        self.frontmatter_raw = frontmatter_raw
        self.frontmatter_data = frontmatter_data
        self.body_raw = body_raw
        self.frontmatter_lines = frontmatter_lines
        self.file_path = file_path
        self.diagnostics = diagnostics or []
        self.body_references = body_references or []

    @property
    def is_valid(self) -> bool:
        return self.node is not None and len([d for d in self.diagnostics if d.severity == "error"]) == 0


# Pre-compiled regex patterns for body cross-references
REF_PATTERNS = [
    # Explicit @ref:dir.auth.tokens or @ref:ADR-001
    re.compile(r"@ref:([A-Za-z0-9_.-]+)"),
    # Shorthand typed refs: @dir.auth.tokens, @skill.db.migrate, @tool.bash, @eval.auth.test
    re.compile(r"@(dir\.[A-Za-z0-9_.-]+|skill\.[A-Za-z0-9_.-]+|tool\.[A-Za-z0-9_.-]+|eval\.[A-Za-z0-9_.-]+|ctx\.[A-Za-z0-9_.-]+)"),
    # ADR patterns like ADR-001 or ADR-123
    re.compile(r"\b(ADR-[0-9]{3,4})\b"),
    # Markdown links like [tokens](dir.auth.tokens)
    re.compile(r"\[[^\]]+\]\(((?:dir|skill|tool|eval|ctx)\.[A-Za-z0-9_.-]+|ADR-[0-9]+)\)"),
]

NODE_TYPE_MAP: Dict[str, Type[HarnessNode]] = {
    NodeType.DIRECTIVE: Directive,
    NodeType.SKILL: Skill,
    NodeType.TOOL: ToolSpec,
    NodeType.CONTEXT_SLICE: ContextSlice,
    NodeType.EVAL: EvalSpec,
    NodeType.ADR: ADR,
}


class FrontmatterParser:
    """Bi-directional parser and serializer for .hrnx files."""

    def __init__(self):
        self.yaml = YAML()
        self.yaml.preserve_quotes = True
        self.yaml.indent(mapping=2, sequence=4, offset=2)

    def extract_frontmatter(self, text: str) -> Tuple[str, str, int]:
        """
        Splits markdown into (raw_frontmatter, body, frontmatter_line_count).
        Handles CRLF and LF transparently.
        """
        lines = text.splitlines(keepends=True)
        if not lines:
            return "", "", 0

        first_line = lines[0].strip()
        if first_line != "---":
            return "", text, 0

        end_idx = -1
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end_idx = i
                break

        if end_idx == -1:
            # Unterminated frontmatter
            return "", text, 0

        fm_raw = "".join(lines[1:end_idx])
        body_raw = "".join(lines[end_idx + 1:])
        frontmatter_lines = end_idx + 1  # 1-indexed count of header lines including both ---

        return fm_raw, body_raw, frontmatter_lines

    def find_body_references(self, body_text: str, line_offset: int) -> List[BodyReference]:
        """Finds cross references in the markdown body with line & column locations."""
        refs: List[BodyReference] = []
        lines = body_text.splitlines()

        for line_idx, line in enumerate(lines):
            abs_line_num = line_offset + line_idx + 1  # 1-indexed line in file

            for pattern in REF_PATTERNS:
                for match in pattern.finditer(line):
                    target_id = match.group(1)
                    col_start = match.start(1) + 1  # 1-indexed column of the identifier
                    col_end = match.end(1) + 1
                    raw_text = match.group(0)

                    refs.append(
                        BodyReference(
                            target_id=target_id,
                            line=abs_line_num,
                            col_start=col_start,
                            col_end=col_end,
                            raw_text=raw_text,
                        )
                    )

        return refs

    def parse_string(self, content: str, file_path: Optional[str] = None) -> ParsedDocument:
        """Parses a markdown string containing YAML frontmatter into a ParsedDocument."""
        diagnostics: List[ParseDiagnostic] = []
        fm_raw, body_raw, fm_line_count = self.extract_frontmatter(content)

        if not fm_raw and content.startswith("---"):
            diagnostics.append(
                ParseDiagnostic(
                    message="Unterminated YAML frontmatter block (missing closing '---')",
                    line=1,
                    column=1,
                    severity="error",
                )
            )
            return ParsedDocument(
                node=None,
                frontmatter_raw="",
                frontmatter_data={},
                body_raw=content,
                frontmatter_lines=0,
                file_path=file_path,
                diagnostics=diagnostics,
            )

        fm_data: Dict[str, Any] = {}
        if fm_raw:
            try:
                loaded = self.yaml.load(fm_raw)
                if isinstance(loaded, dict):
                    fm_data = loaded
                elif loaded is None:
                    fm_data = {}
                else:
                    diagnostics.append(
                        ParseDiagnostic(
                            message="YAML frontmatter must be a key-value mapping",
                            line=2,
                            column=1,
                            severity="error",
                        )
                    )
            except Exception as e:
                line_err = getattr(e, "problem_mark", None)
                err_line = (line_err.line + 2) if line_err else 2
                err_col = (line_err.column + 1) if line_err else 1
                diagnostics.append(
                    ParseDiagnostic(
                        message=f"YAML syntax error: {str(e)}",
                        line=err_line,
                        column=err_col,
                        severity="error",
                    )
                )
                return ParsedDocument(
                    node=None,
                    frontmatter_raw=fm_raw,
                    frontmatter_data={},
                    body_raw=body_raw,
                    frontmatter_lines=fm_line_count,
                    file_path=file_path,
                    diagnostics=diagnostics,
                )

        # Infer node type from directory or ID prefix if missing
        node_type_str = fm_data.get("type")
        if not node_type_str:
            node_id = str(fm_data.get("id", ""))
            if node_id.startswith("dir."):
                node_type_str = NodeType.DIRECTIVE
            elif node_id.startswith("skill."):
                node_type_str = NodeType.SKILL
            elif node_id.startswith("tool."):
                node_type_str = NodeType.TOOL
            elif node_id.startswith("ctx."):
                node_type_str = NodeType.CONTEXT_SLICE
            elif node_id.startswith("eval."):
                node_type_str = NodeType.EVAL
            elif node_id.startswith("ADR-"):
                node_type_str = NodeType.ADR
            elif file_path:
                norm_path = file_path.replace("\\", "/")
                if "/adrs/" in norm_path:
                    node_type_str = NodeType.ADR
                elif "/evals/" in norm_path:
                    node_type_str = NodeType.EVAL
                elif "/skills/" in norm_path:
                    node_type_str = NodeType.SKILL
                elif "/tools/" in norm_path:
                    node_type_str = NodeType.TOOL
                elif "/directives/" in norm_path:
                    node_type_str = NodeType.DIRECTIVE
                elif "/context/" in norm_path:
                    node_type_str = NodeType.CONTEXT_SLICE

        if not node_type_str:
            node_type_str = NodeType.DIRECTIVE  # Default fallback

        fm_data["type"] = node_type_str
        fm_data["body"] = body_raw.strip()
        if file_path:
            fm_data["file_path"] = file_path

        # Validate against specific node schema
        model_cls = NODE_TYPE_MAP.get(node_type_str, Directive)
        node_instance: Optional[HarnessNode] = None

        try:
            node_instance = model_cls.model_validate(fm_data)
        except ValidationError as val_err:
            for err in val_err.errors():
                loc = ".".join(str(p) for p in err["loc"])
                msg = f"Schema validation error on '{loc}': {err['msg']}"
                diagnostics.append(
                    ParseDiagnostic(
                        message=msg,
                        line=2,
                        column=1,
                        severity="error",
                    )
                )

        body_refs = self.find_body_references(body_raw, line_offset=fm_line_count)

        return ParsedDocument(
            node=node_instance,
            frontmatter_raw=fm_raw,
            frontmatter_data=fm_data,
            body_raw=body_raw,
            frontmatter_lines=fm_line_count,
            file_path=file_path,
            diagnostics=diagnostics,
            body_references=body_refs,
        )

    def parse_file(self, file_path: Path | str) -> ParsedDocument:
        """Reads and parses a file from disk."""
        path_obj = Path(file_path).resolve()
        try:
            content = path_obj.read_text(encoding="utf-8")
        except Exception as e:
            diag = ParseDiagnostic(
                message=f"Failed to read file: {str(e)}",
                line=1,
                column=1,
                severity="error",
            )
            return ParsedDocument(
                node=None,
                frontmatter_raw="",
                frontmatter_data={},
                body_raw="",
                frontmatter_lines=0,
                file_path=str(path_obj),
                diagnostics=[diag],
            )

        return self.parse_string(content, file_path=str(path_obj))

    def serialize_node(self, node: HarnessNode, original_raw: Optional[str] = None) -> str:
        """
        Serializes a node into markdown with YAML frontmatter.
        Preserves original formatting and comments if original_raw is provided.
        """
        node_dict = node.model_dump(
            mode="json",
            exclude={"body", "file_path", "raw_frontmatter"},
            exclude_none=True,
        )

        yaml_stream = StringIO()
        if original_raw:
            fm_raw, _, _ = self.extract_frontmatter(original_raw)
            if fm_raw:
                try:
                    loaded = self.yaml.load(fm_raw)
                    if isinstance(loaded, dict):
                        # Merge in updated values into original round-trip data
                        for k, v in node_dict.items():
                            loaded[k] = v
                        self.yaml.dump(loaded, yaml_stream)
                        serialized_fm = yaml_stream.getvalue().strip()
                        body = node.body or ""
                        return f"---\n{serialized_fm}\n---\n\n{body}\n"
                except Exception:
                    pass

        self.yaml.dump(node_dict, yaml_stream)
        serialized_fm = yaml_stream.getvalue().strip()
        body = node.body or ""
        return f"---\n{serialized_fm}\n---\n\n{body}\n"

    def serialize_file(self, doc_or_node: ParsedDocument | HarnessNode, file_path: Path | str) -> None:
        """Writes serialized node to target file."""
        path_obj = Path(file_path).resolve()
        path_obj.parent.mkdir(parents=True, exist_ok=True)

        if isinstance(doc_or_node, ParsedDocument):
            if not doc_or_node.node:
                raise ValueError("Cannot serialize ParsedDocument without a valid node")
            content = self.serialize_node(doc_or_node.node, original_raw=doc_or_node.frontmatter_raw)
        else:
            content = self.serialize_node(doc_or_node)

        path_obj.write_text(content, encoding="utf-8")
