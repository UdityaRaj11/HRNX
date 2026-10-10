from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import unquote, urlparse
from typing import Optional

from pygls.lsp.server import LanguageServer
import lsprotocol.types as lsp

from hrnx.server.actions import compute_code_actions
from hrnx.server.completions import compute_completions
from hrnx.server.definition import compute_definition
from hrnx.server.diagnostics import compute_diagnostics
from hrnx.server.hover import compute_hover
from hrnx.server.handlers import (
    handle_get_graph,
    handle_get_blast_radius,
    handle_preview_transpile,
    handle_inspect_drift,
    handle_reconcile,
    handle_run_evaluations,
    handle_run_evaluations_async,
    handle_get_evaluation_specs,
    handle_get_conformance_matrix,
    handle_get_conformance_matrix_async,
    handle_get_comments,
    handle_add_comment,
    handle_add_reply,
    handle_resolve_comment,
    handle_get_merge_conflict,
    handle_resolve_merge_conflict,
    handle_check_staged_sync,
    handle_atomic_commit,
    handle_install_git_hooks,
)
from hrnx.relay.server import RelayServer
from hrnx.workspace import Workspace

SERVER_NAME = "hrnx-lsp"
SERVER_VERSION = "0.1.0"

server = LanguageServer(SERVER_NAME, SERVER_VERSION)
workspace_instance: Optional[Workspace] = None
relay_server_instance: Optional[RelayServer] = None



def uri_to_path(uri: str) -> Path:
    """Converts a file:// URI to a local Path object."""
    parsed = urlparse(uri)
    path_str = unquote(parsed.path)
    # Fix leading slash on Windows (e.g. /C:/...)
    if sys.platform == "win32" and path_str.startswith("/") and len(path_str) > 2 and path_str[2] == ":":
        path_str = path_str[1:]
    return Path(path_str)


def get_or_create_workspace(root_hint: Optional[Path] = None) -> Workspace:
    """Retrieves or initializes the active Workspace."""
    global workspace_instance
    if workspace_instance is None:
        root = root_hint or Path.cwd()
        workspace_instance = Workspace(root)
        workspace_instance.load_all()
    return workspace_instance


@server.feature(lsp.INITIALIZE)
def on_initialize(ls: LanguageServer, params: lsp.InitializeParams) -> lsp.InitializeResult:
    """Handles LSP client initialization."""
    root_path = None
    if params.root_uri:
        root_path = uri_to_path(params.root_uri)
    elif params.root_path:
        root_path = Path(params.root_path)

    ws = get_or_create_workspace(root_path)
    ws.load_all()

    return lsp.InitializeResult(
        capabilities=lsp.ServerCapabilities(
            text_document_sync=lsp.TextDocumentSyncOptions(
                open_close=True,
                change=lsp.TextDocumentSyncKind.Full,
                save=lsp.SaveOptions(include_text=True),
            ),
            completion_provider=lsp.CompletionOptions(
                trigger_characters=[":", "@", "[", " "],
                resolve_provider=False,
            ),
            hover_provider=True,
            definition_provider=True,
            code_action_provider=lsp.CodeActionOptions(
                code_action_kinds=[lsp.CodeActionKind.QuickFix],
            ),
            execute_command_provider=lsp.ExecuteCommandOptions(
                commands=[
                    "hrnx.createSkeletonNode",
                    "hrnx.generateEvalSpec",
                ]
            ),
        ),
        server_info=lsp.ServerInfo(name=SERVER_NAME, version=SERVER_VERSION),
    )


@server.feature(lsp.TEXT_DOCUMENT_DID_OPEN)
def did_open(ls: LanguageServer, params: lsp.DidOpenTextDocumentParams):
    """Processes newly opened documents in editor."""
    ws = get_or_create_workspace()
    path_obj = uri_to_path(params.text_document.uri)
    doc_text = params.text_document.text

    parsed_doc = ws.parser.parse_string(doc_text, file_path=str(path_obj))
    if parsed_doc.node:
        ws.graph.add_node(parsed_doc.node)
        ws.graph.build_edges_from_nodes()

    diagnostics = compute_diagnostics(ws, parsed_doc, doc_text)
    ls.text_document_publish_diagnostics(
        lsp.PublishDiagnosticsParams(uri=params.text_document.uri, diagnostics=diagnostics)
    )


