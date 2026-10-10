from __future__ import annotations

import re
from typing import Optional
import lsprotocol.types as lsp

from hrnx.graph.blast_radius import BlastRadiusAnalyzer
from hrnx.models.schema import Directive
from hrnx.workspace import Workspace

ID_PATTERN = re.compile(r"([A-Za-z0-9_.-]+)")


def get_token_at_position(line: str, character: int) -> Optional[str]:
    """Extracts the full identifier token situated under the cursor."""
    if character >= len(line):
        character = max(0, len(line) - 1)

    for match in ID_PATTERN.finditer(line):
        if match.start() <= character <= match.end():
            token = match.group(1).strip()
            # Clean off leading '@ref:' or '@' if matched
            if token.startswith("ref:"):
                token = token[4:]
            return token
    return None


def compute_hover(
    workspace: Workspace,
    doc_text: str,
    position: lsp.Position,
) -> Optional[lsp.Hover]:
    """Computes rich markdown hover information for referenced node IDs."""
    lines = doc_text.splitlines()
    if position.line >= len(lines):
        return None

    line = lines[position.line]
    token = get_token_at_position(line, position.character)
    if not token:
        return None

    # Lookup node in workspace graph
    node = workspace.graph.get_node(token)
    if not node:
        return None

    type_str = node.type.value if hasattr(node.type, "value") else str(node.type)
    severity_str = getattr(node, "severity", None)
    status_str = node.status

    direct_deps = workspace.graph.get_dependencies(node.id)
    direct_dependents = workspace.graph.get_dependents(node.id)
    blast = BlastRadiusAnalyzer(workspace.graph).calculate(node.id)

    lines_md = [
        f"### `{node.id}`: {node.title}",
        f"**Type:** `{type_str}` | **Status:** `{status_str}`",
    ]
    if severity_str:
        sev_val = severity_str.value if hasattr(severity_str, "value") else severity_str
        lines_md.append(f"**Severity:** `{sev_val}`")

    if node.file_path:
        lines_md.append(f"**Source:** `{node.file_path}`")

    lines_md.append("\n---\n")

    body_preview = (node.body or "").strip()
    if len(body_preview) > 500:
        body_preview = body_preview[:500] + "..."
    if body_preview:
        lines_md.append(body_preview)
        lines_md.append("\n---\n")

    lines_md.append(
        f"- **Direct Dependencies:** {len(direct_deps)} ({', '.join(direct_deps) if direct_deps else 'none'})\n"
        f"- **Direct Dependents:** {len(direct_dependents)} ({', '.join(direct_dependents) if direct_dependents else 'none'})\n"
        f"- **Blast Radius:** {blast.total_blast_radius} nodes (evals: {len(blast.impacted_evals)})"
    )

    return lsp.Hover(
        contents=lsp.MarkupContent(
            kind=lsp.MarkupKind.Markdown,
            value="\n".join(lines_md),
        )
    )
