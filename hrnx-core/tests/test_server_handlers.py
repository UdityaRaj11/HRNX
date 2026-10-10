from pathlib import Path
from hrnx.models import Directive, EvalSpec, Severity
from hrnx.server.handlers import (
    handle_get_graph,
    handle_get_blast_radius,
    handle_preview_transpile,
    handle_inspect_drift,
    handle_reconcile,
    handle_run_evaluations,
)
from hrnx.workspace import Workspace


def test_server_handlers_end_to_end(tmp_path: Path):
    ws = Workspace(tmp_path)
    d = Directive(
        id="dir.auth.rbac",
        title="Role-Based Access Control",
        severity=Severity.FATAL_INVARIANT,
        body="All endpoints require explicit RBAC permissions.",
    )
    ev = EvalSpec(
        id="eval.auth.rbac-test",
        title="RBAC Compliance Suite",
        validates=["dir.auth.rbac"],
        target_agents=["claude", "cursor"],
        prompt="Verify endpoint auth",
    )
    ws.graph.add_node(d)
    ws.graph.add_node(ev)
    ws.graph.build_edges_from_nodes()

    # 1. getGraph
    graph_res = handle_get_graph(ws)
    assert len(graph_res["nodes"]) == 2
    assert len(graph_res["edges"]) >= 1
    assert "health" in graph_res

    # 2. getBlastRadius
    blast_res = handle_get_blast_radius(ws, "dir.auth.rbac")
    assert "dir.auth.rbac" in blast_res["report"]["origin_nodes"]
    assert "eval.auth.rbac-test" in blast_res["report"]["impacted_evals"]
    assert len(blast_res["subgraphNodes"]) >= 2

    # 3. previewTranspile
    preview_res = handle_preview_transpile(ws, node_id="dir.auth.rbac", target="claude")
    assert preview_res["target"] == "claude"
    assert "invariant" in preview_res["content"]
    assert "diagnostics" in preview_res
    assert len(preview_res["diagnostics"]) > 0

    # 4. inspectDrift
    drift_res = handle_inspect_drift(ws)
    assert drift_res["missingCount"] > 0

    # 5. reconcile
    rec_res = handle_reconcile(ws)
    assert len(rec_res["reconciledFiles"]) > 0

    # 6. runEvaluations
    eval_res = handle_run_evaluations(ws, ["eval.auth.rbac-test"])
    assert eval_res["total"] == 1
    assert eval_res["passed"] == 1


def test_preview_transpile_with_pygls_object(tmp_path: Path):
    from hrnx.server.lsp import extract_param, preview_transpile_feature, get_blast_radius_feature, get_or_create_workspace
    ws = get_or_create_workspace(tmp_path)
    d = Directive(
        id="dir.test.obj",
        title="Object Test Directive",
        severity=Severity.FATAL_INVARIANT,
        body="Testing pygls Object handling.",
    )
    ws.graph.add_node(d)
    ws.graph.build_edges_from_nodes()

    # Simulate pygls deserialized Object (no .get attribute)
    class PyglsObject:
        pass

    mock_params = PyglsObject()
    mock_params.nodeId = "dir.test.obj"
    mock_params.targetAgent = "claude"
    mock_params.docText = None
    mock_params.docPath = None

    # This previously failed with AttributeError: 'Object' object has no attribute 'get'
    res = preview_transpile_feature(None, mock_params)
    assert res["target"] == "claude"
    assert "dir.test.obj" in res["content"]

    # Also test getBlastRadius with Object
    blast = get_blast_radius_feature(None, mock_params)
    assert "dir.test.obj" in blast["report"]["origin_nodes"]


import pytest

@pytest.mark.asyncio
async def test_conformance_matrix_in_async_event_loop(tmp_path: Path):
    """Verifies that conformance matrix generation succeeds inside an active asyncio event loop."""
    from hrnx.server.lsp import get_conformance_matrix_feature, get_or_create_workspace
    from hrnx.server.handlers import handle_get_conformance_matrix, handle_get_conformance_matrix_async

    ws = get_or_create_workspace(tmp_path)
    d = Directive(
        id="dir.async.matrix",
        title="Async Matrix Test",
        severity=Severity.FATAL_INVARIANT,
        body="Policy for matrix async loop testing.",
    )
    ev = EvalSpec(
        id="eval.async.matrix-test",
        title="Async Matrix Eval",
        validates=["dir.async.matrix"],
        target_agents=["claude", "cursor"],
        prompt="Verify async matrix",
    )
    ws.graph.add_node(d)
    ws.graph.add_node(ev)
    ws.graph.build_edges_from_nodes()

    # 1. Async feature call inside running loop (as pygls does)
    res_async = await get_conformance_matrix_feature(None, {"targets": ["claude"]})
    assert "eval_ids" in res_async or "matrix" in res_async

    # 2. Sync handler call inside running loop (must not raise RuntimeError: asyncio.run() cannot be called)
    res_sync = handle_get_conformance_matrix(ws, targets=["claude"])
    assert "eval_ids" in res_sync or "matrix" in res_sync


