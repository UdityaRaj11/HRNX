from __future__ import annotations

import difflib
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from pydantic import BaseModel

from hrnx.transpiler.base import BaseAgentTranspiler, CompatibilityDiagnostic, GeneratedArtifact
from hrnx.transpiler.claude import ClaudeTranspiler
from hrnx.transpiler.antigravity import AntigravityTranspiler
from hrnx.transpiler.codex import CodexTranspiler
from hrnx.transpiler.cursor import CursorTranspiler
from hrnx.transpiler.copilot import CopilotTranspiler
from hrnx.transpiler.openhands import OpenHandsTranspiler
from hrnx.transpiler.aider import AiderTranspiler
from hrnx.transpiler.cline import ClineTranspiler
from hrnx.transpiler.windsurf import WindsurfTranspiler
from hrnx.transpiler.goose import GooseTranspiler

if TYPE_CHECKING:
    from hrnx.models.schema import HarnessNode
    from hrnx.workspace import Workspace


class DriftStatus(BaseModel):
    target: str
    relative_path: str
    absolute_path: str
    status: str  # "in_sync" | "drifted" | "missing"
    diff: Optional[str] = None
    expected_content: str = ""
    disk_content: str = ""


class TranspilerRegistry:
    def __init__(self):
        self._transpilers: Dict[str, BaseAgentTranspiler] = {}
        self.register(ClaudeTranspiler())
        self.register(AntigravityTranspiler())
        self.register(CodexTranspiler())
        self.register(CursorTranspiler())
        self.register(CopilotTranspiler())
        self.register(OpenHandsTranspiler())
        self.register(AiderTranspiler())
        self.register(ClineTranspiler())
        self.register(WindsurfTranspiler())
        self.register(GooseTranspiler())

    def register(self, transpiler: BaseAgentTranspiler):
        self._transpilers[transpiler.target_id] = transpiler

    def get(self, target_id: str) -> Optional[BaseAgentTranspiler]:
        return self._transpilers.get(target_id)

    def list_targets(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": t.target_id,
                "name": t.target_name,
                "file": getattr(t, "target_file", ""),
                "supportedPrimitives": list(t.supported_primitives),
            }
            for t in self._transpilers.values()
        ]

    def validate_compatibility(self, node: HarnessNode, target_id: str) -> List[CompatibilityDiagnostic]:
        transpiler = self.get(target_id)
        if not transpiler:
            return []
        return transpiler.validate_compatibility(node)

    def compile_all(self, workspace: Workspace) -> List[GeneratedArtifact]:
        artifacts: List[GeneratedArtifact] = []
        for transpiler in self._transpilers.values():
            artifacts.extend(transpiler.compile(workspace))
        return artifacts

    def preview_node(self, node: HarnessNode, target_id: str, workspace: Workspace) -> Optional[GeneratedArtifact]:
        transpiler = self.get(target_id)
        if not transpiler:
            return None
        return transpiler.preview_node(node, workspace)

    def inspect_drift(self, workspace: Workspace) -> List[DriftStatus]:
        results: List[DriftStatus] = []
        artifacts = self.compile_all(workspace)

        for art in artifacts:
            file_path = workspace.root_dir / art.path
            if not file_path.exists():
                results.append(
                    DriftStatus(
                        target=art.target,
                        relative_path=art.path,
                        absolute_path=str(file_path),
                        status="missing",
                        expected_content=art.content,
                        disk_content="",
                    )
                )
            else:
                disk_content = file_path.read_text(encoding="utf-8")
                if disk_content.strip() == art.content.strip():
                    results.append(
                        DriftStatus(
                            target=art.target,
                            relative_path=art.path,
                            absolute_path=str(file_path),
                            status="in_sync",
                            expected_content=art.content,
                            disk_content=disk_content,
                        )
                    )
                else:
                    diff_lines = list(
                        difflib.unified_diff(
                            disk_content.splitlines(keepends=True),
                            art.content.splitlines(keepends=True),
                            fromfile=f"disk/{art.path}",
                            tofile=f"canonical/{art.path}",
                        )
                    )
                    diff_text = "".join(diff_lines)
                    results.append(
                        DriftStatus(
                            target=art.target,
                            relative_path=art.path,
                            absolute_path=str(file_path),
                            status="drifted",
                            diff=diff_text,
                            expected_content=art.content,
                            disk_content=disk_content,
                        )
                    )
        return results

    def reconcile(self, workspace: Workspace, target_id: Optional[str] = None) -> List[str]:
        written: List[str] = []
        artifacts = self.compile_all(workspace)
        for art in artifacts:
            if target_id and art.target != target_id:
                continue
            file_path = workspace.root_dir / art.path
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(art.content, encoding="utf-8")
            written.append(str(file_path))
        return written


default_registry = TranspilerRegistry()
