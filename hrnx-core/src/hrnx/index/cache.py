from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
import aiosqlite

from hrnx.graph.edges import EdgeType
from hrnx.models.schema import Directive, HarnessNode
from hrnx.parser.ast import ParsedDocument


def compute_sha256(content: str) -> str:
    """Computes SHA-256 hash of text content."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    severity TEXT,
    file_path TEXT NOT NULL,
    mtime REAL NOT NULL,
    sha256 TEXT NOT NULL,
    raw_frontmatter TEXT,
    body_snippet TEXT,
    last_parsed_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS dependencies (
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    PRIMARY KEY (source_id, target_id, edge_type)
);

CREATE TABLE IF NOT EXISTS body_refs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    line INTEGER NOT NULL,
    col_start INTEGER NOT NULL,
    col_end INTEGER NOT NULL,
    raw_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_file_path ON nodes(file_path);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_deps_target ON dependencies(target_id);
CREATE INDEX IF NOT EXISTS idx_body_refs_target ON body_refs(target_id);
"""


class NodeCache:
    """
    High-performance SQLite cache with WAL mode.
    Provides sub-millisecond lookup and incremental change detection.
    """

    def __init__(self, db_path: Path | str):
        self.db_path = Path(db_path).resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_sync()

    def _init_sync(self) -> None:
        """Initializes tables synchronously."""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(SCHEMA_SQL)
            conn.commit()

    # =========================================================================
    # Synchronous API (for CLI operations)
    # =========================================================================

    def is_file_changed(self, file_path: str, mtime: float, sha256: str) -> bool:
        """Checks if a file needs re-parsing based on mtime and sha256."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT mtime, sha256 FROM nodes WHERE file_path = ?",
                (file_path,),
            ).fetchone()
            if not row:
                return True
            cached_mtime, cached_sha = row
            if abs(cached_mtime - mtime) < 1e-4 and cached_sha == sha256:
                return False
            return True

    def upsert_parsed_document(self, doc: ParsedDocument, mtime: float, sha256: str) -> None:
        """Updates the cache entry for a parsed document."""
        if not doc.node:
            return

        node = doc.node
        severity = getattr(node, "severity", None)
        severity_val = severity.value if severity else None
        body_snippet = (node.body or "")[:300]

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            # Upsert node
            cursor.execute(
                """
                INSERT INTO nodes (
                    id, title, type, status, severity, file_path,
                    mtime, sha256, raw_frontmatter, body_snippet, last_parsed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    type=excluded.type,
                    status=excluded.status,
                    severity=excluded.severity,
                    file_path=excluded.file_path,
                    mtime=excluded.mtime,
                    sha256=excluded.sha256,
                    raw_frontmatter=excluded.raw_frontmatter,
                    body_snippet=excluded.body_snippet,
                    last_parsed_at=datetime('now')
                """,
                (
                    node.id,
                    node.title,
                    node.type.value if hasattr(node.type, "value") else str(node.type),
                    node.status,
                    severity_val,
                    doc.file_path or "",
                    mtime,
                    sha256,
                    doc.frontmatter_raw,
                    body_snippet,
                ),
            )

            # Clear old deps & body refs for this node
            cursor.execute("DELETE FROM dependencies WHERE source_id = ?", (node.id,))
            cursor.execute("DELETE FROM body_refs WHERE source_id = ?", (node.id,))

            # Insert dependencies
            deps = []
            for dep in node.depends_on:
                deps.append((node.id, dep, EdgeType.DEPENDS_ON.value))
            if isinstance(node, Directive):
                for adr in node.implements:
                    deps.append((node.id, adr, EdgeType.IMPLEMENTS.value))
                for ev in node.validated_by:
                    deps.append((node.id, ev, EdgeType.VALIDATED_BY.value))
                for ov in node.overrides:
                    deps.append((node.id, ov, EdgeType.OVERRIDES.value))

            if deps:
                cursor.executemany(
                    "INSERT OR IGNORE INTO dependencies (source_id, target_id, edge_type) VALUES (?, ?, ?)",
                    deps,
                )

            # Insert body references
            if doc.body_references:
                ref_rows = [
                    (node.id, r.target_id, r.line, r.col_start, r.col_end, r.raw_text)
                    for r in doc.body_references
                ]
                cursor.executemany(
                    """
                    INSERT INTO body_refs (source_id, target_id, line, col_start, col_end, raw_text)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    ref_rows,
                )

            conn.commit()

    def remove_file(self, file_path: str) -> None:
        """Removes all cache entries associated with a deleted file."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            rows = cursor.execute("SELECT id FROM nodes WHERE file_path = ?", (file_path,)).fetchall()
            for (node_id,) in rows:
                cursor.execute("DELETE FROM dependencies WHERE source_id = ?", (node_id,))
                cursor.execute("DELETE FROM body_refs WHERE source_id = ?", (node_id,))
            cursor.execute("DELETE FROM nodes WHERE file_path = ?", (file_path,))
            conn.commit()

    def get_node_metadata(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Fast synchronous node metadata lookup."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)).fetchone()
            if row:
                return dict(row)
            return None

    def get_file_path(self, node_id: str) -> Optional[str]:
        """Returns the file path defining a node."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT file_path FROM nodes WHERE id = ?", (node_id,)).fetchone()
            if row:
                return row[0]
            return None

    def get_all_node_ids(self) -> List[str]:
        """Returns all cached node IDs."""
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute("SELECT id FROM nodes ORDER BY id ASC").fetchall()
            return [r[0] for r in rows]

    # =========================================================================
    # Asynchronous API (for LSP server / daemon)
    # =========================================================================

    async def get_node_metadata_async(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Asynchronous node metadata lookup."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM nodes WHERE id = ?", (node_id,)) as cursor:
                row = await cursor.fetchone()
                if row:
                    return dict(row)
                return None

    async def get_all_node_ids_async(self) -> List[str]:
        """Asynchronously returns all node IDs."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT id FROM nodes ORDER BY id ASC") as cursor:
                rows = await cursor.fetchall()
                return [r[0] for r in rows]

    async def search_nodes_async(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Asynchronous prefix or substring search for autocomplete."""
        pattern = f"%{query}%"
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT id, title, type, status, severity, file_path FROM nodes WHERE id LIKE ? OR title LIKE ? LIMIT ?",
                (pattern, pattern, limit),
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(r) for r in rows]
