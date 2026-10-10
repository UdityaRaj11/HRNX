"""
HRNX: The AI-Native Harness Engineering IDE
Core Engine & Backend Architecture
"""

from hrnx.models import (
    ADR,
    BaseNode,
    ContextSlice,
    Directive,
    EvalAssertion,
    EvalSpec,
    HarnessNode,
    NodeStatus,
    NodeType,
    ProjectConfig,
    ProvenanceSignature,
    Severity,
    Skill,
    SourceLocation,
    TargetConfig,
    ToolSpec,
)
from hrnx.parser import (
    BodyReference,
    FrontmatterParser,
    ParseDiagnostic,
    ParsedDocument,
)
from hrnx.graph import (
    BlastRadiusAnalyzer,
    BlastRadiusReport,
    CycleDetectedError,
    DanglingReference,
    EdgeMetadata,
    EdgeType,
    HarnessGraph,
)
from hrnx.index import NodeCache, compute_sha256
from hrnx.workspace import Workspace, WorkspaceCheckReport

__version__ = "0.1.0"

__all__ = [
    "ADR",
    "BaseNode",
    "ContextSlice",
    "Directive",
    "EvalAssertion",
    "EvalSpec",
    "HarnessNode",
    "NodeStatus",
    "NodeType",
    "ProjectConfig",
    "ProvenanceSignature",
    "Severity",
    "Skill",
    "SourceLocation",
    "TargetConfig",
    "ToolSpec",
    "BodyReference",
    "FrontmatterParser",
    "ParseDiagnostic",
    "ParsedDocument",
    "BlastRadiusAnalyzer",
    "BlastRadiusReport",
    "CycleDetectedError",
    "DanglingReference",
    "EdgeMetadata",
    "EdgeType",
    "HarnessGraph",
    "NodeCache",
    "compute_sha256",
    "Workspace",
    "WorkspaceCheckReport",
    "__version__",
]
