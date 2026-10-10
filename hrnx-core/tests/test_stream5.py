import asyncio
import json
import pytest
from pathlib import Path

from hrnx.git.commit_manager import GitManager
from hrnx.git.semantic_merge import SemanticMergeEngine
from hrnx.relay.comments import CommentStore
from hrnx.relay.server import RelayServer
from hrnx.relay.session import PeerInfo, RelaySession
from hrnx.server.handlers import (
    handle_add_comment,
    handle_add_reply,
    handle_get_comments,
    handle_get_merge_conflict,
    handle_resolve_comment,
    handle_resolve_merge_conflict,
)
from hrnx.workspace import Workspace


def test_relay_session_presence_and_drafts():
    session = RelaySession("room-test")
    peer1 = PeerInfo(id="p1", name="Alice", color="#ef4444")
    peer2 = PeerInfo(id="p2", name="Bob", color="#3b82f6")

    session.add_peer(peer1)
    session.add_peer(peer2)
    assert len(session.peers) == 2

    # Presence update
    session.update_presence("p1", active_node_id="dir.auth.tokens")
    assert session.get_peer("p1").active_node_id == "dir.auth.tokens"

    # Draft update
    draft = session.update_draft(
        node_id="dir.auth.tokens",
        peer_id="p1",
        frontmatter={"severity": "warning"},
        body="Updated rule body text",
        title="Token Verification",
    )
    assert draft.node_id == "dir.auth.tokens"
    assert draft.updated_frontmatter["severity"] == "warning"
    assert session.get_draft("dir.auth.tokens") is not None

    # Snapshot
    snap = session.snapshot()
    assert snap["peerCount"] == 2
    assert snap["draftCount"] == 1

    # Discard draft
    session.discard_draft("dir.auth.tokens")
    assert session.get_draft("dir.auth.tokens") is None

    # Remove peer
    session.remove_peer("p2")
    assert len(session.peers) == 1


def test_comment_store(tmp_path: Path):
    store = CommentStore(tmp_path)
    assert len(store.get_comments()) == 0

    thread = store.add_comment(
        node_id="dir.db.zero-downtime",
        author="Alice",
        text="Should we also forbid TRUNCATE TABLE?",
        author_color="#10b981",
    )
    assert thread.node_id == "dir.db.zero-downtime"
    assert not thread.resolved

    reply = store.add_reply(
        thread_id=thread.id,
        author="Bob",
        text="Yes, absolutely. Added in next revision.",
    )
    assert reply is not None
    assert len(thread.replies) == 1

    store.resolve_thread(thread.id, resolved=True)
    assert thread.resolved

    # Persistence verification: reload from disk
    store2 = CommentStore(tmp_path)
    threads = store2.get_comments("dir.db.zero-downtime")
    assert len(threads) == 1
    assert threads[0].resolved
    assert len(threads[0].replies) == 1


def test_semantic_3way_merge_clean_non_conflicting():
    engine = SemanticMergeEngine()

    base_text = """---
id: dir.test.rule
title: Base Title
type: directive
severity: advisory
status: active
depends_on:
  - dir.core.base
---

# Base Rule Header
Initial documentation body.
"""

    # Ours modified severity to fatal_invariant and added depends_on
    ours_text = """---
id: dir.test.rule
title: Base Title
type: directive
severity: fatal_invariant
status: active
depends_on:
  - dir.core.base
  - dir.auth.tokens
---

# Base Rule Header
Initial documentation body.
"""

    # Theirs added a target profile and added another depends_on
    theirs_text = """---
id: dir.test.rule
title: Base Title
type: directive
severity: advisory
status: active
depends_on:
  - dir.core.base
  - dir.db.migrations
targets:
  claude:
    enabled: true
---

# Base Rule Header
Initial documentation body.
"""

    result = engine.merge_strings(base_text, ours_text, theirs_text)
    assert result.is_clean
    assert len(result.field_conflicts) == 0
    # Both depends_on additions were merged cleanly
    assert "dir.auth.tokens" in result.merged_frontmatter["depends_on"]
    assert "dir.db.migrations" in result.merged_frontmatter["depends_on"]
    assert "dir.core.base" in result.merged_frontmatter["depends_on"]
    # Ours severity change was accepted
    assert result.merged_frontmatter["severity"] == "fatal_invariant"
    # Theirs targets addition was accepted
    assert "claude" in result.merged_frontmatter["targets"]


