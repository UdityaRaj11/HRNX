from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any, Dict, List, Optional
from hrnx.git.commit_manager import GitManager
from hrnx.git.semantic_merge import SemanticMergeEngine
from hrnx.models.schema import Directive, HarnessNode
from hrnx.relay.comments import CommentStore
from hrnx.transpiler.registry import default_registry
from hrnx.workspace import Workspace


def handle_get_graph(ws: Workspace) -> Dict[str, Any]:
    """Serializes the complete workspace graph and health status."""
    ws.load_all()
    nodes_data: List[Dict[str, Any]] = []
    for n in ws.graph.all_nodes():
        sev = getattr(n, "severity", None)
        sev_val = sev.value if hasattr(sev, "value") else (str(sev) if sev else None)
        st = getattr(n, "status", None)
        st_val = st.value if hasattr(st, "value") else (str(st) if st else None)
        t_val = n.type.value if hasattr(n.type, "value") else str(n.type)

        nodes_data.append({
            "id": n.id,
            "title": n.title,
            "type": t_val,
            "severity": sev_val,
            "status": st_val,
            "filePath": getattr(n, "file_path", ""),
            "dependsOn": list(getattr(n, "depends_on", [])),
            "implements": list(getattr(n, "implements", [])),
            "validatedBy": list(getattr(n, "validated_by", [])),
            "usesTools": list(getattr(n, "uses_tools", [])),
            "tags": list(getattr(n, "tags", [])),
            "body": getattr(n, "body", "")[:300],  # excerpt
        })

    edges_data: List[Dict[str, Any]] = []
    for u, v, data in ws.graph._graph.edges(data=True):
        edge_type = data.get("type")
        edges_data.append({
            "source": u,
            "target": v,
            "type": edge_type.value if hasattr(edge_type, "value") else str(edge_type or "depends_on"),
        })

    report = ws.check_workspace()

    return {
        "nodes": nodes_data,
        "edges": edges_data,
        "health": report.model_dump(),
        "availableTargets": default_registry.list_targets(),
    }


def handle_get_blast_radius(ws: Workspace, node_id: str) -> Dict[str, Any]:
    """Calculates downstream blast radius and extracts the induced visual subgraph."""
    ws.load_all()
    report = ws.calculate_blast_radius(node_id)

    # Subgraph node IDs
    subgraph_node_ids = set(report.origin_nodes)
    subgraph_node_ids.update(report.direct_dependents)
    subgraph_node_ids.update(report.transitive_dependents)
    subgraph_node_ids.update(report.impacted_evals)

    subgraph_nodes = []
    for nid in subgraph_node_ids:
        node = ws.graph.get_node(nid)
        if node:
            sev = getattr(node, "severity", None)
            sev_val = sev.value if hasattr(sev, "value") else (str(sev) if sev else None)
            st = getattr(node, "status", None)
            st_val = st.value if hasattr(st, "value") else (str(st) if st else None)
            t_val = node.type.value if hasattr(node.type, "value") else str(node.type)

            # Determine risk category for visual canvas
            if nid in report.origin_nodes:
                risk = "origin"
            elif nid in report.impacted_evals:
                risk = "required_eval"
            elif nid in report.impacted_fatal_invariants:
                risk = "fatal_broken"
            elif nid in report.direct_dependents:
                risk = "direct_impact"
            else:
                risk = "transitive_impact"

            subgraph_nodes.append({
                "id": node.id,
                "title": node.title,
                "type": t_val,
                "severity": sev_val,
                "status": st_val,
                "filePath": getattr(node, "file_path", ""),
                "riskLevel": risk,
            })

    subgraph_edges = []
    for u, v, data in ws.graph._graph.edges(data=True):
        if u in subgraph_node_ids and v in subgraph_node_ids:
            edge_type = data.get("type")
            subgraph_edges.append({
                "source": u,
                "target": v,
                "type": edge_type.value if hasattr(edge_type, "value") else str(edge_type or "depends_on"),
            })

    return {
        "report": report.model_dump(),
        "subgraphNodes": subgraph_nodes,
        "subgraphEdges": subgraph_edges,
    }


