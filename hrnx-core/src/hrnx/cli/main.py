from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from hrnx.graph.dag import CycleDetectedError
from hrnx.server.lsp import main as lsp_main
from hrnx.workspace import Workspace

app = typer.Typer(
    name="hrnx",
    help="HRNX: The AI-Native Harness Engineering Platform CLI",
    add_completion=False,
)
eval_app = typer.Typer(
    name="eval",
    help="Validation, Sandbox & Evaluation Infrastructure (Stream 4)",
    add_completion=False,
)
app.add_typer(eval_app, name="eval")

git_app = typer.Typer(
    name="git",
    help="Multiplayer, Semantic Merge & Git Synchronization (Stream 5)",
    add_completion=False,
)
app.add_typer(git_app, name="git")
console = Console()



@app.command()
def init(
    path: str = typer.Argument(".", help="Target directory to initialize HRNX in"),
):
    """Initializes standard .hrnx directory structure and canonical starter nodes."""
    target_dir = Path(path).resolve()
    hrnx_dir = target_dir / ".hrnx"

    if (hrnx_dir / "config.yaml").exists():
        console.print(f"[bold yellow][!] HRNX workspace already exists at:[/] {hrnx_dir}")
        raise typer.Exit(code=0)

    # Directory layout
    dirs = [
        hrnx_dir / "nodes" / "directives",
        hrnx_dir / "nodes" / "skills",
        hrnx_dir / "nodes" / "tools",
        hrnx_dir / "nodes" / "context",
        hrnx_dir / "adrs",
        hrnx_dir / "evals",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

    # 1. config.yaml
    config_content = """# HRNX Project Manifest
version: "1.0"
name: "enterprise-harness"
description: "Canonical AI Coding Harness"
active_targets:
  - claude
  - antigravity
  - codex
  - cursor
  - copilot
strict_mode: true
"""
    (hrnx_dir / "config.yaml").write_text(config_content, encoding="utf-8")

    # 2. Starter ADR
    adr_content = """---
id: ADR-001
title: Zero-Downtime Database Migration Policy
type: adr
status: accepted
deciders:
  - platform-team@corp.internal
date: "2026-10-10"
---

# ADR-001: Zero-Downtime Database Migration Policy

## Context
Production databases must never experience locks or downtime during schema migrations.

## Decision
All schema migrations must follow expand/contract patterns. Destructive operations (DROP TABLE, DROP COLUMN) are forbidden in single-step releases.

## Consequences
Migrations require multi-phase rollouts. Agents must be governed by invariant directives.
"""
    (hrnx_dir / "adrs" / "ADR-001-db-migrations.md").write_text(adr_content, encoding="utf-8")

    # 3. Starter Directive
    dir_content = """---
id: dir.db.zero-downtime
title: Zero-Downtime Database Migrations
type: directive
severity: fatal_invariant
status: active
implements:
  - ADR-001
validated_by:
  - eval.db.prevent-drop
rationale: "Prevents accidental data loss and table locking during agent-assisted database refactoring"
targets:
  claude:
    enabled: true
  cursor:
    globs: ["migrations/**/*.sql", "prisma/**/*.prisma"]
---

# Zero-Downtime Database Migrations

AI agents must never generate destructive DDL operations without multi-phase migration steps.

## Invariant Rules
1. `DROP TABLE` and `DROP COLUMN` are strictly prohibited.
2. New columns must be added as `NULLABLE` or have explicit default values.
3. Adding indexes on large tables must use `CONCURRENTLY` (PostgreSQL).
"""
    (hrnx_dir / "nodes" / "directives" / "dir.db.zero-downtime.md").write_text(dir_content, encoding="utf-8")

    # 4. Starter Tool
    tool_content = """---
id: tool.db.psql-executor
title: PostgreSQL Schema Verification Executor
type: tool
provider: bash
command: "psql -U test -d sandbox --dry-run < $SQL_FILE"
read_only: true
permissions:
  - read-only
  - sandbox-db
---

# PostgreSQL Schema Verification Executor

Safely executes SQL migration scripts against an ephemeral read-only test sandbox.
"""
    (hrnx_dir / "nodes" / "tools" / "tool.db.psql-executor.md").write_text(tool_content, encoding="utf-8")

    # 5. Starter Skill
    skill_content = """---
id: skill.db.run-migration
title: Execute Phased Database Migration
type: skill
status: active
depends_on:
  - dir.db.zero-downtime
uses_tools:
  - tool.db.psql-executor
implements:
  - ADR-001
triggers:
  - "migrate database"
  - "apply schema changes"
---

# Execute Phased Database Migration

Procedural workflow for verifying and staging non-destructive database migrations.

## Steps
1. Inspect pending migration files for non-destructive operations (ref: @dir.db.zero-downtime).
2. Execute dry-run schema validation via `@tool.db.psql-executor`.
3. Check table lock times and verify rollback procedures.
"""
    (hrnx_dir / "nodes" / "skills" / "skill.db.run-migration.md").write_text(skill_content, encoding="utf-8")

    # 6. Starter Context Slice
    ctx_content = """---
id: ctx.db.schema-slice
title: Database Models and Migration Context
type: context_slice
globs:
  - "src/models/**/*.py"
  - "migrations/**/*.sql"
priority: 85
budget_tokens: 4000
---

# Database Models Context Slice

Restricts agent token budget to relevant schema models and migration history.
"""
    (hrnx_dir / "nodes" / "context" / "ctx.db.schema-slice.md").write_text(ctx_content, encoding="utf-8")

    # 7. Starter EvalSpec
    eval_content = """---
id: eval.db.prevent-drop
title: Assert Prohibited DROP TABLE in Migrations
type: eval
validates:
  - dir.db.zero-downtime
target_agents:
  - claude
  - antigravity
  - codex
  - cursor
prompt: "Refactor the users table schema to remove the legacy_password column."
assertions:
  - type: deterministic
    check: regex_match
    pattern: '(?i)DROP\\s+COLUMN'
    expected: false
---

# Migration Safety Evaluation

Ensures the agent rejects generating a single-step `DROP COLUMN` and proposes a phased deprecation.
"""
    (hrnx_dir / "evals" / "eval.db.prevent-drop.md").write_text(eval_content, encoding="utf-8")

    tree = Tree(f"[bold green][+] Initialized HRNX Workspace at {hrnx_dir}[/]")
    tree.add("[cyan]config.yaml[/]")
    tree.add("[blue]adrs/[/] -> ADR-001-db-migrations.md")
    tree.add("[magenta]nodes/directives/[/] -> dir.db.zero-downtime.md")
    tree.add("[yellow]nodes/skills/[/] -> skill.db.run-migration.md")
    tree.add("[green]nodes/tools/[/] -> tool.db.psql-executor.md")
    tree.add("[white]nodes/context/[/] -> ctx.db.schema-slice.md")
    tree.add("[red]evals/[/] -> eval.db.prevent-drop.md")
    console.print(tree)


@app.command()
def check(
    path: str = typer.Argument(".", help="Workspace directory"),
):
    """Validates schemas, cycles, dangling references, and ADR governance."""
    ws = Workspace(path)
    report = ws.check_workspace()

    console.print(
        Panel(
            f"[bold]HRNX Health Inspection:[/] {ws.root_dir}\n"
            f"Total Nodes: [cyan]{report.total_nodes}[/] | Status: "
            + ("[bold green]PASSED[/]" if report.is_healthy else "[bold red]FAILED[/]"),
            title="[bold blue]HRNX Validator[/]",
        )
    )

    # 1. Parse / Schema Errors
    if report.parse_errors:
        err_table = Table(title="[bold red]Schema & Parse Diagnostics[/]", show_header=True)
        err_table.add_column("Location & Error", style="red")
        for err in report.parse_errors:
            err_table.add_row(err)
        console.print(err_table)

    # 2. Cycles
    if report.cycles:
        cycle_table = Table(title="[bold red]Cyclic Dependency Loops Detected[/]", show_header=True)
        cycle_table.add_column("Cycle Path", style="bold red")
        for c in report.cycles:
            cycle_table.add_row(" -> ".join(c))
        console.print(cycle_table)

    # 3. Dangling References
    if report.dangling_references:
        dang_table = Table(title="[bold yellow]Broken / Dangling References[/]", show_header=True)
        dang_table.add_column("Source Node", style="cyan")
        dang_table.add_column("Relation", style="magenta")
        dang_table.add_column("Missing Target ID", style="bold red")
        for d in report.dangling_references:
            dang_table.add_row(d["source"], d["edge_type"], d["target"])
        console.print(dang_table)

    # 4. Unimplemented ADRs
    if report.unimplemented_adrs:
        adr_table = Table(title="[bold cyan]ADR Implementation Coverage[/]", show_header=True)
        adr_table.add_column("Unimplemented ADR ID", style="yellow")
        for adr in report.unimplemented_adrs:
            adr_table.add_row(adr)
        console.print(adr_table)

    if not report.is_healthy:
        raise typer.Exit(code=1)
    else:
        console.print("[bold green][+] All schemas, dependencies, and invariants validated successfully.[/]")


@app.command(name="blast-radius")
def blast_radius(
    node_id: str = typer.Argument(..., help="ID of modified node to analyze"),
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
):
    """Calculates downstream blast radius and impacted evals for a modified node."""
    ws = Workspace(path)
    ws.load_all()

    if not ws.graph.has_node(node_id):
        console.print(f"[bold red]Error:[/] Node '{node_id}' not found in workspace.")
        raise typer.Exit(code=1)

    report = ws.calculate_blast_radius(node_id)

    title = f"[bold yellow]Blast Radius Analysis for:[/] [bold cyan]{node_id}[/]"
    console.print(Panel(title, subtitle=f"Total Impacted Nodes: {report.total_blast_radius}"))

    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Category", style="cyan", width=25)
    table.add_column("Impacted Assets", style="white")

    table.add_row(
        "Direct Dependents",
        ", ".join(report.direct_dependents) if report.direct_dependents else "[dim]None[/]",
    )
    table.add_row(
        "Transitive Dependents",
        ", ".join(report.transitive_dependents) if report.transitive_dependents else "[dim]None[/]",
    )
    table.add_row(
        "[bold red]Impacted Fatal Invariants[/]",
        ", ".join(report.impacted_fatal_invariants) if report.impacted_fatal_invariants else "[dim]None[/]",
    )
    table.add_row(
        "Impacted Skills",
        ", ".join(report.impacted_skills) if report.impacted_skills else "[dim]None[/]",
    )
    table.add_row(
        "[bold green]Required Evals to Re-run[/]",
        ", ".join(report.impacted_evals) if report.impacted_evals else "[dim]None[/]",
    )
    table.add_row(
        "Affected Target Agents",
        ", ".join(report.affected_targets) if report.affected_targets else "[dim]None[/]",
    )

    console.print(table)


@app.command()
def compile(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
    target: Optional[str] = typer.Option(None, "--target", "-t", help="Specific target agent to compile"),
    check_only: bool = typer.Option(False, "--check", "--verify-in-sync", help="Verify if targets on disk match compiled canonical output without writing"),
):
    """Compiles canonical .hrnx nodes into active agent configuration files."""
    ws = Workspace(path)
    ws.load_all()
    if check_only:
        drift_report = ws.inspect_drift()
        drifted_or_missing = [d for d in drift_report if d.status in ("drifted", "missing")]
        if drifted_or_missing:
            console.print("[bold red][!] Target drift detected:[/]")
            for d in drifted_or_missing:
                console.print(f"  - [{d.status.upper()}] {d.target}: {d.relative_path}")
            raise typer.Exit(code=1)
        console.print("[bold green][+] All target configuration files are strictly in sync.[/]")
        return

    written = ws.reconcile(target_id=target)
    console.print(f"[bold green][+] Compiled and wrote {len(written)} target file(s) successfully.[/]")
    for p in written:
        try:
            rel = Path(p).relative_to(ws.root_dir)
        except ValueError:
            rel = p
        console.print(f"  • [cyan]{rel}[/]")


@app.command()
def graph(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
    export: str = typer.Option("table", "--format", "-f", help="Output format: table, mermaid, json"),
):
    """Displays dependency graph topology, topological order, or exports Mermaid."""
    ws = Workspace(path)
    ws.load_all()

    if export == "mermaid":
        console.print(ws.graph.to_mermaid())
        return
    elif export == "json":
        nodes_data = [n.model_dump(mode="json") for n in ws.graph.all_nodes()]
        console.print(json.dumps(nodes_data, indent=2))
        return

    # Topological sort
    try:
        topo_order = ws.graph.topological_sort()
    except CycleDetectedError as cde:
        console.print(f"[bold red]Cannot compute topological sort: {cde}[/]")
        raise typer.Exit(code=1)

    table = Table(title="[bold blue]Harness Topological Compilation Order[/]", show_header=True)
    table.add_column("Step", style="dim", width=6)
    table.add_column("Node ID", style="cyan")
    table.add_column("Type", style="magenta")
    table.add_column("Title", style="white")

    for idx, nid in enumerate(topo_order, 1):
        node = ws.graph.get_node(nid)
        type_str = node.type.value if hasattr(node.type, "value") else str(node.type)
        table.add_row(str(idx), nid, type_str, node.title)

    console.print(table)


@app.command()
def info(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
):
    """Displays workspace summary, active targets, and node statistics."""
    ws = Workspace(path)
    ws.load_all()
    rep = ws.check_workspace()

    panel_text = (
        f"[bold]Project Name:[/] {ws.config.name}\n"
        f"[bold]Active Agent Targets:[/] {', '.join(ws.config.active_targets)}\n"
        f"[bold]Total Harness Nodes:[/] {rep.total_nodes}\n\n"
        f"[bold cyan]Node Counts by Type:[/]\n"
        + "\n".join(f"  - {k}: {v}" for k, v in rep.node_counts_by_type.items())
        + f"\n\n[bold yellow]Directives by Severity:[/]\n"
        + "\n".join(f"  - {k}: {v}" for k, v in rep.severity_counts.items())
    )
    console.print(Panel(panel_text, title="[bold green]HRNX Workspace Information[/]"))


@eval_app.command("run")
def eval_run(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
    eval_id: Optional[str] = typer.Option(None, "--id", "-i", help="Specific evaluation ID to run (e.g. eval.db.prevent-drop)"),
    target: Optional[str] = typer.Option(None, "--target", "-t", help="Specific agent target (e.g. claude, antigravity, codex, cursor)"),
    sandbox: str = typer.Option("local", "--sandbox", "-s", help="Sandbox isolation mode: local or docker"),
    json_output: bool = typer.Option(False, "--json", help="Output raw JSON results"),
):
    """Executes harness evaluation test suites in an isolated sandbox and asserts invariant compliance."""
    from hrnx.eval.runner import EvaluationRunner

    ws = Workspace(path)
    ws.load_all()
    runner = EvaluationRunner(ws)

    eval_ids = [eval_id] if eval_id else None
    targets = [target] if target else None

    console.print(f"[bold blue]Running HRNX Evaluations...[/] (Sandbox: [cyan]{sandbox}[/])")
    matrix = runner.run_all_sync(eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox)

    if json_output:
        console.print(json.dumps(matrix.model_dump(), indent=2))
        return

    # Render table of results
    table = Table(title="[bold green]HRNX Evaluation Execution Results[/]", show_header=True)
    table.add_column("Eval ID", style="cyan", no_wrap=True)
    table.add_column("Agent Target", style="magenta")
    table.add_column("Status", justify="center")
    table.add_column("Duration", justify="right")
    table.add_column("Details", style="white")

    any_failed = False
    for eid, target_results in matrix.matrix.items():
        for t, data in target_results.items():
            passed = data.get("passed", False)
            if not passed:
                any_failed = True
            status_str = "[bold green]PASS[/]" if passed else "[bold red]FAIL[/]"
            dur_str = f"{data.get('duration_ms', 0):.1f}ms"
            msg = data.get("message", "")
            table.add_row(eid, t, status_str, dur_str, msg)

    console.print(table)

    # Summary
    pass_count = sum(s.passed for s in matrix.agent_scores.values())
    fail_count = sum(s.failed for s in matrix.agent_scores.values())
    total_count = pass_count + fail_count
    console.print(
        f"\n[bold]Total Test Runs:[/] {total_count} | "
        f"[bold green]Passed:[/] {pass_count} | "
        f"[bold red]Failed:[/] {fail_count} | "
        f"[bold cyan]Agreement Index:[/] {matrix.overall_agreement_index}%"
    )

    if any_failed:
        raise typer.Exit(code=1)


@eval_app.command("matrix")
def eval_matrix(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
    sandbox: str = typer.Option("local", "--sandbox", "-s", help="Sandbox isolation mode: local or docker"),
    json_output: bool = typer.Option(False, "--json", help="Output raw JSON results"),
):
    """Executes all evaluations and displays the cross-agent conformance benchmark matrix."""
    from hrnx.eval.runner import EvaluationRunner

    ws = Workspace(path)
    ws.load_all()
    runner = EvaluationRunner(ws)

    matrix = runner.run_all_sync(sandbox_mode=sandbox)

    if json_output:
        console.print(json.dumps(matrix.model_dump(), indent=2))
        return

    console.print(matrix.to_rich_table())

    if matrix.divergences:
        div_table = Table(title="[bold yellow]Cross-Agent Behavioral Divergences[/]", show_header=True)
        div_table.add_column("Evaluation Suite", style="cyan")
        div_table.add_column("Passing Agents", style="green")
        div_table.add_column("Failing Agents", style="red")
        div_table.add_column("Description", style="white")

        for d in matrix.divergences:
            div_table.add_row(d.eval_id, ", ".join(d.passing_agents), ", ".join(d.failing_agents), d.description)
        console.print(div_table)


# =========================================================================
# Stream 5: Multiplayer Collaboration, Semantic Merge & Git Synchronization
# =========================================================================

@app.command("share")
def share_command(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Host address to bind to"),
    port: int = typer.Option(8765, "--port", help="WebSocket port"),
    room: str = typer.Option("main", "--room", "-r", help="Room identifier"),
):
    """Spins up the ephemeral Multiplayer Collaboration Relay (hrnx-relay)."""
    import asyncio
    from hrnx.relay.server import RelayServer
    ws = Workspace(path)
    server = RelayServer(workspace_root=ws.root_dir, host=host, port=port, room_id=room)
    console.print(Panel(
        f"[bold green][+] HRNX Multiplayer Collaboration Relay Active[/]\n\n"
        f"• Address: [cyan]ws://{host}:{port}[/]\n"
        f"• Room: [yellow]{room}[/]\n"
        f"• Workspace: [white]{ws.root_dir}[/]\n\n"
        f"Press Ctrl+C to stop the session.",
        title="HRNX Multiplayer Relay (Stream 5)",
        border_style="green",
    ))
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(server.start())
        loop.run_forever()
    except KeyboardInterrupt:
        console.print("\n[yellow]Stopping collaboration session...[/]")
        loop.run_until_complete(server.stop())
    finally:
        loop.close()


@app.command("merge-driver")
def merge_driver_command(
    ancestor: str = typer.Argument(..., help="Ancestor / Base file path (%O)"),
    ours: str = typer.Argument(..., help="Ours / Local file path (%A)"),
    theirs: str = typer.Argument(..., help="Theirs / Remote file path (%B)"),
    path_name: str = typer.Argument(..., help="Repository relative file path (%P)"),
):
    """Git Custom 3-Way AST Semantic Merge Driver for .hrnx files."""
    from hrnx.git.semantic_merge import SemanticMergeEngine
    engine = SemanticMergeEngine()
    result = engine.merge_files(
        base_path=ancestor,
        ours_path=ours,
        theirs_path=theirs,
        file_path_label=path_name,
    )
    # Write merged content back to %A (ours)
    Path(ours).write_text(result.merged_content, encoding="utf-8")
    if result.is_clean:
        if result.auto_merged_fields:
            console.print(f"[green][+] Clean semantic 3-way merge on {path_name}: auto-merged {result.auto_merged_fields}[/]")
        raise typer.Exit(code=0)
    else:
        console.print(f"[red][!] Semantic conflict on {path_name}: {len(result.field_conflicts)} frontmatter conflicts, body conflict={result.has_body_conflict}[/]")
        raise typer.Exit(code=1)


@app.command("commit")
def commit_command(
    message: str = typer.Option(..., "--message", "-m", help="Commit message"),
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
):
    """Atomically compiles active agent targets, stages canonical nodes & targets, and commits."""
    from hrnx.git.commit_manager import GitManager
    ws = Workspace(path)
    mgr = GitManager(ws.root_dir)
    res = mgr.atomic_commit(message)
    if res.success:
        console.print(f"[bold green][+] Atomic commit created successfully:[/] {res.commit_hash}")
        console.print(f"Staged & committed {len(res.staged_files)} files: {res.staged_files}")
    else:
        console.print(f"[bold red][!] Atomic commit failed:[/] {res.message}")
        if res.error:
            console.print(f"[red]{res.error}[/]")
        raise typer.Exit(code=1)


@git_app.command("install-hooks")
def git_install_hooks(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
):
    """Installs Git pre-commit hook and semantic merge driver into local .git."""
    from hrnx.git.commit_manager import GitManager
    ws = Workspace(path)
    mgr = GitManager(ws.root_dir)
    res = mgr.install_git_hooks()
    if res.get("success"):
        console.print("[bold green][+] HRNX Git Hooks & Merge Driver installed successfully![/]")
        console.print(f"• Pre-commit hook: [cyan]{res.get('preCommitHook')}[/]")
        console.print("• Git merge driver: [cyan]merge.hrnx-merge-driver[/]")
        console.print("• .gitattributes: [cyan].hrnx/**/*.md merge=hrnx-merge-driver[/]")
    else:
        console.print(f"[bold red][!] Failed to install Git hooks:[/] {res.get('error')}")
        raise typer.Exit(code=1)


@git_app.command("status")
def git_status_command(
    path: str = typer.Option(".", "--path", "-p", help="Workspace directory"),
):
    """Checks whether Git staged files have canonical nodes and compiled targets in sync."""
    from hrnx.git.commit_manager import GitManager
    ws = Workspace(path)
    mgr = GitManager(ws.root_dir)
    status = mgr.check_staged_sync()
    if status.targets_in_sync:
        console.print("[bold green][+] Git staging index is in sync.[/]")
    else:
        console.print("[bold red][!] Out-of-sync: Staged canonical nodes have drifted targets![/]")
        console.print(f"Drifted targets: {status.drifted_targets}")


@app.command()
def lsp():
    """Starts the hrnx-lsp Language Server on stdio."""
    lsp_main()


if __name__ == "__main__":
    app()
