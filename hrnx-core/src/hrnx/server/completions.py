from __future__ import annotations

from typing import List, Optional
import lsprotocol.types as lsp

from hrnx.models.base import NodeType
from hrnx.workspace import Workspace


def compute_completions(
    workspace: Workspace,
    doc_text: str,
    position: lsp.Position,
) -> lsp.CompletionList:
    """Computes context-aware autocompletions for node IDs in frontmatter and markdown body."""
    lines = doc_text.splitlines()
    current_line = lines[position.line] if position.line < len(lines) else ""
    line_prefix = current_line[:position.character]

    # Inspect current and preceding lines in frontmatter context
    target_type_filter: Optional[NodeType] = None
    context_lines = [current_line]
    for prev_idx in range(max(0, position.line - 4), position.line):
        context_lines.append(lines[prev_idx])

    combined_context = "\n".join(context_lines)
    if "implements:" in combined_context:
        target_type_filter = NodeType.ADR
    elif "validated_by:" in combined_context:
        target_type_filter = NodeType.EVAL
    elif "uses_tools:" in combined_context:
        target_type_filter = NodeType.TOOL

    items: List[lsp.CompletionItem] = []
    all_nodes = workspace.graph.all_nodes()

    for node in all_nodes:
        if target_type_filter and node.type != target_type_filter:
            continue

        # Format item
        type_str = node.type.value if hasattr(node.type, "value") else str(node.type)
        severity_str = getattr(node, "severity", None)
        detail_parts = [f"[{type_str.upper()}]"]
        if severity_str:
            detail_parts.append(f"severity: {severity_str.value if hasattr(severity_str, 'value') else severity_str}")
        detail_parts.append(f"status: {node.status}")

        doc_snippet = (node.body or "")[:350].strip()
        markdown_doc = f"### {node.title}\n\n**ID:** `{node.id}`  \n**Type:** {type_str}  \n\n{doc_snippet}"

        # Determine completion kind
        if node.type == NodeType.ADR:
            kind = lsp.CompletionItemKind.Reference
        elif node.type == NodeType.DIRECTIVE:
            kind = lsp.CompletionItemKind.Class
        elif node.type == NodeType.SKILL:
            kind = lsp.CompletionItemKind.Method
        elif node.type == NodeType.TOOL:
            kind = lsp.CompletionItemKind.Function
        elif node.type == NodeType.EVAL:
            kind = lsp.CompletionItemKind.Unit
        else:
            kind = lsp.CompletionItemKind.Variable

        # Check if inserting after @ref:
        insert_text = node.id
        if line_prefix.endswith("@ref:"):
            insert_text = node.id
        elif line_prefix.endswith("@"):
            insert_text = node.id

        items.append(
            lsp.CompletionItem(
                label=node.id,
                kind=kind,
                detail=" | ".join(detail_parts),
                documentation=lsp.MarkupContent(
                    kind=lsp.MarkupKind.Markdown,
                    value=markdown_doc,
                ),
                insert_text=insert_text,
            )
        )

    return lsp.CompletionList(is_incomplete=False, items=items)
