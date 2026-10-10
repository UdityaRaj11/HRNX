from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CommentReply(BaseModel):
    id: str = Field(default_factory=lambda: f"rep_{uuid.uuid4().hex[:8]}")
    author: str = "Anonymous"
    author_color: str = "#6366f1"
    text: str
    created_at: float = Field(default_factory=time.time)


class CommentThread(BaseModel):
    id: str = Field(default_factory=lambda: f"com_{uuid.uuid4().hex[:8]}")
    node_id: str
    author: str = "Anonymous"
    author_color: str = "#6366f1"
    text: str
    resolved: bool = False
    created_at: float = Field(default_factory=time.time)
    replies: List[CommentReply] = Field(default_factory=list)


class CommentStore:
    """Persistent storage for multiplayer live review comments and annotations."""

    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root
        self.cache_dir = workspace_root / ".hrnx" / ".cache"
        self.comments_file = self.cache_dir / "comments.json"
        self._threads: Dict[str, CommentThread] = {}
        self._load()

    def _load(self) -> None:
        if not self.comments_file.exists():
            return
        try:
            content = self.comments_file.read_text(encoding="utf-8")
            data = json.loads(content)
            for item in data.get("threads", []):
                thread = CommentThread.model_validate(item)
                self._threads[thread.id] = thread
        except Exception:
            self._threads = {}

    def _save(self) -> None:
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "1.0",
            "threads": [t.model_dump() for t in self._threads.values()],
        }
        self.comments_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def get_comments(self, node_id: Optional[str] = None) -> List[CommentThread]:
        if node_id:
            return [t for t in self._threads.values() if t.node_id == node_id]
        return list(self._threads.values())

    def add_comment(
        self,
        node_id: str,
        author: str,
        text: str,
        author_color: str = "#6366f1",
    ) -> CommentThread:
        thread = CommentThread(
            node_id=node_id,
            author=author,
            author_color=author_color,
            text=text,
        )
        self._threads[thread.id] = thread
        self._save()
        return thread

    def add_reply(
        self,
        thread_id: str,
        author: str,
        text: str,
        author_color: str = "#6366f1",
    ) -> Optional[CommentReply]:
        thread = self._threads.get(thread_id)
        if not thread:
            return None
        reply = CommentReply(author=author, author_color=author_color, text=text)
        thread.replies.append(reply)
        self._save()
        return reply

    def resolve_thread(self, thread_id: str, resolved: bool = True) -> Optional[CommentThread]:
        thread = self._threads.get(thread_id)
        if not thread:
            return None
        thread.resolved = resolved
        self._save()
        return thread

    def delete_thread(self, thread_id: str) -> bool:
        if thread_id in self._threads:
            del self._threads[thread_id]
            self._save()
            return True
        return False