@server.feature(lsp.TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: LanguageServer, params: lsp.DidChangeTextDocumentParams):
    """Processes document edits in real-time."""
    ws = get_or_create_workspace()
    path_obj = uri_to_path(params.text_document.uri)
    # Full sync kind: content changes contain the full document text
    doc_text = params.content_changes[0].text

    parsed_doc = ws.parser.parse_string(doc_text, file_path=str(path_obj))
    if parsed_doc.node:
        ws.graph.add_node(parsed_doc.node)
        ws.graph.build_edges_from_nodes()

    diagnostics = compute_diagnostics(ws, parsed_doc, doc_text)
    ls.text_document_publish_diagnostics(
        lsp.PublishDiagnosticsParams(uri=params.text_document.uri, diagnostics=diagnostics)
    )


@server.feature(lsp.TEXT_DOCUMENT_DID_SAVE)
def did_save(ls: LanguageServer, params: lsp.DidSaveTextDocumentParams):
    """Re-indexes document on disk save."""
    ws = get_or_create_workspace()
    path_obj = uri_to_path(params.text_document.uri)
    parsed_doc = ws.reload_file(path_obj)

    doc_text = params.text if params.text else path_obj.read_text(encoding="utf-8")
    diagnostics = compute_diagnostics(ws, parsed_doc, doc_text)
    ls.text_document_publish_diagnostics(
        lsp.PublishDiagnosticsParams(uri=params.text_document.uri, diagnostics=diagnostics)
    )


@server.feature(lsp.TEXT_DOCUMENT_COMPLETION)
def did_completion(ls: LanguageServer, params: lsp.CompletionParams) -> lsp.CompletionList:
    """Provides autocompletions for node IDs."""
    ws = get_or_create_workspace()
    doc = ls.workspace.get_text_document(params.text_document.uri)
    doc_text = doc.source if doc else ""
    return compute_completions(ws, doc_text, params.position)


@server.feature(lsp.TEXT_DOCUMENT_HOVER)
def did_hover(ls: LanguageServer, params: lsp.HoverParams) -> Optional[lsp.Hover]:
    """Provides hover card preview for node references."""
    ws = get_or_create_workspace()
    doc = ls.workspace.get_text_document(params.text_document.uri)
    doc_text = doc.source if doc else ""
    return compute_hover(ws, doc_text, params.position)


@server.feature(lsp.TEXT_DOCUMENT_DEFINITION)
def did_definition(ls: LanguageServer, params: lsp.DefinitionParams) -> Optional[lsp.Location]:
    """Provides Go-To-Definition for node references."""
    ws = get_or_create_workspace()
    doc = ls.workspace.get_text_document(params.text_document.uri)
    doc_text = doc.source if doc else ""
    return compute_definition(ws, doc_text, params.position)


@server.feature(lsp.TEXT_DOCUMENT_CODE_ACTION)
def did_code_action(ls: LanguageServer, params: lsp.CodeActionParams) -> list[lsp.CodeAction]:
    """Provides quick fixes for broken references and unvalidated invariants."""
    ws = get_or_create_workspace()
    doc = ls.workspace.get_text_document(params.text_document.uri)
    doc_text = doc.source if doc else ""
    path_obj = uri_to_path(params.text_document.uri)
    parsed_doc = ws.parser.parse_string(doc_text, file_path=str(path_obj))
    return compute_code_actions(
        workspace=ws,
        doc_uri=params.text_document.uri,
        doc_text=doc_text,
        doc=parsed_doc,
        range_=params.range,
        context=params.context,
    )


