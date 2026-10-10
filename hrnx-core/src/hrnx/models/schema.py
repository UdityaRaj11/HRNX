from __future__ import annotations

from typing import Annotated, Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, ConfigDict

from hrnx.models.base import BaseNode, NodeType, Severity, TargetConfig, NodeStatus


class Directive(BaseNode):
    """Architectural invariant, constraint, or coding policy."""
    type: Literal[NodeType.DIRECTIVE] = NodeType.DIRECTIVE
    severity: Severity = Field(
        default=Severity.FATAL_INVARIANT,
        description="Enforcement level (fatal_invariant halts compilation on violation)"
    )
    implements: List[str] = Field(
        default_factory=list,
        description="IDs of Architectural Decision Records (ADRs) this directive implements"
    )
    validated_by: List[str] = Field(
        default_factory=list,
        description="IDs of EvalSpec nodes that assert compliance for this directive"
    )
    overrides: List[str] = Field(
        default_factory=list,
        description="IDs of superseded or overridden directives"
    )
    scope: List[str] = Field(
        default_factory=list,
        description="Context slices or repository paths to which this directive applies"
    )
    rationale: Optional[str] = Field(
        default=None,
        description="Architectural rationale or justification for why this invariant exists"
    )

    def get_dependencies(self) -> List[str]:
        deps = list(self.depends_on)
        deps.extend(self.implements)
        deps.extend(self.overrides)
        return list(dict.fromkeys(deps))


class Skill(BaseNode):
    """Procedural workflow, recipe, or multi-step agent runbook."""
    type: Literal[NodeType.SKILL] = NodeType.SKILL
    uses_tools: List[str] = Field(
        default_factory=list,
        description="IDs of ToolSpec nodes invoked during this skill execution"
    )
    implements: List[str] = Field(
        default_factory=list,
        description="IDs of ADRs this workflow implements"
    )
    validated_by: List[str] = Field(
        default_factory=list,
        description="IDs of EvalSpec nodes validating this skill"
    )
    triggers: List[str] = Field(
        default_factory=list,
        description="Natural language phrases or intent tokens that activate this skill"
    )
    preconditions: List[str] = Field(
        default_factory=list,
        description="Requirements that must hold before this skill is executed"
    )

    def get_dependencies(self) -> List[str]:
        deps = list(self.depends_on)
        deps.extend(self.uses_tools)
        deps.extend(self.implements)
        return list(dict.fromkeys(deps))


class ToolSpec(BaseNode):
    """Tool, function calling, or Model Context Protocol (MCP) declaration."""
    type: Literal[NodeType.TOOL] = NodeType.TOOL
    provider: Literal["bash", "mcp", "python", "http", "native"] = Field(
        default="bash",
        description="Execution runtime provider for the tool"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="JSON Schema describing input parameters"
    )
    command: Optional[str] = Field(
        default=None,
        description="CLI command template or bash executable script"
    )
    mcp_server: Optional[str] = Field(
        default=None,
        description="Target MCP server name if provider is 'mcp'"
    )
    permissions: List[str] = Field(
        default_factory=list,
        description="Sandboxed permission boundaries required (e.g. read-only, network)"
    )
    read_only: bool = Field(
        default=True,
        description="Flag indicating if the tool has zero mutating side-effects"
    )


class ContextSlice(BaseNode):
    """File glob scoping, token budgeting, and dynamic context injection rule."""
    type: Literal[NodeType.CONTEXT_SLICE] = NodeType.CONTEXT_SLICE
    globs: List[str] = Field(
        default_factory=list,
        description="File pattern globs for selective rule activation (e.g. src/**/*.py)"
    )
    budget_tokens: Optional[int] = Field(
        default=None,
        description="Upper token ceiling allocated for this context slice"
    )
    priority: int = Field(
        default=50,
        description="Priority ranking for context allocation (1 = lowest, 100 = highest)"
    )


class EvalAssertion(BaseModel):
    """An individual assertion evaluated against agent transcripts or outputs."""
    type: Literal["deterministic", "semantic"] = "deterministic"
    check: str = Field(
        description="Assertion type: regex_match, file_exists, exit_code, llm_rubric"
    )
    pattern: Optional[str] = Field(default=None, description="Regex pattern or file path")
    expected: Optional[Any] = Field(default=None, description="Expected value")
    prompt_rubric: Optional[str] = Field(
        default=None,
        description="LLM judge evaluation criteria for semantic assertions"
    )


class EvalSpec(BaseNode):
    """Automated evaluation bench and regression test suite for harnesses."""
    type: Literal[NodeType.EVAL] = NodeType.EVAL
    validates: List[str] = Field(
        default_factory=list,
        description="IDs of directives or skills this evaluation suite verifies"
    )
    target_agents: List[str] = Field(
        default_factory=lambda: ["claude", "antigravity", "codex", "cursor"],
        description="Target coding agents to run this evaluation against"
    )
    prompt: str = Field(
        default="",
        description="Synthetic user prompt dispatched to the agent in the test sandbox"
    )
    preconditions: Dict[str, Any] = Field(
        default_factory=dict,
        description="Initial repository state and environment variables before execution"
    )
    assertions: List[EvalAssertion] = Field(
        default_factory=list,
        description="Test assertions checked post-execution"
    )

    def get_dependencies(self) -> List[str]:
        deps = list(self.depends_on)
        deps.extend(self.validates)
        return list(dict.fromkeys(deps))


class ADR(BaseNode):
    """Architectural Decision Record capturing durable engineering rationale."""
    type: Literal[NodeType.ADR] = NodeType.ADR
    status: str = Field(
        default="accepted",
        description="Status of the architectural decision (proposed, accepted, superseded)"
    )
    deciders: List[str] = Field(
        default_factory=list,
        description="List of engineering stakeholders who authored or approved this ADR"
    )
    date: Optional[str] = Field(default=None, description="ISO Date string of decision")
    supersedes: Optional[str] = Field(default=None, description="ADR ID superseded by this decision")
    superseded_by: Optional[str] = Field(default=None, description="ADR ID that supersedes this decision")

    def get_dependencies(self) -> List[str]:
        deps = list(self.depends_on)
        if self.supersedes:
            deps.append(self.supersedes)
        return list(dict.fromkeys(deps))


HarnessNode = Annotated[
    Union[Directive, Skill, ToolSpec, ContextSlice, EvalSpec, ADR],
    Field(discriminator="type")
]


class ProjectConfig(BaseModel):
    """Global configuration for a HRNX repository (.hrnx/config.yaml)."""
    model_config = ConfigDict(extra="allow")

    version: str = "1.0"
    name: str = "hrnx-project"
    description: Optional[str] = None
    active_targets: List[str] = Field(
        default_factory=lambda: ["claude", "antigravity", "codex", "cursor", "copilot"]
    )
    nodes_dir: str = ".hrnx/nodes"
    adrs_dir: str = ".hrnx/adrs"
    evals_dir: str = ".hrnx/evals"
    cache_db: str = ".hrnx/cache.db"
    strict_mode: bool = True
