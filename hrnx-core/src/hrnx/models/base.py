from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class NodeType(str, Enum):
    DIRECTIVE = "directive"
    SKILL = "skill"
    TOOL = "tool"
    CONTEXT_SLICE = "context_slice"
    EVAL = "eval"
    ADR = "adr"


class Severity(str, Enum):
    FATAL_INVARIANT = "fatal_invariant"
    WARNING = "warning"
    ADVISORY = "advisory"


class NodeStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DEPRECATED = "deprecated"
    SUPERSEDED = "superseded"


class SourceLocation(BaseModel):
    file_path: str
    line: int = 1
    column: int = 1
    end_line: Optional[int] = None
    end_column: Optional[int] = None


class ProvenanceSignature(BaseModel):
    key_id: str
    signer: str
    timestamp: str
    signature: str


class TargetConfig(BaseModel):
    """Configuration overrides for a specific target AI coding agent."""
    model_config = ConfigDict(extra="allow")

    enabled: bool = True
    globs: List[str] = Field(default_factory=list)
    hook: Optional[str] = None
    mode: Optional[str] = None
    priority: Optional[int] = None
    custom_instructions: Optional[str] = None


class BaseNode(BaseModel):
    """Base model for all canonical HRNX harness nodes."""
    model_config = ConfigDict(extra="allow", validate_assignment=True)

    id: str = Field(description="Globally unique node identifier across the harness")
    title: str = Field(description="Human-readable title describing the node")
    type: NodeType = Field(description="Discriminator representing the node kind")
    status: str = Field(default="active", description="Lifecycle status of this node")
    body: str = Field(default="", description="Markdown body containing detailed specification")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary user or governance metadata")
    file_path: Optional[str] = Field(default=None, description="Local path to the node definition file")
    depends_on: List[str] = Field(default_factory=list, description="IDs of other nodes this node depends on")
    targets: Dict[str, TargetConfig] = Field(
        default_factory=dict,
        description="Target-specific agent configuration overrides (e.g. claude, antigravity, cursor)"
    )
    signatures: List[ProvenanceSignature] = Field(
        default_factory=list,
        description="Tamper-evident approval signatures"
    )

    def get_dependencies(self) -> List[str]:
        """Returns all referenced dependency IDs."""
        return list(dict.fromkeys(self.depends_on))
