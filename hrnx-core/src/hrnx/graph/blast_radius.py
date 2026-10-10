from __future__ import annotations

from typing import Dict, List, Set
from pydantic import BaseModel, Field
import networkx as nx

from hrnx.graph.dag import HarnessGraph
from hrnx.graph.edges import EdgeType
from hrnx.models.base import NodeType, Severity
from hrnx.models.schema import Directive, EvalSpec, HarnessNode, Skill


class BlastRadiusReport(BaseModel):
    """Structured report detailing the downstream impact of modifying one or more nodes."""
    origin_nodes: List[str] = Field(description="IDs of modified nodes initiating the analysis")
    direct_dependents: List[str] = Field(
        default_factory=list,
        description="Nodes that immediately depend on the origin nodes"
    )
    transitive_dependents: List[str] = Field(
        default_factory=list,
        description="All downstream nodes impacted directly or indirectly"
    )
    impacted_evals: List[str] = Field(
        default_factory=list,
        description="Evaluation suites that MUST be executed to test for regressions"
    )
    impacted_fatal_invariants: List[str] = Field(
        default_factory=list,
        description="High-severity fatal invariants present in the blast radius"
    )
    impacted_skills: List[str] = Field(
        default_factory=list,
        description="Workflows and skills impacted by the change"
    )
    affected_targets: List[str] = Field(
        default_factory=list,
        description="Target coding agents affected (e.g. claude, antigravity, cursor)"
    )
    total_blast_radius: int = Field(
        default=0,
        description="Total count of impacted nodes including origins"
    )
    is_fatal_risk: bool = Field(
        default=False,
        description="True if fatal invariants are impacted"
    )


class BlastRadiusAnalyzer:
    """Calculates transitive closure and downstream blast radius on a HarnessGraph."""

    def __init__(self, graph: HarnessGraph):
        self.graph = graph

    def calculate(self, origin_ids: List[str] | str) -> BlastRadiusReport:
        """
        Calculates the complete blast radius for one or more origin node IDs.
        Traverses all reverse dependencies (nodes that depend on the origins).
        """
        if isinstance(origin_ids, str):
            origin_ids = [origin_ids]

        existing_origins = [oid for oid in origin_ids if self.graph.has_node(oid)]
        if not existing_origins:
            return BlastRadiusReport(
                origin_nodes=origin_ids,
                total_blast_radius=0,
            )

        nx_graph = self.graph.graph
        direct_dependents_set: Set[str] = set()
        transitive_dependents_set: Set[str] = set()

        for oid in existing_origins:
            # In our graph (A -> B means A depends on B),
            # predecessors of B are nodes that depend directly on B.
            direct = set(nx_graph.predecessors(oid)) if nx_graph.has_node(oid) else set()
            direct_dependents_set.update(direct)

            # nx.ancestors(G, B) finds all nodes with a directed path to B,
            # meaning all nodes that depend directly or transitively on B.
            ancestors = nx.ancestors(nx_graph, oid) if nx_graph.has_node(oid) else set()
            transitive_dependents_set.update(ancestors)

        # Remove origin nodes themselves from dependent sets
        for oid in existing_origins:
            direct_dependents_set.discard(oid)
            transitive_dependents_set.discard(oid)

        all_impacted_ids = set(existing_origins).union(transitive_dependents_set)

        # Categorize impacted nodes
        impacted_evals: Set[str] = set()
        impacted_fatal_invariants: Set[str] = set()
        impacted_skills: Set[str] = set()
        affected_targets: Set[str] = set()

        # Find evals directly validating any impacted node
        all_eval_nodes = self.graph.get_nodes_by_type(NodeType.EVAL)
        for eval_node in all_eval_nodes:
            if isinstance(eval_node, EvalSpec):
                for val_id in eval_node.validates:
                    if val_id in all_impacted_ids:
                        impacted_evals.add(eval_node.id)

        for nid in all_impacted_ids:
            node = self.graph.get_node(nid)
            if not node:
                continue

            # Targets
            if node.targets:
                affected_targets.update(node.targets.keys())

            if isinstance(node, Directive):
                if node.severity == Severity.FATAL_INVARIANT:
                    impacted_fatal_invariants.add(node.id)
                for eval_id in node.validated_by:
                    if self.graph.has_node(eval_id):
                        impacted_evals.add(eval_id)

            elif isinstance(node, Skill):
                impacted_skills.add(node.id)
                for eval_id in node.validated_by:
                    if self.graph.has_node(eval_id):
                        impacted_evals.add(eval_id)

            elif isinstance(node, EvalSpec):
                impacted_evals.add(node.id)

        # Default fallback targets if none explicitly specified on nodes
        if not affected_targets:
            affected_targets = {"claude", "antigravity", "codex", "cursor", "copilot"}

        total_count = len(all_impacted_ids) + len(impacted_evals - all_impacted_ids)

        return BlastRadiusReport(
            origin_nodes=existing_origins,
            direct_dependents=sorted(list(direct_dependents_set)),
            transitive_dependents=sorted(list(transitive_dependents_set)),
            impacted_evals=sorted(list(impacted_evals)),
            impacted_fatal_invariants=sorted(list(impacted_fatal_invariants)),
            impacted_skills=sorted(list(impacted_skills)),
            affected_targets=sorted(list(affected_targets)),
            total_blast_radius=total_count,
            is_fatal_risk=len(impacted_fatal_invariants) > 0,
        )
