from pathlib import Path
from hrnx.models import ADR, Directive, Severity, Skill, ToolSpec
from hrnx.transpiler.registry import TranspilerRegistry, default_registry
from hrnx.workspace import Workspace


def test_transpiler_all_targets(tmp_path: Path):
    ws = Workspace(tmp_path)
    d = Directive(
        id="dir.db.zero-downtime",
        title="Zero Downtime Migrations",
        severity=Severity.FATAL_INVARIANT,
        body="Never lock tables exclusively during online hours.",
    )
    s = Skill(
        id="skill.db.migrate",
        title="Database Migration Workflow",
        triggers=["migrate db", "run migration"],
        body="Step 1: Check locks. Step 2: Run alembic upgrade.",
    )
    t = ToolSpec(
        id="tool.db.psql",
        title="PostgreSQL Query Executor",
        body="Executes parameterized SQL queries.",
    )
    ws.graph.add_node(d)
    ws.graph.add_node(s)
    ws.graph.add_node(t)
    ws.graph.build_edges_from_nodes()

    # Verify registry has all 10 targets
    targets = default_registry.list_targets()
    target_ids = {t["id"] for t in targets}
    expected = {
        "claude", "antigravity", "codex", "cursor", "copilot",
        "openhands", "aider", "cline", "windsurf", "goose"
    }
    assert expected.issubset(target_ids)

    # Compile all
    artifacts = default_registry.compile_all(ws)
    assert len(artifacts) >= 10

    paths = {a.path for a in artifacts}
    assert "CLAUDE.md" in paths
    assert ".agent/rules.md" in paths
    assert ".openai/instructions.md" in paths
    assert ".cursorrules" in paths
    assert ".github/copilot-instructions.md" in paths
    assert ".openhands/instructions.md" in paths
    assert "CONVENTIONS.md" in paths
    assert ".clinerules" in paths
    assert ".roomodes" in paths
    assert ".windsurfrules" in paths
    assert ".goosehints" in paths
    assert ".goose/config.yaml" in paths


def test_transpiler_node_previews(tmp_path: Path):
    ws = Workspace(tmp_path)
    d = Directive(
        id="dir.sec.tokens",
        title="Token Invariant",
        severity=Severity.FATAL_INVARIANT,
        body="Validate signatures.",
    )
    ws.graph.add_node(d)

    claude_art = default_registry.preview_node(d, "claude", ws)
    assert claude_art is not None
    assert '<invariant id="dir.sec.tokens"' in claude_art.content

    cursor_art = default_registry.preview_node(d, "cursor", ws)
    assert cursor_art is not None
    assert "globs: *" in cursor_art.content

    cline_art = default_registry.preview_node(d, "cline", ws)
    assert cline_art is not None
    assert "[FATAL_INVARIANT]" in cline_art.content

    windsurf_art = default_registry.preview_node(d, "windsurf", ws)
    assert windsurf_art is not None
    assert "[FATAL_INVARIANT]" in windsurf_art.content

    goose_art = default_registry.preview_node(d, "goose", ws)
    assert goose_art is not None
    assert "[FATAL_INVARIANT]" in goose_art.content


def test_compatibility_diagnostics(tmp_path: Path):
    ws = Workspace(tmp_path)
    s = Skill(
        id="skill.test.multiagent",
        title="Autonomous Subagent Coordination",
        triggers=["orchestrate"],
        body="Subagent steps.",
    )
    ws.graph.add_node(s)

    # Claude and Antigravity: Lossless
    claude_diags = default_registry.validate_compatibility(s, "claude")
    assert all(not d.lossy for d in claude_diags)

    # Copilot, Windsurf, Goose: Lossy warning on subagents
    copilot_diags = default_registry.validate_compatibility(s, "copilot")
    assert any(d.lossy and d.feature == "subagents" for d in copilot_diags)

    windsurf_diags = default_registry.validate_compatibility(s, "windsurf")
    assert any(d.lossy and d.feature == "subagents" for d in windsurf_diags)

    goose_diags = default_registry.validate_compatibility(s, "goose")
    assert any(d.lossy and d.feature == "subagents" for d in goose_diags)


def test_drift_inspection_and_reconcile(tmp_path: Path):
    ws = Workspace(tmp_path)
    d = Directive(
        id="dir.core.rule",
        title="Core Rule",
        severity=Severity.WARNING,
        body="Keep code clean.",
    )
    ws.graph.add_node(d)

    # Initially missing
    drift_report = default_registry.inspect_drift(ws)
    missing = [d for d in drift_report if d.status == "missing"]
    assert len(missing) > 0

    # Reconcile writes files
    written = default_registry.reconcile(ws)
    assert len(written) > 0

    # Now in sync
    drift_report2 = default_registry.inspect_drift(ws)
    in_sync = [d for d in drift_report2 if d.status == "in_sync"]
    assert len(in_sync) > 0

    # Simulate manual edit / drift
    claude_file = tmp_path / "CLAUDE.md"
    if claude_file.exists():
        claude_file.write_text("MANUAL UNAUTHORIZED CHANGE", encoding="utf-8")
        drift_report3 = default_registry.inspect_drift(ws)
        drifted = [d for d in drift_report3 if d.status == "drifted"]
        assert any(d.relative_path == "CLAUDE.md" for d in drifted)