@server.command("hrnx.createSkeletonNode")
def create_skeleton_node(ls: LanguageServer, args: list):
    """Creates a skeleton node file on disk."""
    if not args:
        return
    node_id = str(args[0])
    ws = get_or_create_workspace()

    # Determine subfolder based on prefix
    if node_id.startswith("dir."):
        target_dir = ws.hrnx_dir / "nodes" / "directives"
        filename = f"{node_id.replace('dir.', '')}.md"
        content = (
            f"---\nid: {node_id}\ntitle: Skeleton Directive\ntype: directive\n"
            f"severity: fatal_invariant\nstatus: active\n---\n\n"
            f"# {node_id}\n\nSpecify directive requirements and invariants here.\n"
        )
    elif node_id.startswith("ADR-"):
        target_dir = ws.hrnx_dir / "adrs"
        filename = f"{node_id}.md"
        content = (
            f"---\nid: {node_id}\ntitle: Skeleton ADR\ntype: adr\nstatus: accepted\n---\n\n"
            f"# {node_id}\n\n## Context\n\n## Decision\n\n## Consequences\n"
        )
    else:
        target_dir = ws.hrnx_dir / "nodes" / "skills"
        filename = f"{node_id}.md"
        content = (
            f"---\nid: {node_id}\ntitle: Skeleton Skill\ntype: skill\nstatus: active\n---\n\n"
            f"# {node_id}\n\nSkill workflow steps.\n"
        )

    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    if not target_path.exists():
        target_path.write_text(content, encoding="utf-8")
        ws.reload_file(target_path)


@server.command("hrnx.generateEvalSpec")
def generate_eval_spec(ls: LanguageServer, args: list):
    """Generates a skeleton EvalSpec for a directive."""
    if len(args) < 2:
        return
    dir_id, eval_id = str(args[0]), str(args[1])
    ws = get_or_create_workspace()
    eval_dir = ws.hrnx_dir / "evals"
    eval_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{eval_id}.md"
    content = (
        f"---\nid: {eval_id}\ntitle: Evaluation for {dir_id}\ntype: eval\n"
        f"validates: [{dir_id}]\ntarget_agents: [claude, antigravity, codex, cursor]\n"
        f"prompt: 'Execute operation verifying compliance with {dir_id}'\n"
        f"assertions:\n  - check: regex_match\n    pattern: 'SUCCESS'\n---\n\n"
        f"# Test Spec for {dir_id}\n\nVerify that the agent adheres to invariant `{dir_id}`.\n"
    )
    target_path = eval_dir / filename
    if not target_path.exists():
        target_path.write_text(content, encoding="utf-8")
        ws.reload_file(target_path)


def extract_param(params: Any, key: str, default: Any = None) -> Any:
    """Safely extracts a parameter from dict, lsprotocol Object, or attrs/class instance."""
    if params is None:
        return default
    if isinstance(params, dict):
        val = params.get(key)
        if val is not None:
            return val
        snake_key = "".join(["_" + c.lower() if c.isupper() else c for c in key]).lstrip("_")
        return params.get(snake_key, default)
    # Attribute access on Object
    if hasattr(params, key):
        val = getattr(params, key)
        if val is not None:
            return val
    snake_key = "".join(["_" + c.lower() if c.isupper() else c for c in key]).lstrip("_")
    if hasattr(params, snake_key):
        val = getattr(params, snake_key)
        if val is not None:
            return val
    if hasattr(params, "__dict__"):
        d = vars(params)
        if key in d and d[key] is not None:
            return d[key]
        if snake_key in d and d[snake_key] is not None:
            return d[snake_key]
    return default


# =========================================================================
# Custom HRNX Language Features & Commands (Stream 2)
# =========================================================================

@server.feature("hrnx/getGraph")
def get_graph_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    return handle_get_graph(ws)


@server.command("hrnx.getGraph")
def get_graph_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    return handle_get_graph(ws)


@server.feature("hrnx/getBlastRadius")
def get_blast_radius_feature(ls: LanguageServer, params: Any) -> dict:
    node_id = str(extract_param(params, "nodeId", "") or extract_param(params, "node_id", ""))
    ws = get_or_create_workspace()
    return handle_get_blast_radius(ws, node_id)


@server.command("hrnx.getBlastRadius")
def get_blast_radius_command(ls: LanguageServer, args: list) -> dict:
    node_id = ""
    if args:
        if isinstance(args[0], str):
            node_id = args[0]
        else:
            node_id = str(extract_param(args[0], "nodeId", "") or extract_param(args[0], "node_id", ""))
    ws = get_or_create_workspace()
    return handle_get_blast_radius(ws, node_id)


