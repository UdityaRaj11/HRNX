from __future__ import annotations

from pathlib import Path
from typing import Optional
import lsprotocol.types as lsp

from hrnx.server.hover import get_token_at_position
from hrnx.workspace import Workspace


def compute_definition(
    workspace: Workspace,
    doc_text: str,
    position: lsp.Position,
) -> Optional[lsp.Location]:
    """Computes Go-To-Definition location for a node ID referenced at the cursor."""
    lines = doc_text.splitlines()
    if position.line >= len(lines):
        return None

    line = lines[position.line]
    token = get_token_at_position(line, position.character)
    if not token:
        return None

    node = workspace.graph.get_node(token)
    if not node or not node.file_path:
        # Check cache if not loaded in memory
        cached_path = workspace.cache.get_file_path(token)
        if not cached_path:
            return None
        file_path_str = cached_path
    else:
        file_path_str = node.file_path

    target_path = Path(file_path_str).resolve()
    if not target_path.is_file():
        return None

    # Find the line containing "id: <token>"
    target_line = 0
    try:
        content = target_path.read_text(encoding="utf-8")
        for idx, l in enumerate(content.splitlines()):
            if f"id: {token}" in l or f"id: '{token}'" in l or f'id: "{token}"' in l:
                target_line = idx
                break
    except Exception:
        pass

    target_uri = target_path.as_uri()
    return lsp.Location(
        uri=target_uri,
        range=lsp.Range(
            start=lsp.Position(line=target_line, character=0),
            end=lsp.Position(line=target_line, character=len(token) + 4),
        ),
    )
