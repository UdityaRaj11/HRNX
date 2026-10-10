from pathlib import Path
import lsprotocol.types as lsp

from hrnx.models import ADR, Directive, Severity
from hrnx.server.actions import compute_code_actions
from hrnx.server.completions import compute_completions
from hrnx.server.definition import compute_definition
from hrnx.server.diagnostics import compute_diagnostics
from hrnx.server.hover import compute_hover
from hrnx.workspace import Workspace


def test_lsp_diagnostics_broken_dep(tmp_path: Path):
    ws = Workspace(tmp_path)
    text = """---
id: dir.test.broken
title: Broken Directive
type: directive
severity: fatal_invariant
depends_on:
  - dir.nonexistent.dep
---

Body
"""
    doc = ws.parser.parse_string(text, file_path=str(tmp_path / "test.md"))
    if doc.node:
        ws.graph.add_node(doc.node)
        ws.graph.build_edges_from_nodes()

    diags = compute_diagnostics(ws, doc, text)
    assert len(diags) > 0
    assert any("dir.nonexistent.dep" in d.message for d in diags)


def test_lsp_completions(tmp_path: Path):
    ws = Workspace(tmp_path)
    adr = ADR(id="ADR-001", title="Database Invariant")
    dir_node = Directive(id="dir.db.zero-downtime", title="Zero Downtime")
    ws.graph.add_node(adr)
    ws.graph.add_node(dir_node)
    ws.graph.build_edges_from_nodes()

    # 1. Frontmatter 'implements:' completion
    fm_text = "---\nid: dir.foo\nimplements:\n  - "
    res = compute_completions(ws, fm_text, lsp.Position(line=2, character=4))
    labels = [item.label for item in res.items]
    assert "ADR-001" in labels
    assert "dir.db.zero-downtime" not in labels  # filtered by target_type_filter (ADR only)

    # 2. Body '@ref:' completion
    body_text = "# Header\nRefer to @ref:"
    res2 = compute_completions(ws, body_text, lsp.Position(line=1, character=14))
    labels2 = [item.label for item in res2.items]
    assert "dir.db.zero-downtime" in labels2
    assert "ADR-001" in labels2


def test_lsp_hover(tmp_path: Path):
    ws = Workspace(tmp_path)
    node = Directive(
        id="dir.auth.tokens",
        title="Token Validation Policy",
        severity=Severity.FATAL_INVARIANT,
        body="All JWTs must be RS256 signed.",
    )
    ws.graph.add_node(node)
    ws.graph.build_edges_from_nodes()

    text = "# Some File\nRequires @ref:dir.auth.tokens for auth."
    hover = compute_hover(ws, text, lsp.Position(line=1, character=15))

    assert hover is not None
    assert isinstance(hover.contents, lsp.MarkupContent)
    assert "Token Validation Policy" in hover.contents.value
    assert "fatal_invariant" in hover.contents.value


def test_lsp_definition(tmp_path: Path):
    ws = Workspace(tmp_path)
    def_file = tmp_path / "tokens.md"
    def_file.write_text(
        "---\nid: dir.auth.tokens\ntitle: Tokens\ntype: directive\n---\nBody",
        encoding="utf-8",
    )
    doc = ws.parser.parse_file(def_file)
    if doc.node:
        ws.graph.add_node(doc.node)

    text = "Depends on @ref:dir.auth.tokens"
    loc = compute_definition(ws, text, lsp.Position(line=0, character=18))

    from urllib.parse import unquote
    assert loc is not None
    assert str(tmp_path).replace("\\", "/").lower() in unquote(loc.uri.lower())


def test_lsp_code_actions(tmp_path: Path):
    ws = Workspace(tmp_path)
    dep_node = Directive(id="dir.auth.tokens", title="Tokens")
    ws.graph.add_node(dep_node)

    text = """---
id: dir.auth.login
title: Login Directive
type: directive
---

# Login

See @ref:dir.auth.tokens for authentication.
"""
    doc = ws.parser.parse_string(text, file_path=str(tmp_path / "login.md"))
    if doc.node:
        ws.graph.add_node(doc.node)
    ws.graph.build_edges_from_nodes()

    actions = compute_code_actions(
        workspace=ws,
        doc_uri="file:///test/login.md",
        doc_text=text,
        doc=doc,
        range_=lsp.Range(
            start=lsp.Position(line=8, character=5),
            end=lsp.Position(line=8, character=20),
        ),
        context=lsp.CodeActionContext(diagnostics=[]),
    )

    action_titles = [a.title for a in actions]
    assert any("Add 'dir.auth.tokens' to YAML depends_on header" in t for t in action_titles)
