from __future__ import annotations

import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PeerInfo(BaseModel):
    """Represents a connected peer in a multiplayer session."""
    id: str
    name: str = "Anonymous"
    color: str = "#6366f1"
    active_node_id: Optional[str] = None
    cursor_position: Optional[Dict[str, int]] = None
    joined_at: float = Field(default_factory=time.time)


class DraftNode(BaseModel):
    """In-memory draft state of a node edited during live collaboration without saving to disk."""
    node_id: str
    title: Optional[str] = None
    updated_frontmatter: Dict[str, Any] = Field(default_factory=dict)
    body: Optional[str] = None
    modified_by: str = ""
    modified_at: float = Field(default_factory=time.time)


class RelaySession:
    """Manages ephemeral multi-user collaboration state for a specific workspace room."""

    def __init__(self, room_id: str = "main"):
        self.room_id = room_id
        self.peers: Dict[str, PeerInfo] = {}
        self.drafts: Dict[str, DraftNode] = {}

    def add_peer(self, peer: PeerInfo) -> None:
        self.peers[peer.id] = peer

    def remove_peer(self, peer_id: str) -> Optional[PeerInfo]:
        return self.peers.pop(peer_id, None)

    def get_peer(self, peer_id: str) -> Optional[PeerInfo]:
        return self.peers.get(peer_id)

    def update_presence(
        self,
        peer_id: str,
        active_node_id: Optional[str] = None,
        cursor_position: Optional[Dict[str, int]] = None,
    ) -> Optional[PeerInfo]:
        peer = self.peers.get(peer_id)
        if peer:
            if active_node_id is not None:
                peer.active_node_id = active_node_id
            if cursor_position is not None:
                peer.cursor_position = cursor_position
        return peer

    def update_draft(
        self,
        node_id: str,
        peer_id: str,
        frontmatter: Optional[Dict[str, Any]] = None,
        body: Optional[str] = None,
        title: Optional[str] = None,
    ) -> DraftNode:
        existing = self.drafts.get(node_id)
        fm = dict(existing.updated_frontmatter) if existing else {}
        if frontmatter:
            fm.update(frontmatter)

        b = body if body is not None else (existing.body if existing else None)
        t = title if title is not None else (existing.title if existing else None)

        draft = DraftNode(
            node_id=node_id,
            title=t,
            updated_frontmatter=fm,
            body=b,
            modified_by=peer_id,
            modified_at=time.time(),
        )
        self.drafts[node_id] = draft
        return draft

    def discard_draft(self, node_id: str) -> Optional[DraftNode]:
        return self.drafts.pop(node_id, None)

    def get_draft(self, node_id: str) -> Optional[DraftNode]:
        return self.drafts.get(node_id)

    def get_all_drafts(self) -> List[Dict[str, Any]]:
        return [d.model_dump() for d in self.drafts.values()]

    def get_all_peers(self) -> List[Dict[str, Any]]:
        return [p.model_dump() for p in self.peers.values()]

    def snapshot(self) -> Dict[str, Any]:
        return {
            "roomId": self.room_id,
            "peerCount": len(self.peers),
            "peers": self.get_all_peers(),
            "draftCount": len(self.drafts),
            "drafts": self.get_all_drafts(),
        }