@server.feature("hrnx/previewTranspile")
def preview_transpile_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    node_id = extract_param(params, "nodeId") or extract_param(params, "node_id")
    target = extract_param(params, "targetAgent") or extract_param(params, "target_agent") or "claude"
    doc_text = extract_param(params, "docText") or extract_param(params, "doc_text")
    doc_path = extract_param(params, "docPath") or extract_param(params, "doc_path")
    return handle_preview_transpile(
        ws,
        node_id=node_id,
        target=target,
        doc_text=doc_text,
        doc_path=doc_path,
    )


@server.command("hrnx.previewTranspile")
def preview_transpile_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args else {}
    node_id = extract_param(params, "nodeId") or extract_param(params, "node_id")
    target = extract_param(params, "targetAgent") or extract_param(params, "target_agent") or "claude"
    doc_text = extract_param(params, "docText") or extract_param(params, "doc_text")
    doc_path = extract_param(params, "docPath") or extract_param(params, "doc_path")
    return handle_preview_transpile(
        ws,
        node_id=node_id,
        target=target,
        doc_text=doc_text,
        doc_path=doc_path,
    )


@server.feature("hrnx/inspectDrift")
def inspect_drift_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    return handle_inspect_drift(ws)


@server.command("hrnx.inspectDrift")
def inspect_drift_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    return handle_inspect_drift(ws)


@server.feature("hrnx/reconcile")
def reconcile_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    target_id = extract_param(params, "targetId") or extract_param(params, "target_id")
    ws = get_or_create_workspace()
    return handle_reconcile(ws, target_id)


@server.command("hrnx.reconcile")
def reconcile_command(ls: LanguageServer, args: list) -> dict:
    target_id = None
    if args:
        if isinstance(args[0], str):
            target_id = args[0]
        else:
            target_id = extract_param(args[0], "targetId") or extract_param(args[0], "target_id")
    ws = get_or_create_workspace()
    return handle_reconcile(ws, target_id)


@server.feature("hrnx/getEvaluationSpecs")
def get_evaluation_specs_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    return handle_get_evaluation_specs(ws)


@server.command("hrnx.getEvaluationSpecs")
def get_evaluation_specs_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    return handle_get_evaluation_specs(ws)


@server.feature("hrnx/getConformanceMatrix")
async def get_conformance_matrix_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    targets = extract_param(params, "targets")
    sandbox_mode = extract_param(params, "sandboxMode") or "local"
    return await handle_get_conformance_matrix_async(ws, targets=targets, sandbox_mode=sandbox_mode)


@server.command("hrnx.getConformanceMatrix")
async def get_conformance_matrix_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    targets = extract_param(params, "targets")
    sandbox_mode = extract_param(params, "sandboxMode") or "local"
    return await handle_get_conformance_matrix_async(ws, targets=targets, sandbox_mode=sandbox_mode)


@server.feature("hrnx/runEvaluations")
async def run_evaluations_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    eval_ids = extract_param(params, "evalIds") or extract_param(params, "eval_ids")
    targets = extract_param(params, "targets")
    sandbox_mode = extract_param(params, "sandboxMode") or "local"
    ws = get_or_create_workspace()
    return await handle_run_evaluations_async(ws, eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode)


@server.command("hrnx.runEvaluations")
async def run_evaluations_command(ls: LanguageServer, args: list) -> dict:
    eval_ids = None
    targets = None
    sandbox_mode = "local"
    if args:
        if isinstance(args[0], list):
            eval_ids = args[0]
        elif isinstance(args[0], dict):
            eval_ids = extract_param(args[0], "evalIds") or extract_param(args[0], "eval_ids")
            targets = extract_param(args[0], "targets")
            sandbox_mode = extract_param(args[0], "sandboxMode") or "local"
    ws = get_or_create_workspace()
    return await handle_run_evaluations_async(ws, eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode)


# =========================================================================
# Stream 5: Multiplayer Live Collaboration & Relay
# =========================================================================

@server.feature("hrnx/relayStatus")
def relay_status_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    global relay_server_instance
    ws = get_or_create_workspace()
    if relay_server_instance and relay_server_instance.is_running:
        return {
            "isRunning": True,
            "host": relay_server_instance.host,
            "port": relay_server_instance.port,
            "roomId": relay_server_instance.room_id,
            "peerCount": len(relay_server_instance.session.peers),
            "session": relay_server_instance.session.snapshot(),
        }
    return {
        "isRunning": False,
        "host": "127.0.0.1",
        "port": 8765,
        "roomId": "main",
        "peerCount": 0,
        "session": None,
    }


