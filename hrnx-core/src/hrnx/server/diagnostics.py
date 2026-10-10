from __future__ import annotations

import re
from typing import List, Optional
import lsprotocol.types as lsp

from hrnx.graph.edges import EdgeType
from hrnx.models.base import NodeType
from hrnx.models.schema import ADR, Directive, HarnessNode
from hrnx.parser.ast import ParsedDocument
from hrnx.workspace import Workspace


def find_token_range(doc_lines: List[str], token: str, start_line: int = 0) -> lsp.Range:
    """Locates the line and character column of a token within document lines."""
    for line_idx in range(start_line, len(doc_lines)):
        line = doc_lines[line_idx]
        col = line.find(token)
        if col != -1:
            return lsp.Range(
                start=lsp.Position(line=line_idx, character=col),
                end=lsp.Position(line=line_idx, character=col + len(token)),
            )
    return lsp.Range(
        start=lsp.Position(line=max(0, start_line), character=0),
        end=lsp.Position(line=max(0, start_line), character=max(1, len(token))),
    )


def compute_diagnostics(
    workspace: Workspace,
    doc: ParsedDocument,
    doc_text: str,
) -> List[lsp.Diagnostic]:
    """Generates LSP Diagnostics for syntax, schema, broken deps, cycles, and ADR coverage."""
    diagnostics: List[lsp.Diagnostic] = []
    lines = doc_text.splitlines()

    # 1. Parse and Schema diagnostics
    for d in doc.diagnostics:
        line_0 = max(0, d.line - 1)
        col_0 = max(0, d.column - 1)
        line_len = len(lines[line_0]) if line_0 < len(lines) else 1
        rng = lsp.Range(
            start=lsp.Position(line=line_0, character=col_0),
            end=lsp.Position(line=line_0, character=max(col_0 + 1, line_len)),
        )
        diag_sev = (
            lsp.DiagnosticSeverity.Error
            if d.severity == "error"
            else lsp.DiagnosticSeverity.Warning
        )
        diagnostics.append(
            lsp.Diagnostic(
                range=rng,
                message=d.message,
                severity=diag_sev,
                source="hrnx-parser",
            )
        )

    node = doc.node
    if not node:
        return diagnostics

    # 2. Broken dependencies / dangling references
    all_referenced_deps = []
    for dep in node.depends_on:
        all_referenced_deps.append((dep, "depends_on"))
    if isinstance(node, Directive):
        for adr in node.implements:
            all_referenced_deps.append((adr, "implements"))
        for ev in node.validated_by:
            all_referenced_deps.append((ev, "validated_by"))
        for ov in node.overrides:
            all_referenced_deps.append((ov, "overrides"))

    for ref_id, rel_type in all_referenced_deps:
        if not workspace.graph.has_node(ref_id):
            rng = find_token_range(lines, ref_id)
            diagnostics.append(
                lsp.Diagnostic(
                    range=rng,
                    message=f"Broken reference: '{ref_id}' referenced in {rel_type} does not exist in the workspace.",
                    severity=lsp.DiagnosticSeverity.Error,
                    source="hrnx-graph",
                )
            )

    # 3. Body cross-references to non-existent nodes
    for body_ref in doc.body_references:
        if not workspace.graph.has_node(body_ref.target_id):
            line_0 = max(0, body_ref.line - 1)
            col_0 = max(0, body_ref.col_start - 1)
            col_end = max(col_0 + 1, body_ref.col_end - 1)
            rng = lsp.Range(
                start=lsp.Position(line=line_0, character=col_0),
                end=lsp.Position(line=line_0, character=col_end),
            )
            diagnostics.append(
                lsp.Diagnostic(
                    range=rng,
                    message=f"Unresolved reference: '{body_ref.target_id}' does not exist in workspace.",
                    severity=lsp.DiagnosticSeverity.Warning,
                    source="hrnx-graph",
                )
            )

    # 4. Cycle detection
    cycles = workspace.graph.detect_cycles()
    for cycle in cycles:
        if node.id in cycle:
            cycle_str = " -> ".join(cycle)
            rng = lsp.Range(
                start=lsp.Position(line=0, character=0),
                end=lsp.Position(line=0, character=len(lines[0]) if lines else 3),
            )
            diagnostics.append(
                lsp.Diagnostic(
                    range=rng,
                    message=f"Cyclic dependency loop detected involving this node: {cycle_str}",
                    severity=lsp.DiagnosticSeverity.Error,
                    source="hrnx-cycle-detector",
                )
            )
            break

    # 5. ADR coverage check
    if isinstance(node, ADR):
        coverage = workspace.graph.get_adr_coverage()
        implementing = coverage.get(node.id, [])
        if not implementing and node.status != "deprecated":
            rng = lsp.Range(
                start=lsp.Position(line=0, character=0),
                end=lsp.Position(line=0, character=len(lines[0]) if lines else 3),
            )
            diagnostics.append(
                lsp.Diagnostic(
                    range=rng,
                    message=f"ADR '{node.id}' has no implementing Directives or Skills.",
                    severity=lsp.DiagnosticSeverity.Information,
                    source="hrnx-adr-governance",
                )
            )

    return diagnostics
