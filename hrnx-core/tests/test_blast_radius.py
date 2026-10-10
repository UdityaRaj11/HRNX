from hrnx.graph import BlastRadiusAnalyzer, HarnessGraph
from hrnx.models import ADR, Directive, EvalSpec, Severity, Skill, TargetConfig


def test_blast_radius_calculation():
    g = HarnessGraph()

    adr = ADR(id="ADR-001", title="Database Invariant Policy")
    inv = Directive(
        id="dir.db.zero-downtime",
        title="Zero Downtime Migrations",
        implements=["ADR-001"],
        severity=Severity.FATAL_INVARIANT,
        targets={"claude": TargetConfig(enabled=True), "cursor": TargetConfig(enabled=True)},
    )
    skill1 = Skill(
        id="skill.db.stage-migration",
        title="Stage Migration",
        depends_on=["dir.db.zero-downtime"],
    )
    skill2 = Skill(
        id="skill.db.execute-migration",
        title="Execute Migration",
        depends_on=["skill.db.stage-migration"],
    )
    eval1 = EvalSpec(
        id="eval.db.test-zero-downtime",
        title="Eval Zero Downtime",
        validates=["dir.db.zero-downtime"],
    )
    eval2 = EvalSpec(
        id="eval.db.test-executor",
        title="Eval Executor",
        validates=["skill.db.execute-migration"],
    )

    g.add_node(adr)
    g.add_node(inv)
    g.add_node(skill1)
    g.add_node(skill2)
    g.add_node(eval1)
    g.add_node(eval2)
    g.build_edges_from_nodes()

    analyzer = BlastRadiusAnalyzer(g)
    report = analyzer.calculate("dir.db.zero-downtime")

    assert "dir.db.zero-downtime" in report.origin_nodes
    assert "skill.db.stage-migration" in report.direct_dependents
    assert "skill.db.execute-migration" in report.transitive_dependents

    # Evals validating any affected node must be included
    assert "eval.db.test-zero-downtime" in report.impacted_evals
    assert "eval.db.test-executor" in report.impacted_evals

    # Invariants
    assert "dir.db.zero-downtime" in report.impacted_fatal_invariants
    assert report.is_fatal_risk is True

    # Affected targets
    assert "claude" in report.affected_targets
    assert "cursor" in report.affected_targets
    assert report.total_blast_radius >= 4
