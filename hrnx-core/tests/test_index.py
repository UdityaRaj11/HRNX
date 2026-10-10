import pytest
from pathlib import Path

from hrnx.index import NodeCache, compute_sha256
from hrnx.models import Directive, Severity
from hrnx.parser import ParsedDocument


@pytest.mark.asyncio
async def test_node_cache_sync_and_async(tmp_path: Path):
    db_file = tmp_path / "cache.db"
    cache = NodeCache(db_file)

    node = Directive(
        id="dir.auth.rbac",
        title="Role-Based Access Control",
        severity=Severity.FATAL_INVARIANT,
        depends_on=["dir.auth.users"],
        body="Access control policies.",
    )
    doc = ParsedDocument(
        node=node,
        frontmatter_raw="id: dir.auth.rbac\ntitle: Role-Based Access Control",
        frontmatter_data={"id": "dir.auth.rbac"},
        body_raw="Access control policies.",
        frontmatter_lines=5,
        file_path="nodes/auth/rbac.md",
    )

    content = "test content"
    sha = compute_sha256(content)
    mtime = 123456.78

    # Initial check: file is changed (not in cache)
    assert cache.is_file_changed("nodes/auth/rbac.md", mtime, sha) is True

    # Upsert into cache
    cache.upsert_parsed_document(doc, mtime=mtime, sha256=sha)

    # Check file unchanged
    assert cache.is_file_changed("nodes/auth/rbac.md", mtime, sha) is False
    # If sha changes
    assert cache.is_file_changed("nodes/auth/rbac.md", mtime, "different_sha") is True

    # Sync lookup
    meta = cache.get_node_metadata("dir.auth.rbac")
    assert meta is not None
    assert meta["title"] == "Role-Based Access Control"
    assert meta["severity"] == "fatal_invariant"

    # Async lookup
    async_meta = await cache.get_node_metadata_async("dir.auth.rbac")
    assert async_meta is not None
    assert async_meta["id"] == "dir.auth.rbac"

    # Async search
    search_results = await cache.search_nodes_async("rbac")
    assert len(search_results) == 1
    assert search_results[0]["id"] == "dir.auth.rbac"

    # Remove file
    cache.remove_file("nodes/auth/rbac.md")
    assert cache.get_node_metadata("dir.auth.rbac") is None
