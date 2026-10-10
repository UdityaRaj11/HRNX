from __future__ import annotations

import difflib
import json
import re
from io import StringIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field
from ruamel.yaml import YAML

from hrnx.parser.ast import FrontmatterParser


class FieldConflict(BaseModel):
    """Represents an unresolvable semantic conflict in frontmatter properties."""
    field: str
    base_value: Any = None
    ours_value: Any = None
    theirs_value: Any = None
    resolved_value: Any = None


class SemanticMergeResult(BaseModel):
    """Result of a 3-way AST semantic merge."""
    is_clean: bool
    merged_content: str
    auto_merged_fields: List[str] = Field(default_factory=list)
    field_conflicts: List[FieldConflict] = Field(default_factory=list)
    has_body_conflict: bool = False
    merged_frontmatter: Dict[str, Any] = Field(default_factory=dict)
    merged_body: str = ""
    node_id: Optional[str] = None
    file_path: Optional[str] = None


class SemanticMergeEngine:
    """Intelligent 3-way AST merge engine for HRNX canonical harness nodes."""

    LIST_FIELDS = {"depends_on", "implements", "validated_by", "uses_tools", "tags"}

    def __init__(self):
        self.parser = FrontmatterParser()
        self.yaml = YAML()
        self.yaml.preserve_quotes = True

    def merge_strings(
        self,
        base_text: str,
        ours_text: str,
        theirs_text: str,
        file_path: Optional[str] = None,
    ) -> SemanticMergeResult:
        """Executes a 3-way semantic merge on base (ancestor), ours (local), and theirs (remote) text."""
        base_doc = self.parser.parse_string(base_text)
        ours_doc = self.parser.parse_string(ours_text)
        theirs_doc = self.parser.parse_string(theirs_text)

        base_fm = dict(base_doc.frontmatter_data)
        ours_fm = dict(ours_doc.frontmatter_data)
        theirs_fm = dict(theirs_doc.frontmatter_data)

        node_id = ours_fm.get("id") or theirs_fm.get("id") or base_fm.get("id")

        # 1. Frontmatter 3-way merge
        merged_fm, auto_fields, conflicts = self._merge_frontmatter(base_fm, ours_fm, theirs_fm)

        # 2. Markdown Body 3-way merge
        merged_body, body_has_conflict = self._merge_body(
            base_doc.body_raw, ours_doc.body_raw, theirs_doc.body_raw
        )

        is_clean = (len(conflicts) == 0) and (not body_has_conflict)

        # 3. Assemble serialized output
        merged_content = self._serialize_merged(merged_fm, merged_body, conflicts)

        return SemanticMergeResult(
            is_clean=is_clean,
            merged_content=merged_content,
            auto_merged_fields=auto_fields,
            field_conflicts=conflicts,
            has_body_conflict=body_has_conflict,
            merged_frontmatter=merged_fm,
            merged_body=merged_body,
            node_id=node_id,
            file_path=file_path,
        )

    def merge_files(
        self,
        base_path: Path | str,
        ours_path: Path | str,
        theirs_path: Path | str,
        file_path_label: Optional[str] = None,
    ) -> SemanticMergeResult:
        """Reads 3 files from disk and performs 3-way semantic merge."""
        base_text = Path(base_path).read_text(encoding="utf-8") if Path(base_path).exists() else ""
        ours_text = Path(ours_path).read_text(encoding="utf-8") if Path(ours_path).exists() else ""
        theirs_text = Path(theirs_path).read_text(encoding="utf-8") if Path(theirs_path).exists() else ""

        return self.merge_strings(
            base_text=base_text,
            ours_text=ours_text,
            theirs_text=theirs_text,
            file_path=file_path_label or str(ours_path),
        )

    def _merge_frontmatter(
        self,
        base_fm: Dict[str, Any],
        ours_fm: Dict[str, Any],
        theirs_fm: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[str], List[FieldConflict]]:
        merged: Dict[str, Any] = {}
        auto_merged: List[str] = []
        conflicts: List[FieldConflict] = []

        all_keys = set(base_fm.keys()) | set(ours_fm.keys()) | set(theirs_fm.keys())

        for key in all_keys:
            base_val = base_fm.get(key)
            ours_val = ours_fm.get(key)
            theirs_val = theirs_fm.get(key)

            # Case 1: Identical in Ours and Theirs
            if ours_val == theirs_val:
                if ours_val is not None:
                    merged[key] = ours_val
                continue

            # Case 2: Only Theirs changed (Ours matches Base)
            if ours_val == base_val:
                if theirs_val is not None:
                    merged[key] = theirs_val
                    auto_merged.append(key)
                continue

            # Case 3: Only Ours changed (Theirs matches Base)
            if theirs_val == base_val:
                if ours_val is not None:
                    merged[key] = ours_val
                    auto_merged.append(key)
                continue

            # Case 4: Both changed differently
            if key in self.LIST_FIELDS:
                # 3-Way list set merge
                merged_list = self._merge_list_field(base_val, ours_val, theirs_val)
                merged[key] = merged_list
                auto_merged.append(key)
            elif key == "targets" and (isinstance(ours_val, dict) or isinstance(theirs_val, dict)):
                # 3-Way dict merge on target profiles
                merged_targets, target_conflicts = self._merge_targets(base_val or {}, ours_val or {}, theirs_val or {})
                merged[key] = merged_targets
                if target_conflicts:
                    conflicts.extend(target_conflicts)
                else:
                    auto_merged.append(key)
            else:
                # Scalar conflict!
                conflicts.append(
                    FieldConflict(
                        field=key,
                        base_value=base_val,
                        ours_value=ours_val,
                        theirs_value=theirs_val,
                    )
                )
                # Default to Ours for in-progress output
                if ours_val is not None:
                    merged[key] = ours_val

        return merged, auto_merged, conflicts

    def _merge_list_field(
        self,
        base_val: Any,
        ours_val: Any,
        theirs_val: Any,
    ) -> List[Any]:
        """Performs set-based 3-way merge on list attributes (depends_on, implements, etc.)."""
        base_set = set(base_val) if isinstance(base_val, list) else set()
        ours_set = set(ours_val) if isinstance(ours_val, list) else set()
        theirs_set = set(theirs_val) if isinstance(theirs_val, list) else set()

        added_ours = ours_set - base_set
        added_theirs = theirs_set - base_set
        removed_ours = base_set - ours_set
        removed_theirs = base_set - theirs_set

        # Items in base that were not removed by either, plus all items added by either
        merged_set = (base_set - removed_ours - removed_theirs) | added_ours | added_theirs

        # Order items stably: existing base order first, then ours additions, then theirs additions
        result = []
        seen = set()
        for item in (base_val if isinstance(base_val, list) else []):
            if item in merged_set and item not in seen:
                result.append(item)
                seen.add(item)
        for item in (ours_val if isinstance(ours_val, list) else []):
            if item in merged_set and item not in seen:
                result.append(item)
                seen.add(item)
        for item in (theirs_val if isinstance(theirs_val, list) else []):
            if item in merged_set and item not in seen:
                result.append(item)
                seen.add(item)
        return result

    def _merge_targets(
        self,
        base_t: Dict[str, Any],
        ours_t: Dict[str, Any],
        theirs_t: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], List[FieldConflict]]:
        merged: Dict[str, Any] = {}
        conflicts: List[FieldConflict] = []
        all_targets = set(base_t.keys()) | set(ours_t.keys()) | set(theirs_t.keys())

        for target in all_targets:
            bv = base_t.get(target)
            ov = ours_t.get(target)
            tv = theirs_t.get(target)

            if ov == tv:
                if ov is not None:
                    merged[target] = ov
            elif ov == bv:
                if tv is not None:
                    merged[target] = tv
            elif tv == bv:
                if ov is not None:
                    merged[target] = ov
            else:
                conflicts.append(
                    FieldConflict(
                        field=f"targets.{target}",
                        base_value=bv,
                        ours_value=ov,
                        theirs_value=tv,
                    )
                )
                if ov is not None:
                    merged[target] = ov

        return merged, conflicts

    def _merge_body(
        self,
        base_body: str,
        ours_body: str,
        theirs_body: str,
    ) -> Tuple[str, bool]:
        """Section-aware 3-way merge on Markdown body."""
        b_clean = (base_body or "").strip()
        o_clean = (ours_body or "").strip()
        t_clean = (theirs_body or "").strip()

        if o_clean == t_clean:
            return ours_body or "", False
        if o_clean == b_clean:
            return theirs_body or "", False
        if t_clean == b_clean:
            return ours_body or "", False

        # Attempt section-based splitting by headers (# , ## , ### )
        base_sections = self._split_markdown_sections(base_body)
        ours_sections = self._split_markdown_sections(ours_body)
        theirs_sections = self._split_markdown_sections(theirs_body)

        all_headers = []
        for sec in ours_sections:
            if sec[0] not in all_headers:
                all_headers.append(sec[0])
        for sec in theirs_sections:
            if sec[0] not in all_headers:
                all_headers.append(sec[0])
        for sec in base_sections:
            if sec[0] not in all_headers:
                all_headers.append(sec[0])

        b_map = dict(base_sections)
        o_map = dict(ours_sections)
        t_map = dict(theirs_sections)

        merged_blocks: List[str] = []
        has_conflict = False

        for header in all_headers:
            b_sec = b_map.get(header)
            o_sec = o_map.get(header)
            t_sec = t_map.get(header)

            if o_sec == t_sec:
                if o_sec is not None:
                    merged_blocks.append(f"{header}\n\n{o_sec}".strip() if header else o_sec)
            elif o_sec == b_sec:
                if t_sec is not None:
                    merged_blocks.append(f"{header}\n\n{t_sec}".strip() if header else t_sec)
            elif t_sec == b_sec:
                if o_sec is not None:
                    merged_blocks.append(f"{header}\n\n{o_sec}".strip() if header else o_sec)
            else:
                # Conflicting section
                has_conflict = True
                conflict_block = (
                    f"<<<<<<< OURS\n"
                    f"{header}\n\n{o_sec or ''}".strip() + "\n"
                    f"=======\n"
                    f"{header}\n\n{t_sec or ''}".strip() + "\n"
                    f">>>>>>> THEIRS"
                )
                merged_blocks.append(conflict_block)

        return "\n\n".join(merged_blocks), has_conflict

    def _split_markdown_sections(self, text: str) -> List[Tuple[str, str]]:
        """Splits markdown into [(header, content), ...] tuples."""
        lines = (text or "").splitlines()
        sections: List[Tuple[str, str]] = []
        current_header = ""
        current_lines: List[str] = []

        header_regex = re.compile(r"^(#{1,4}\s+.+)$")

        for line in lines:
            if header_regex.match(line):
                if current_header or current_lines:
                    sections.append((current_header, "\n".join(current_lines).strip()))
                current_header = line.strip()
                current_lines = []
            else:
                current_lines.append(line)

        if current_header or current_lines:
            sections.append((current_header, "\n".join(current_lines).strip()))

        return sections

    def _sanitize_for_yaml(self, val: Any) -> Any:
        if hasattr(val, "value"):
            return val.value
        if isinstance(val, dict):
            return {k: self._sanitize_for_yaml(v) for k, v in val.items()}
        if isinstance(val, list):
            return [self._sanitize_for_yaml(v) for v in val]
        return val

    def _serialize_merged(
        self,
        frontmatter: Dict[str, Any],
        body: str,
        conflicts: List[FieldConflict],
    ) -> str:
        """Serializes merged frontmatter and body into valid markdown string."""
        clean_fm = self._sanitize_for_yaml(frontmatter)
        yaml_stream = StringIO()
        self.yaml.dump(clean_fm, yaml_stream)
        fm_str = yaml_stream.getvalue().strip()

        # If there are field conflicts, insert a comment header in YAML
        if conflicts:
            conflict_lines = ["# -------------------------------------------------------------",
                              "# [!] HRNX SEMANTIC MERGE CONFLICT DETECTED IN FRONTMATTER:",]
            for c in conflicts:
                b_str = json.dumps(self._sanitize_for_yaml(c.base_value), default=str)
                o_str = json.dumps(self._sanitize_for_yaml(c.ours_value), default=str)
                t_str = json.dumps(self._sanitize_for_yaml(c.theirs_value), default=str)
                conflict_lines.append(
                    f"#   Conflict on '{c.field}': OURS={o_str} vs THEIRS={t_str} (BASE={b_str})"
                )
            conflict_lines.append("# -------------------------------------------------------------")
            conflict_header = "\n".join(conflict_lines)
            fm_str = f"{conflict_header}\n{fm_str}"

        return f"---\n{fm_str}\n---\n\n{body}\n"
