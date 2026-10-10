from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Set
import websockets

from hrnx.relay.comments import CommentStore
from hrnx.relay.session import PeerInfo, RelaySession
from hrnx.workspace import Workspace

logger = logging.getLogger("hrnx.relay")


class RelayServer:
    """Multiplayer WebSocket relay server enabling live peer collaboration on HRNX harnesses."""

    def __init__(
        self,
        workspace_root: Path,
        host: str = "127.0.0.1",
        port: int = 8765,
        room_id: str = "main",
    ):
        self.workspace_root = workspace_root
        self.host = host
        self.port = port
        self.room_id = room_id
        self.session = RelaySession(room_id=room_id)
        self.comment_store = CommentStore(workspace_root)
        self.clients: Dict[Any, str] = {}  # websocket -> peer_id
        self._server = None
        self._is_running = False

    async def start(self) -> None:
        """Starts the WebSocket relay server."""
        if self._is_running:
            return
        self._server = await websockets.serve(self._handle_client, self.host, self.port)
        self._is_running = True
        logger.info(f"HRNX Relay started at ws://{self.host}:{self.port} (Room: {self.room_id})")

    async def stop(self) -> None:
        """Stops the relay server and closes all peer connections."""
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        self._is_running = False
        self.clients.clear()
        logger.info("HRNX Relay stopped.")

    @property
    def is_running(self) -> bool:
        return self._is_running

    async def broadcast(self, message: Dict[str, Any], exclude_ws: Optional[Any] = None) -> None:
        """Broadcasts a JSON message to all connected peers except exclude_ws."""
        payload = json.dumps(message)
        tasks = []
        for ws in list(self.clients.keys()):
            if ws != exclude_ws:
                tasks.append(ws.send(payload))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _handle_client(self, websocket: Any) -> None:
        peer_id: Optional[str] = None
        try:
            async for raw_msg in websocket:
                try:
                    data = json.loads(raw_msg)
                except Exception:
                    continue

                msg_type = data.get("type")

                if msg_type == "join":
                    peer_id = data.get("peerId") or f"peer_{id(websocket)}"
                    name = data.get("name", "Anonymous Engineer")
                    color = data.get("color", "#6366f1")
                    peer = PeerInfo(id=peer_id, name=name, color=color)
                    self.session.add_peer(peer)
                    self.clients[websocket] = peer_id

                    # Send snapshot of current session & comments to joined peer
                    all_comments = [t.model_dump() for t in self.comment_store.get_comments()]
                    init_payload = {
                        "type": "init_state",
                        "session": self.session.snapshot(),
                        "comments": all_comments,
                        "yourPeerId": peer_id,
                    }
                    await websocket.send(json.dumps(init_payload))

                    # Broadcast peer_joined to other peers
                    await self.broadcast(
                        {"type": "peer_joined", "peer": peer.model_dump()},
                        exclude_ws=websocket,
                    )

                elif msg_type == "presence":
                    if peer_id:
                        node_id = data.get("activeNodeId")
                        cursor = data.get("cursorPosition")
                        updated = self.session.update_presence(peer_id, node_id, cursor)
                        if updated:
                            await self.broadcast(
                                {"type": "peer_presence", "peer": updated.model_dump()},
                                exclude_ws=websocket,
                            )

                elif msg_type == "draft_update":
                    node_id = data.get("nodeId")
                    if node_id and peer_id:
                        fm = data.get("frontmatter", {})
                        body = data.get("body")
                        title = data.get("title")
                        draft = self.session.update_draft(
                            node_id=node_id,
                            peer_id=peer_id,
                            frontmatter=fm,
                            body=body,
                            title=title,
                        )
                        await self.broadcast(
                            {"type": "draft_updated", "draft": draft.model_dump()},
                            exclude_ws=None,
                        )

                elif msg_type == "draft_discard":
                    node_id = data.get("nodeId")
                    if node_id:
                        self.session.discard_draft(node_id)
                        await self.broadcast(
                            {"type": "draft_discarded", "nodeId": node_id},
                            exclude_ws=None,
                        )

                elif msg_type == "draft_promote":
                    node_id = data.get("nodeId")
                    if node_id:
                        draft = self.session.get_draft(node_id)
                        if draft:
                            # Write draft changes to disk
                            self._promote_draft_to_disk(draft)
                            self.session.discard_draft(node_id)
                            await self.broadcast(
                                {
                                    "type": "draft_promoted",
                                    "nodeId": node_id,
                                    "promotedBy": peer_id or "user",
                                },
                                exclude_ws=None,
                            )

                elif msg_type == "comment_add":
                    node_id = data.get("nodeId", "")
                    text = data.get("text", "")
                    author = data.get("author", "Anonymous")
                    author_color = data.get("authorColor", "#6366f1")
                    if node_id and text:
                        thread = self.comment_store.add_comment(
                            node_id=node_id,
                            author=author,
                            text=text,
                            author_color=author_color,
                        )
                        await self.broadcast(
                            {"type": "comment_added", "thread": thread.model_dump()},
                            exclude_ws=None,
                        )

                elif msg_type == "comment_reply":
                    thread_id = data.get("threadId", "")
                    text = data.get("text", "")
                    author = data.get("author", "Anonymous")
                    author_color = data.get("authorColor", "#6366f1")
                    if thread_id and text:
                        reply = self.comment_store.add_reply(
                            thread_id=thread_id,
                            author=author,
                            text=text,
                            author_color=author_color,
                        )
                        if reply:
                            await self.broadcast(
                                {
                                    "type": "comment_replied",
                                    "threadId": thread_id,
                                    "reply": reply.model_dump(),
                                },
                                exclude_ws=None,
                            )

                elif msg_type == "comment_resolve":
                    thread_id = data.get("threadId", "")
                    resolved = bool(data.get("resolved", True))
                    thread = self.comment_store.resolve_thread(thread_id, resolved)
                    if thread:
                        await self.broadcast(
                            {"type": "comment_resolved", "thread": thread.model_dump()},
                            exclude_ws=None,
                        )

                elif msg_type == "get_state":
                    all_comments = [t.model_dump() for t in self.comment_store.get_comments()]
                    await websocket.send(
                        json.dumps({
                            "type": "state_response",
                            "session": self.session.snapshot(),
                            "comments": all_comments,
                        })
                    )

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.clients:
                p_id = self.clients.pop(websocket)
                removed = self.session.remove_peer(p_id)
                if removed:
                    await self.broadcast({"type": "peer_left", "peerId": p_id})

    def _promote_draft_to_disk(self, draft) -> None:
        """Applies in-memory draft frontmatter and markdown body to the actual disk file."""
        ws = Workspace(self.workspace_root)
        ws.load_all()
        node = ws.graph.get_node(draft.node_id)
        if not node:
            return

        file_path = getattr(node, "file_path", None)
        if not file_path:
            return

        target_file = Path(file_path)
        if not target_file.exists():
            return

        # Parse existing node
        parsed = ws.parser.parse_file(target_file)
        if not parsed.node:
            return

        # Update properties
        for k, v in draft.updated_frontmatter.items():
            if hasattr(parsed.node, k):
                setattr(parsed.node, k, v)

        if draft.body is not None:
            parsed.node.body = draft.body

        # Reserialize
        serialized = ws.parser.serialize(parsed.node)
        target_file.write_text(serialized, encoding="utf-8")
        ws.reload_file(target_file)
