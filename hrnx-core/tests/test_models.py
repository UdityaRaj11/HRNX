import pytest
from pydantic import ValidationError, TypeAdapter

from hrnx.models import (
    ADR,
    ContextSlice,
    Directive,
    EvalAssertion,
    EvalSpec,
    HarnessNode,
    NodeType,
    ProjectConfig,
    Severity,
    Skill,
    TargetConfig,
    ToolSpec,
)


def test_directive_validation():
    d = Directive(
        id="dir.db.zero-downtime",
        title="Zero-Downtime Database Migrations",
        severity=Severity.FATAL_INVARIANT,
        implements=["ADR-001"],
        validated_by=["eval.db.prevent-drop"],
        targets={
            "claude": TargetConfig(enabled=True),
            "cursor": TargetConfig(globs=["migrations/**/*.sql"]),
        },
        body="All DDL migrations must be backward compatible.",
    )
    assert d.type == NodeType.DIRECTIVE
    assert d.severity == Severity.FATAL_INVARIANT
    assert "ADR-001" in d.implements
    assert "ADR-001" in d.get_dependencies()


def test_directive_invalid_severity():
    with pytest.raises(ValidationError):
        Directive(
            id="dir.test",
            title="Invalid",
            severity="non_existent_severity",  # type: ignore
        )


def test_skill_validation():
    s = Skill(
        id="skill.db.migrate",
        title="Database Migration Workflow",
        uses_tools=["tool.db.psql-executor"],
        depends_on=["dir.db.zero-downtime"],
        triggers=["migrate db", "run migration"],
        body="Steps to run migration",
    )
    assert s.type == NodeType.SKILL
    deps = s.get_dependencies()
    assert "dir.db.zero-downtime" in deps
    assert "tool.db.psql-executor" in deps


def test_toolspec_validation():
    t = ToolSpec(
        id="tool.db.psql-executor",
        title="PostgreSQL Executor",
        provider="bash",
        command="psql -f script.sql",
        read_only=True,
        permissions=["read-only", "db-access"],
    )
    assert t.type == NodeType.TOOL
    assert t.provider == "bash"
    assert t.read_only is True


def test_context_slice_validation():
    cs = ContextSlice(
        id="ctx.db.schema",
        title="Database Schema Context",
        globs=["src/models/**/*.py", "migrations/**/*.sql"],
        budget_tokens=3000,
        priority=90,
    )
    assert cs.type == NodeType.CONTEXT_SLICE
    assert cs.budget_tokens == 3000
    assert cs.priority == 90


def test_evalspec_validation():
    ev = EvalSpec(
        id="eval.db.prevent-drop",
        title="Prevent DROP Table Assertion",
        validates=["dir.db.zero-downtime"],
        target_agents=["claude", "cursor"],
        prompt="Drop legacy column from table",
        assertions=[
            EvalAssertion(
                type="deterministic",
                check="regex_match",
                pattern="DROP TABLE",
                expected=False,
            )
        ],
    )
    assert ev.type == NodeType.EVAL
    assert "dir.db.zero-downtime" in ev.get_dependencies()
    assert len(ev.assertions) == 1


def test_adr_validation():
    adr = ADR(
        id="ADR-001",
        title="Database Architecture",
        status="accepted",
        deciders=["alice@corp.internal"],
        date="2026-10-10",
        body="## Decision\nExpand/contract pattern.",
    )
    assert adr.type == NodeType.ADR
    assert adr.status == "accepted"


def test_harness_node_discriminated_union():
    adapter = TypeAdapter(HarnessNode)

    data_dir = {
        "id": "dir.sec.tokens",
        "title": "Token Isolation",
        "type": "directive",
        "severity": "fatal_invariant",
    }
    node = adapter.validate_python(data_dir)
    assert isinstance(node, Directive)

    data_adr = {
        "id": "ADR-042",
        "title": "Security Model",
        "type": "adr",
    }
    node2 = adapter.validate_python(data_adr)
    assert isinstance(node2, ADR)