@server.command("hrnx.relayStatus")
def relay_status_command(ls: LanguageServer, args: list) -> dict:
    return relay_status_feature(ls)


@server.feature("hrnx/startRelay")
async def start_relay_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    global relay_server_instance
    ws = get_or_create_workspace()
    host = str(extract_param(params, "host", "127.0.0.1"))
    port = int(extract_param(params, "port", 8765))
    room_id = str(extract_param(params, "roomId", "main") or extract_param(params, "room_id", "main"))

    if relay_server_instance and relay_server_instance.is_running:
        return {
            "success": True,
            "alreadyRunning": True,
            "host": relay_server_instance.host,
            "port": relay_server_instance.port,
            "roomId": relay_server_instance.room_id,
        }

    try:
        relay_server_instance = RelayServer(
            workspace_root=ws.root_dir,
            host=host,
            port=port,
            room_id=room_id,
        )
        await relay_server_instance.start()
        return {
            "success": True,
            "alreadyRunning": False,
            "host": host,
            "port": port,
            "roomId": room_id,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@server.command("hrnx.startRelay")
async def start_relay_command(ls: LanguageServer, args: list) -> dict:
    params = args[0] if args and isinstance(args[0], dict) else {}
    return await start_relay_feature(ls, params)


@server.feature("hrnx/stopRelay")
async def stop_relay_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    global relay_server_instance
    if relay_server_instance:
        await relay_server_instance.stop()
        relay_server_instance = None
    return {"success": True}


@server.command("hrnx.stopRelay")
async def stop_relay_command(ls: LanguageServer, args: list) -> dict:
    return await stop_relay_feature(ls)


# =========================================================================
# Stream 5: Comments & Discussion Threads
# =========================================================================

@server.feature("hrnx/getComments")
def get_comments_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    node_id = extract_param(params, "nodeId") or extract_param(params, "node_id")
    return handle_get_comments(ws, node_id=node_id)


@server.command("hrnx.getComments")
def get_comments_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    node_id = None
    if args:
        if isinstance(args[0], str):
            node_id = args[0]
        elif isinstance(args[0], dict):
            node_id = extract_param(args[0], "nodeId") or extract_param(args[0], "node_id")
    return handle_get_comments(ws, node_id=node_id)


@server.feature("hrnx/addComment")
def add_comment_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    node_id = str(extract_param(params, "nodeId", "") or extract_param(params, "node_id", ""))
    text = str(extract_param(params, "text", ""))
    author = str(extract_param(params, "author", "Engineer"))
    color = str(extract_param(params, "authorColor", "#6366f1") or extract_param(params, "author_color", "#6366f1"))
    return handle_add_comment(ws, node_id=node_id, text=text, author=author, author_color=color)


@server.command("hrnx.addComment")
def add_comment_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    node_id = str(extract_param(params, "nodeId", "") or extract_param(params, "node_id", ""))
    text = str(extract_param(params, "text", ""))
    author = str(extract_param(params, "author", "Engineer"))
    color = str(extract_param(params, "authorColor", "#6366f1") or extract_param(params, "author_color", "#6366f1"))
    return handle_add_comment(ws, node_id=node_id, text=text, author=author, author_color=color)


@server.feature("hrnx/addReply")
def add_reply_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    thread_id = str(extract_param(params, "threadId", "") or extract_param(params, "thread_id", ""))
    text = str(extract_param(params, "text", ""))
    author = str(extract_param(params, "author", "Engineer"))
    color = str(extract_param(params, "authorColor", "#6366f1") or extract_param(params, "author_color", "#6366f1"))
    return handle_add_reply(ws, thread_id=thread_id, text=text, author=author, author_color=color)


@server.command("hrnx.addReply")
def add_reply_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    thread_id = str(extract_param(params, "threadId", "") or extract_param(params, "thread_id", ""))
    text = str(extract_param(params, "text", ""))
    author = str(extract_param(params, "author", "Engineer"))
    color = str(extract_param(params, "authorColor", "#6366f1") or extract_param(params, "author_color", "#6366f1"))
    return handle_add_reply(ws, thread_id=thread_id, text=text, author=author, author_color=color)


@server.feature("hrnx/resolveComment")
def resolve_comment_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    thread_id = str(extract_param(params, "threadId", "") or extract_param(params, "thread_id", ""))
    resolved = bool(extract_param(params, "resolved", True))
    return handle_resolve_comment(ws, thread_id=thread_id, resolved=resolved)


@server.command("hrnx.resolveComment")
def resolve_comment_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    thread_id = str(extract_param(params, "threadId", "") or extract_param(params, "thread_id", ""))
    resolved = bool(extract_param(params, "resolved", True))
    return handle_resolve_comment(ws, thread_id=thread_id, resolved=resolved)


# =========================================================================
# Stream 5: Semantic 3-Way Merge Engine
# =========================================================================

@server.feature("hrnx/getMergeConflict")
def get_merge_conflict_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    file_path = extract_param(params, "filePath") or extract_param(params, "file_path")
    base_text = extract_param(params, "baseText") or extract_param(params, "base_text")
    ours_text = extract_param(params, "oursText") or extract_param(params, "ours_text")
    theirs_text = extract_param(params, "theirsText") or extract_param(params, "theirs_text")
    return handle_get_merge_conflict(
        ws,
        file_path=file_path,
        base_text=base_text,
        ours_text=ours_text,
        theirs_text=theirs_text,
    )


@server.command("hrnx.getMergeConflict")
def get_merge_conflict_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    file_path = extract_param(params, "filePath") or extract_param(params, "file_path")
    base_text = extract_param(params, "baseText") or extract_param(params, "base_text")
    ours_text = extract_param(params, "oursText") or extract_param(params, "ours_text")
    theirs_text = extract_param(params, "theirsText") or extract_param(params, "theirs_text")
    return handle_get_merge_conflict(
        ws,
        file_path=file_path,
        base_text=base_text,
        ours_text=ours_text,
        theirs_text=theirs_text,
    )


@server.feature("hrnx/resolveMergeConflict")
def resolve_merge_conflict_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    file_path = str(extract_param(params, "filePath", "") or extract_param(params, "file_path", ""))
    resolved_fm = extract_param(params, "resolvedFrontmatter") or extract_param(params, "resolved_frontmatter") or {}
    resolved_body = str(extract_param(params, "resolvedBody", "") or extract_param(params, "resolved_body", ""))
    return handle_resolve_merge_conflict(
        ws,
        file_path=file_path,
        resolved_frontmatter=resolved_fm,
        resolved_body=resolved_body,
    )


@server.command("hrnx.resolveMergeConflict")
def resolve_merge_conflict_command(ls: LanguageServer, args: list) -> dict:
    ws = get_or_create_workspace()
    params = args[0] if args and isinstance(args[0], dict) else {}
    file_path = str(extract_param(params, "filePath", "") or extract_param(params, "file_path", ""))
    resolved_fm = extract_param(params, "resolvedFrontmatter") or extract_param(params, "resolved_frontmatter") or {}
    resolved_body = str(extract_param(params, "resolvedBody", "") or extract_param(params, "resolved_body", ""))
    return handle_resolve_merge_conflict(
        ws,
        file_path=file_path,
        resolved_frontmatter=resolved_fm,
        resolved_body=resolved_body,
    )


# =========================================================================
# Stream 5: Atomic Multi-Target Commit & Git Hooks
# =========================================================================

@server.feature("hrnx/checkStagedSyncStatus")
def check_staged_sync_status_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    return handle_check_staged_sync(ws)


@server.feature("hrnx/atomicCommit")
def atomic_commit_feature(ls: LanguageServer, params: Any) -> dict:
    ws = get_or_create_workspace()
    message = str(extract_param(params, "message", "Update harness canonical nodes and compiled agent targets"))
    return handle_atomic_commit(ws, message=message)


@server.feature("hrnx/installGitHooks")
def install_git_hooks_feature(ls: LanguageServer, params: Optional[Any] = None) -> dict:
    ws = get_or_create_workspace()
    return handle_install_git_hooks(ws)



def main():
    """Main CLI entrypoint for hrnx-lsp."""
    server.start_io()


if __name__ == "__main__":
    main()

