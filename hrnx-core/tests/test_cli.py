from pathlib import Path
from typer.testing import CliRunner

from hrnx.cli.main import app

runner = CliRunner()


def test_cli_init_and_check(tmp_path: Path):
    # Test 'hrnx init'
    init_res = runner.invoke(app, ["init", str(tmp_path)])
    assert init_res.exit_code == 0
    assert "Initialized HRNX Workspace" in init_res.stdout
    assert (tmp_path / ".hrnx" / "config.yaml").exists()
    assert (tmp_path / ".hrnx" / "adrs" / "ADR-001-db-migrations.md").exists()
    assert (tmp_path / ".hrnx" / "nodes" / "directives" / "dir.db.zero-downtime.md").exists()

    # Test 'hrnx check'
    check_res = runner.invoke(app, ["check", str(tmp_path)])
    assert check_res.exit_code == 0
    assert "PASSED" in check_res.stdout

    # Test 'hrnx blast-radius'
    blast_res = runner.invoke(app, ["blast-radius", "dir.db.zero-downtime", "-p", str(tmp_path)])
    assert blast_res.exit_code == 0
    assert "Blast Radius Analysis" in blast_res.stdout
    assert "eval.db.prevent-drop" in blast_res.stdout

    # Test 'hrnx graph'
    graph_res = runner.invoke(app, ["graph", "-p", str(tmp_path)])
    assert graph_res.exit_code == 0
    assert "Harness Topological Compilation Order" in graph_res.stdout

    # Test 'hrnx graph --format mermaid'
    mermaid_res = runner.invoke(app, ["graph", "-p", str(tmp_path), "-f", "mermaid"])
    assert mermaid_res.exit_code == 0
    assert "flowchart TD" in mermaid_res.stdout

    # Test 'hrnx info'
    info_res = runner.invoke(app, ["info", "-p", str(tmp_path)])
    assert info_res.exit_code == 0
    assert "HRNX Workspace Information" in info_res.stdout

    # Test 'hrnx compile'
    compile_res = runner.invoke(app, ["compile", "-p", str(tmp_path)])
    assert compile_res.exit_code == 0
    assert "Compiled and wrote" in compile_res.stdout
    assert (tmp_path / "CLAUDE.md").exists()

    # Test 'hrnx compile --check'
    check_sync_res = runner.invoke(app, ["compile", "-p", str(tmp_path), "--check"])
    assert check_sync_res.exit_code == 0
    assert "strictly in sync" in check_sync_res.stdout