def test_semantic_3way_merge_scalar_conflict():
    engine = SemanticMergeEngine()

    base_text = """---
id: dir.conflict.rule
title: Conflict Rule
type: directive
severity: advisory
status: active
---

# Conflict Rule
"""

    # Ours changes severity to fatal_invariant
    ours_text = """---
id: dir.conflict.rule
title: Conflict Rule
type: directive
severity: fatal_invariant
status: active
---

# Conflict Rule
"""

    # Theirs changes severity to warning
    theirs_text = """---
id: dir.conflict.rule
title: Conflict Rule
type: directive
severity: warning
status: active
---

# Conflict Rule
"""

    result = engine.merge_strings(base_text, ours_text, theirs_text)
    assert not result.is_clean
    assert len(result.field_conflicts) == 1
    conf = result.field_conflicts[0]
    assert conf.field == "severity"
    assert conf.base_value == "advisory"
    assert conf.ours_value == "fatal_invariant"
    assert conf.theirs_value == "warning"


def test_git_manager_hook_and_driver_installation(tmp_path: Path):
    # Initialize mock git directory
    git_dir = tmp_path / ".git"
    git_dir.mkdir(parents=True, exist_ok=True)

    mgr = GitManager(tmp_path)
    res = mgr.install_git_hooks()
    assert res["success"]

    # Verify pre-commit hook exists
    hook = git_dir / "hooks" / "pre-commit"
    assert hook.exists()
    assert "hrnx compile" in hook.read_text(encoding="utf-8")

    # Verify .gitattributes updated
    attrs = tmp_path / ".gitattributes"
    assert attrs.exists()
    assert "merge=hrnx-merge-driver" in attrs.read_text(encoding="utf-8")


def test_lsp_stream5_handlers(tmp_path: Path):
    ws = Workspace(tmp_path)

    # Comments handlers
    add_res = handle_add_comment(ws, node_id="dir.test", text="Review note", author="Alice")
    assert "thread" in add_res
    th_id = add_res["thread"]["id"]

    reply_res = handle_add_reply(ws, thread_id=th_id, text="Acknowledged", author="Bob")
    assert reply_res["reply"] is not None

    get_res = handle_get_comments(ws, node_id="dir.test")
    assert get_res["total"] == 1

    resolve_res = handle_resolve_comment(ws, thread_id=th_id, resolved=True)
    assert resolve_res["thread"]["resolved"]

    # Merge conflict handler
    base = "---\nid: dir.foo\nseverity: advisory\n---\n# Foo\n"
    ours = "---\nid: dir.foo\nseverity: fatal_invariant\n---\n# Foo\n"
    theirs = "---\nid: dir.foo\nseverity: warning\n---\n# Foo\n"

    conflict_res = handle_get_merge_conflict(ws, base_text=base, ours_text=ours, theirs_text=theirs)
    assert not conflict_res["isClean"]
    assert len(conflict_res["fieldConflicts"]) == 1

    # Resolve conflict handler
    resolved_file = tmp_path / ".hrnx" / "nodes" / "dir.foo.md"
    resolve_out = handle_resolve_merge_conflict(
        ws,
        file_path=str(resolved_file),
        resolved_frontmatter={"id": "dir.foo", "severity": "fatal_invariant"},
        resolved_body="# Foo\nResolved content.",
    )
    assert resolve_out["success"]
    assert resolved_file.exists()
    assert "fatal_invariant" in resolved_file.read_text(encoding="utf-8")
