import pytest
from hrnx.graph import CycleDetectedError, HarnessGraph
from hrnx.models import ADR, Directive, EvalSpec, NodeType, Severity, Skill, ToolSpec


def test_graph_building_and_dependencies():
    g = HarnessGraph()

    adr = ADR(id="ADR-001", title="ADR DB", status="accepted")
    dir_node = Directive(
        id="dir.db.zero-downtime",
        title="Zero Downtime",
        implements=["ADR-001"],
        severity=Severity.FATAL_INVARIANT,
    )
    tool = ToolSpec(id="tool.psql", title="PSQL Executor")
    skill = Skill(
        id="skill.db.migrate",
        title="Migrate DB",
        depends_on=["dir.db.zero-downtime"],
        uses_tools=["tool.psql"],
    )

    g.add_node(adr)
    g.add_node(dir_node)
    g.add_node(tool)
    g.add_node(skill)
    g.build_edges_from_nodes()

    # skill depends on dir.db.zero-downtime and tool.psql
    skill_deps = g.get_dependencies("skill.db.migrate")
    assert "dir.db.zero-downtime" in skill_deps
    assert "tool.psql" in skill_deps

    # dir.db.zero-downtime has skill as dependent
    dir_dependents = g.get_dependents("dir.db.zero-downtime")
    assert "skill.db.migrate" in dir_dependents

    # Topological sorting (independent nodes must come before dependent ones)
    order = g.topological_sort()
    assert order.index("dir.db.zero-downtime") < order.index("skill.db.migrate")
    assert order.index("tool.psql") < order.index("skill.db.migrate")


def test_cycle_detection():
    g = HarnessGraph()

    node_a = Directive(id="dir.a", title="A", depends_on=["dir.b"])
    node_b = Directive(id="dir.b", title="B", depends_on=["dir.c"])
    node_c = Directive(id="dir.c", title="C", depends_on=["dir.a"])

    g.add_node(node_a)
    g.add_node(node_b)
    g.add_node(node_c)
    g.build_edges_from_nodes()

    cycles = g.detect_cycles()
    assert len(cycles) > 0
    cycle_nodes = set(cycles[0])
    assert {"dir.a", "dir.b", "dir.c"}.issubset(cycle_nodes)

    with pytest.raises(CycleDetectedError):
        g.topological_sort()


def test_dangling_references():
    g = HarnessGraph()

    node = Directive(
        id="dir.auth",
        title="Auth",
        depends_on=["dir.missing_dep"],
        implements=["ADR-999"],
    )
    g.add_node(node)
    g.build_edges_from_nodes()

    dangling = g.find_dangling_references()
    target_ids = [d.target_id for d in dangling]
    assert "dir.missing_dep" in target_ids
    assert "ADR-999" in target_ids


def test_adr_coverage():
    g = HarnessGraph()

    adr1 = ADR(id="ADR-001", title="ADR 1", status="accepted")
    adr2 = ADR(id="ADR-002", title="ADR 2 (Unimplemented)", status="accepted")
    dir_node = Directive(id="dir.foo", title="Foo", implements=["ADR-001"])

    g.add_node(adr1)
    g.add_node(adr2)
    g.add_node(dir_node)
    g.build_edges_from_nodes()

    cov = g.get_adr_coverage()
    assert cov["ADR-001"] == ["dir.foo"]
    assert cov["ADR-002"] == []


def test_to_mermaid():
    g = HarnessGraph()
    d = Directive(id="dir.a", title="Directive A")
    s = Skill(id="skill.b", title="Skill B", depends_on=["dir.a"])
    g.add_node(d)
    g.add_node(s)
    g.build_edges_from_nodes()

    mermaid = g.to_mermaid()
    assert "flowchart TD" in mermaid
    assert "dir_a" in mermaid
    assert "skill_b" in mermaid