def handle_preview_transpile(
    ws: Workspace,
    node_id: Optional[str] = None,
    target: str = "claude",
    doc_text: Optional[str] = None,
    doc_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Generates transpilation preview for a selected target agent, with live diff."""
    node: Optional[HarnessNode] = None

    if doc_text:
        parsed = ws.parser.parse_string(doc_text, file_path=doc_path or "")
        node = parsed.node

    if not node and node_id:
        node = ws.graph.get_node(node_id)

    if not node and doc_path:
        for p, d in ws.documents.items():
            try:
                from pathlib import Path
                if Path(p).resolve() == Path(doc_path).resolve():
                    node = d.node
                    break
            except Exception:
                pass

    if not node:
        all_nodes = ws.graph.all_nodes()
        if all_nodes:
            directives = [
                n for n in all_nodes
                if getattr(n, "type", None) and (n.type.value == "directive" if hasattr(n.type, "value") else str(n.type) == "directive")
            ]
            node = directives[0] if directives else all_nodes[0]

    if not node:
        return {
            "error": "No .hrnx node found",
            "target": target,
            "filename": "",
            "content": "# HRNX Multi-Agent Transpiler\n\nOpen a directive or skill from `.hrnx/` to preview live compilation across Claude, Antigravity, Codex, Cursor, etc.",
            "hasDiff": False,
        }

    artifact = default_registry.preview_node(node, target, ws)
    if not artifact:
        return {
            "error": f"Unknown target agent: {target}",
            "target": target,
            "filename": "",
            "content": "",
            "hasDiff": False,
        }

    # Check if target file exists on disk to provide diff
    disk_path = ws.root_dir / artifact.path
    disk_content = ""
    has_diff = False
    diff_text = ""

    if disk_path.exists():
        disk_content = disk_path.read_text(encoding="utf-8")
        if disk_content.strip() != artifact.content.strip():
            has_diff = True
            diff_lines = list(
                difflib.unified_diff(
                    disk_content.splitlines(keepends=True),
                    artifact.content.splitlines(keepends=True),
                    fromfile=f"disk/{artifact.path}",
                    tofile=f"preview/{artifact.path}",
                )
            )
            diff_text = "".join(diff_lines)

    diagnostics = default_registry.validate_compatibility(node, target)
    diag_list = [d.model_dump() for d in diagnostics]

    return {
        "target": target,
        "filename": artifact.path,
        "content": artifact.content,
        "diskContent": disk_content,
        "hasDiff": has_diff,
        "diff": diff_text,
        "diagnostics": diag_list,
    }


def handle_inspect_drift(ws: Workspace) -> Dict[str, Any]:
    """Inspects drift across all configured targets."""
    ws.load_all()
    statuses = default_registry.inspect_drift(ws)
    return {
        "driftCount": sum(1 for s in statuses if s.status == "drifted"),
        "missingCount": sum(1 for s in statuses if s.status == "missing"),
        "inSyncCount": sum(1 for s in statuses if s.status == "in_sync"),
        "items": [s.model_dump() for s in statuses],
    }


def handle_reconcile(ws: Workspace, target_id: Optional[str] = None) -> Dict[str, Any]:
    """Reconciles out-of-sync generated agent files."""
    written = default_registry.reconcile(ws, target_id)
    statuses = default_registry.inspect_drift(ws)
    return {
        "reconciledFiles": written,
        "items": [s.model_dump() for s in statuses],
    }


def handle_get_evaluation_specs(ws: Workspace) -> Dict[str, Any]:
    """Returns all parsed evaluation specifications in the workspace."""
    ws.load_all()
    eval_nodes = [
        n for n in ws.graph.all_nodes()
        if getattr(n, "type", None) and (n.type.value == "eval" or str(n.type) == "eval")
    ]
    specs = []
    for node in eval_nodes:
        specs.append({
            "id": node.id,
            "title": node.title,
            "type": "eval",
            "validates": getattr(node, "validates", []),
            "targetAgents": getattr(node, "target_agents", []),
            "prompt": getattr(node, "prompt", ""),
            "assertionsCount": len(getattr(node, "assertions", [])),
            "filePath": ws.documents.get(node.id).file_path if node.id in ws.documents else None,
        })
    return {"specs": specs, "total": len(specs)}


def handle_get_conformance_matrix(
    ws: Workspace,
    targets: Optional[List[str]] = None,
    sandbox_mode: str = "local",
) -> Dict[str, Any]:
    """Generates cross-agent conformance benchmark matrix (sync)."""
    from hrnx.eval.runner import EvaluationRunner

    ws.load_all()
    runner = EvaluationRunner(ws)
    matrix = runner.run_all_sync(targets=targets, sandbox_mode=sandbox_mode)
    return matrix.model_dump()


async def handle_get_conformance_matrix_async(
    ws: Workspace,
    targets: Optional[List[str]] = None,
    sandbox_mode: str = "local",
) -> Dict[str, Any]:
    """Generates cross-agent conformance benchmark matrix asynchronously."""
    from hrnx.eval.runner import EvaluationRunner

    ws.load_all()
    runner = EvaluationRunner(ws)
    matrix = await runner.run_all(targets=targets, sandbox_mode=sandbox_mode)
    return matrix.model_dump()


def handle_run_evaluations(
    ws: Workspace,
    eval_ids: Optional[List[str]] = None,
    targets: Optional[List[str]] = None,
    sandbox_mode: str = "local",
) -> Dict[str, Any]:
    """Executes sandboxed evaluations using EvaluationRunner."""
    from hrnx.eval.runner import EvaluationRunner

    ws.load_all()
    runner = EvaluationRunner(ws)
    matrix = runner.run_all_sync(eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode)

    results = []
    for eid, target_map in matrix.matrix.items():
        for t, data in target_map.items():
            results.append({
                "evalId": eid,
                "target": t,
                "title": data.get("title", eid),
                "status": "passed" if data.get("passed", False) else "failed",
                "message": data.get("message", ""),
                "durationMs": data.get("duration_ms", 0.0),
                "assertions": data.get("assertions", []),
                "transcript": data.get("transcript", {}),
            })

    suite_passed = 0
    suite_failed = 0
    for eid, target_map in matrix.matrix.items():
        if all(d.get("passed", False) for d in target_map.values()):
            suite_passed += 1
        else:
            suite_failed += 1

    pass_count = sum(s.passed for s in matrix.agent_scores.values())
    fail_count = sum(s.failed for s in matrix.agent_scores.values())

    return {
        "total": len(matrix.eval_ids),
        "totalRuns": len(results),
        "passed": suite_passed,
        "failed": suite_failed,
        "runsPassed": pass_count,
        "runsFailed": fail_count,
        "agreementIndex": matrix.overall_agreement_index,
        "results": results,
        "matrix": matrix.model_dump(),
    }


async def handle_run_evaluations_async(
    ws: Workspace,
    eval_ids: Optional[List[str]] = None,
    targets: Optional[List[str]] = None,
    sandbox_mode: str = "local",
) -> Dict[str, Any]:
    """Executes sandboxed evaluations using EvaluationRunner asynchronously."""
    from hrnx.eval.runner import EvaluationRunner

    ws.load_all()
    runner = EvaluationRunner(ws)
    matrix = await runner.run_all(eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode)

    results = []
    for eid, target_map in matrix.matrix.items():
        for t, data in target_map.items():
            results.append({
                "evalId": eid,
                "target": t,
                "title": data.get("title", eid),
                "status": "passed" if data.get("passed", False) else "failed",
                "message": data.get("message", ""),
                "durationMs": data.get("duration_ms", 0.0),
                "assertions": data.get("assertions", []),
                "transcript": data.get("transcript", {}),
            })

    suite_passed = 0
    suite_failed = 0
    for eid, target_map in matrix.matrix.items():
        if all(d.get("passed", False) for d in target_map.values()):
            suite_passed += 1
        else:
            suite_failed += 1

    pass_count = sum(s.passed for s in matrix.agent_scores.values())
    fail_count = sum(s.failed for s in matrix.agent_scores.values())

    return {
        "total": len(matrix.eval_ids),
        "totalRuns": len(results),
        "passed": suite_passed,
        "failed": suite_failed,
        "runsPassed": pass_count,
        "runsFailed": fail_count,
        "agreementIndex": matrix.overall_agreement_index,
        "results": results,
        "matrix": matrix.model_dump(),
    }


# =========================================================================
# Stream 5: Multiplayer Collaboration, Semantic Merge & Git Synchronization
# =========================================================================

def handle_get_comments(ws: Workspace, node_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves all active review comments and discussion threads."""
    store = CommentStore(ws.root_dir)
    threads = store.get_comments(node_id)
    return {
        "threads": [t.model_dump() for t in threads],
        "total": len(threads),
    }


def handle_add_comment(
    ws: Workspace,
    node_id: str,
    text: str,
    author: str = "Engineer",
    author_color: str = "#6366f1",
) -> Dict[str, Any]:
    """Adds a new comment thread to a harness node."""
    store = CommentStore(ws.root_dir)
    thread = store.add_comment(node_id, author=author, text=text, author_color=author_color)
    return {"thread": thread.model_dump()}


def handle_add_reply(
    ws: Workspace,
    thread_id: str,
    text: str,
    author: str = "Engineer",
    author_color: str = "#6366f1",
) -> Dict[str, Any]:
    """Adds a reply to an existing comment thread."""
    store = CommentStore(ws.root_dir)
    reply = store.add_reply(thread_id, author=author, text=text, author_color=author_color)
    return {"reply": reply.model_dump() if reply else None}


def handle_resolve_comment(ws: Workspace, thread_id: str, resolved: bool = True) -> Dict[str, Any]:
    """Resolves or reopens a comment thread."""
    store = CommentStore(ws.root_dir)
    thread = store.resolve_thread(thread_id, resolved)
    return {"thread": thread.model_dump() if thread else None}


def handle_get_merge_conflict(
    ws: Workspace,
    file_path: Optional[str] = None,
    base_text: Optional[str] = None,
    ours_text: Optional[str] = None,
    theirs_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Performs 3-way AST merge analysis and returns visual conflict breakdown."""
    engine = SemanticMergeEngine()
    if file_path and (not ours_text or not base_text or not theirs_text):
        target_file = Path(file_path)
        if not target_file.is_absolute():
            target_file = ws.root_dir / target_file
        if target_file.exists():
            ours_text = ours_text or target_file.read_text(encoding="utf-8")
        ours_text = ours_text or ""
        base_text = base_text or ""
        theirs_text = theirs_text or ""

    result = engine.merge_strings(
        base_text=base_text or "",
        ours_text=ours_text or "",
        theirs_text=theirs_text or "",
        file_path=file_path,
    )

    base_doc = engine.parser.parse_string(base_text or "")
    ours_doc = engine.parser.parse_string(ours_text or "")
    theirs_doc = engine.parser.parse_string(theirs_text or "")

    return {
        "isClean": result.is_clean,
        "nodeId": result.node_id,
        "filePath": file_path,
        "autoMergedFields": result.auto_merged_fields,
        "fieldConflicts": [c.model_dump() for c in result.field_conflicts],
        "hasBodyConflict": result.has_body_conflict,
        "mergedContent": result.merged_content,
        "base": {
            "frontmatter": base_doc.frontmatter_data,
            "body": base_doc.body_raw,
        },
        "ours": {
            "frontmatter": ours_doc.frontmatter_data,
            "body": ours_doc.body_raw,
        },
        "theirs": {
            "frontmatter": theirs_doc.frontmatter_data,
            "body": theirs_doc.body_raw,
        },
        "mergedFrontmatter": result.merged_frontmatter,
        "mergedBody": result.merged_body,
    }


def handle_resolve_merge_conflict(
    ws: Workspace,
    file_path: str,
    resolved_frontmatter: Dict[str, Any],
    resolved_body: str,
) -> Dict[str, Any]:
    """Applies user-selected merge resolutions and saves the cleanly resolved node."""
    target_path = Path(file_path)
    if not target_path.is_absolute():
        target_path = ws.root_dir / target_path

    engine = SemanticMergeEngine()
    serialized = engine._serialize_merged(resolved_frontmatter, resolved_body, conflicts=[])
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(serialized, encoding="utf-8")
    ws.reload_file(target_path)

    return {
        "success": True,
        "filePath": str(target_path),
        "content": serialized,
    }


def handle_check_staged_sync(ws: Workspace) -> Dict[str, Any]:
    """Verifies whether staged git files have generated targets in sync."""
    mgr = GitManager(ws.root_dir)
    return mgr.check_staged_sync().model_dump()


def handle_atomic_commit(ws: Workspace, message: str) -> Dict[str, Any]:
    """Executes atomic multi-target Git commit."""
    mgr = GitManager(ws.root_dir)
    res = mgr.atomic_commit(message)
    return res.model_dump()


def handle_install_git_hooks(ws: Workspace) -> Dict[str, Any]:
    """Installs Git pre-commit hook and semantic merge driver."""
    mgr = GitManager(ws.root_dir)
    return mgr.install_git_hooks()

