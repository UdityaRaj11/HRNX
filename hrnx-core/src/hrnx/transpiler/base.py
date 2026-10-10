from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, List, Optional, Set
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from hrnx.models.schema import HarnessNode
    from hrnx.workspace import Workspace


class GeneratedArtifact(BaseModel):
    """Represents a compiled agent artifact file."""
    target: str
    path: str
    content: str
    description: str = ""


class CompatibilityDiagnostic(BaseModel):
    """Represents a feature gap or translation warning."""
    node_id: str
    target: str
    message: str
    severity: str = "warning"  # "warning" | "error" | "info"
    feature: str = ""          # e.g., "mcp", "subagents", "tools", "globs"
    lossy: bool = False        # True if canonical fidelity is reduced during compilation


class BaseAgentTranspiler(ABC):
    """Abstract base class for all agent adapters."""

    target_id: str
    target_name: str
    target_file: str = ""
    supported_primitives: Set[str] = {"directives", "skills", "tools", "evals", "adrs"}

    @abstractmethod
    def compile(self, workspace: Workspace) -> List[GeneratedArtifact]:
        """Transforms canonical workspace graph into target native configuration files."""
        ...

    @abstractmethod
    def preview_node(self, node: HarnessNode, workspace: Workspace) -> GeneratedArtifact:
        """Previews compilation of an individual node for real-time split view."""
        ...

    def validate_compatibility(self, node: HarnessNode) -> List[CompatibilityDiagnostic]:
        """Detects feature gaps or unsupported primitives."""
        return []
