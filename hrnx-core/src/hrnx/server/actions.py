from __future__ import annotations

from pathlib import Path
from typing import List, Optional
import lsprotocol.types as lsp

from hrnx.parser.ast import ParsedDocument
from hrnx.workspace import Workspace


def compute_code_actions(
    workspace: Workspace,
    doc_uri: str,
    doc_text: str,
    doc: ParsedDocument,
    range_: lsp.Range,
    context: lsp.CodeActionContext,
) -> List[lsp.CodeAction]:
    """Generates quick-fix CodeActions for diagnostics and best practices."""
    actions: List[lsp.CodeAction] = []
    lines = doc_text.splitlines()

    for diag in context.diagnostics:
        # 1. Quick-fix for unresolved reference in body
        if "Unresolved reference:" in diag.message:
            # Extract target ID
            # e.g. "Unresolved reference: 'dir.auth.tokens' does not exist in workspace."
            parts = diag.message.split("'")
            if len(parts) >= 2:
                missing_id = parts[1]
                # Suggest generating skeleton directive file
                action = lsp.CodeAction(
                    title=f"Create skeleton node for '{missing_id}'",
                    kind=lsp.CodeActionKind.QuickFix,
                    diagnostics=[diag],
                    command=lsp.Command(
                        title="Create skeleton node",
                        command="hrnx.createSkeletonNode",
                        arguments=[missing_id],
                    ),
                )
                actions.append(action)

    # 2. Add missing dependency to YAML header (for cursor selection or diagnostics)
    if doc.node and doc.body_references:
        for b_ref in doc.body_references:
            if b_ref.target_id not in doc.node.depends_on and workspace.graph.has_node(b_ref.target_id):
                # Check if cursor is near this reference
                if abs(b_ref.line - 1 - range_.start.line) <= 2:
                    # Find where depends_on is in frontmatter, or insert it before closing ---
                    fm_end_line = doc.frontmatter_lines - 1
                    edit_line = max(1, fm_end_line)
                    edit_text = f"depends_on:\n  - {b_ref.target_id}\n"
                    # Check if depends_on already in frontmatter
                    for idx, l in enumerate(lines[:doc.frontmatter_lines]):
                        if l.strip().startswith("depends_on:"):
                            edit_line = idx + 1
                            edit_text = f"  - {b_ref.target_id}\n"
                            break

                    action = lsp.CodeAction(
                        title=f"Add '{b_ref.target_id}' to YAML depends_on header",
                        kind=lsp.CodeActionKind.QuickFix,
                        edit=lsp.WorkspaceEdit(
                            changes={
                                doc_uri: [
                                    lsp.TextEdit(
                                        range=lsp.Range(
                                            start=lsp.Position(line=edit_line, character=0),
                                            end=lsp.Position(line=edit_line, character=0),
                                        ),
                                        new_text=edit_text,
                                    )
                                ]
                            }
                        ),
                    )
                    actions.append(action)

    # 3. Suggest skeleton EvalSpec if directive has no evals
    if doc.node and doc.node.type.value == "directive":
        sev = getattr(doc.node, "severity", None)
        sev_val = sev.value if hasattr(sev, "value") else str(sev)
        validated_by = getattr(doc.node, "validated_by", [])
        if sev_val == "fatal_invariant" and not validated_by:
            eval_id = f"eval.{doc.node.id.replace('dir.', '')}.verify"
            action = lsp.CodeAction(
                title=f"Generate skeleton EvalSpec for fatal invariant '{doc.node.id}'",
                kind=lsp.CodeActionKind.QuickFix,
                command=lsp.Command(
                    title="Generate skeleton EvalSpec",
                    command="hrnx.generateEvalSpec",
                    arguments=[doc.node.id, eval_id],
                ),
            )
            actions.append(action)

    return actions
