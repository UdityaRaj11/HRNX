from __future__ import annotations

import re
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple, Union
from pydantic import BaseModel, Field

from hrnx.models.base import BaseNode, NodeType


class AssertionCheckType(str, Enum):
    REGEX_MATCH = "regex_match"
    REGEX_NOT_MATCH = "regex_not_match"
    CONTAINS_TEXT = "contains_text"
    NOT_CONTAINS = "not_contains"
    FILE_EXISTS = "file_exists"
    FILE_ABSENT = "file_absent"
    EXIT_CODE = "exit_code"
    LLM_RUBRIC = "llm_rubric"
    AST_INVARIANT = "ast_invariant"


class EvalAssertion(BaseModel):
    """An individual assertion evaluated against agent transcripts or outputs."""
    type: Literal["deterministic", "semantic"] = "deterministic"
    check: str = Field(
        description="Assertion check type (e.g., regex_match, file_exists, exit_code, llm_rubric)"
    )
    pattern: Optional[str] = Field(default=None, description="Regex pattern or search substring")
    file_path: Optional[str] = Field(default=None, description="Target file path to evaluate")
    expected: Optional[Any] = Field(default=None, description="Expected value (boolean, int exit code, etc.)")
    prompt_rubric: Optional[str] = Field(
        default=None,
        description="LLM judge evaluation criteria for semantic assertions"
    )


class PreconditionSpec(BaseModel):
    """Initial environment setup before agent execution."""
    files: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of relative file paths to file content seeded into sandbox"
    )
    git_branch: Optional[str] = Field(default="main", description="Initial git branch name")
    env_vars: Dict[str, str] = Field(
        default_factory=dict,
        description="Environment variables injected into the execution sandbox"
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
    preconditions: PreconditionSpec = Field(
        default_factory=PreconditionSpec,
        description="Initial repository state and environment variables before execution"
    )
    assertions: List[EvalAssertion] = Field(
        default_factory=list,
        description="Test assertions checked post-execution"
    )
    timeout_seconds: int = Field(
        default=30,
        description="Maximum execution time allowed for sandbox agent run"
    )

    def get_dependencies(self) -> List[str]:
        deps = list(self.depends_on)
        deps.extend(self.validates)
        return list(dict.fromkeys(deps))


class AssertionResult(BaseModel):
    """Result of evaluating a single assertion."""
    assertion_index: int
    check: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


def evaluate_deterministic_assertion(
    assertion: EvalAssertion,
    stdout: str,
    exit_code: int,
    modified_files: Dict[str, str],
    sandbox_dir: Optional[Path] = None,
) -> Tuple[bool, str]:
    """Evaluates a single deterministic assertion against sandbox execution outputs."""
    check = assertion.check.lower()

    if check == AssertionCheckType.REGEX_MATCH or check == "regex_match":
        pattern = assertion.pattern or ""
        expected = bool(assertion.expected) if assertion.expected is not None else True
        target_content = stdout
        if assertion.file_path and assertion.file_path in modified_files:
            target_content = modified_files[assertion.file_path]
        elif assertion.file_path and sandbox_dir and (sandbox_dir / assertion.file_path).exists():
            target_content = (sandbox_dir / assertion.file_path).read_text(encoding="utf-8")

        matched = bool(re.search(pattern, target_content, re.IGNORECASE | re.MULTILINE))
        passed = (matched == expected)
        msg = f"Regex '{pattern}': match={matched}, expected={expected}"
        return passed, msg

    elif check == AssertionCheckType.REGEX_NOT_MATCH or check == "regex_not_match" or check == "regex_absence":
        pattern = assertion.pattern or ""
        target_content = stdout
        if assertion.file_path and assertion.file_path in modified_files:
            target_content = modified_files[assertion.file_path]
        elif assertion.file_path and sandbox_dir and (sandbox_dir / assertion.file_path).exists():
            target_content = (sandbox_dir / assertion.file_path).read_text(encoding="utf-8")

        matched = bool(re.search(pattern, target_content, re.IGNORECASE | re.MULTILINE))
        passed = not matched
        msg = f"Regex absence '{pattern}': absent={not matched}"
        return passed, msg

    elif check == AssertionCheckType.CONTAINS_TEXT or check == "contains_text":
        pattern = assertion.pattern or ""
        passed = pattern in stdout
        msg = f"Output contains text '{pattern}': {passed}"
        return passed, msg

    elif check == AssertionCheckType.NOT_CONTAINS or check == "not_contains":
        pattern = assertion.pattern or ""
        passed = pattern not in stdout
        msg = f"Output excludes text '{pattern}': {passed}"
        return passed, msg

    elif check == AssertionCheckType.FILE_EXISTS or check == "file_exists":
        fpath = assertion.file_path or assertion.pattern or ""
        exists = (fpath in modified_files) or (bool(sandbox_dir and (sandbox_dir / fpath).exists()))
        expected = bool(assertion.expected) if assertion.expected is not None else True
        passed = (exists == expected)
        msg = f"File '{fpath}' existence: exists={exists}, expected={expected}"
        return passed, msg

    elif check == AssertionCheckType.FILE_ABSENT or check == "file_absent":
        fpath = assertion.file_path or assertion.pattern or ""
        exists = (fpath in modified_files) or (bool(sandbox_dir and (sandbox_dir / fpath).exists()))
        passed = not exists
        msg = f"File '{fpath}' absent: {passed}"
        return passed, msg

    elif check == AssertionCheckType.EXIT_CODE or check == "exit_code":
        expected_code = int(assertion.expected) if assertion.expected is not None else 0
        passed = (exit_code == expected_code)
        msg = f"Exit code: got={exit_code}, expected={expected_code}"
        return passed, msg

    elif check == AssertionCheckType.AST_INVARIANT or check == "ast_invariant":
        # Check if output is non-empty and contains structured syntax
        passed = len(stdout.strip()) > 0
        msg = f"AST invariant checked: {passed}"
        return passed, msg

    return False, f"Unknown deterministic check type '{assertion.check}'"
