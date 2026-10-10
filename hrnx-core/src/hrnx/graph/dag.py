from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple
import networkx as nx

from hrnx.graph.edges import EdgeMetadata, EdgeType
from hrnx.models.base import NodeType
from hrnx.models.schema import (
    ADR,
    Directive,
    EvalSpec,
    HarnessNode,
    Skill,
)


class CycleDetectedError(Exception):
    """Raised when one or more cyclic dependencies are detected in the DAG."""
    def __init__(self, cycles: List[List[str]]):
        self.cycles = cycles
        formatted = " | ".join(" -> ".join(c) for c in cycles)
        super().__init__(f"Cyclic dependency detected: {formatted}")


class DanglingReference:
    """Represents a reference from a source node to a target node ID that does not exist."""
    def __init__(self, source_id: str, target_id: str, edge_type: EdgeType):
        self.source_id = source_id
        self.target_id = target_id
        self.edge_type = edge_type

    def __repr__(self) -> str:
        return f"<DanglingReference {self.source_id} -[{self.edge_type}]-> {self.target_id}>"


class HarnessGraph:
    """
    In-memory DAG dependency engine built on NetworkX.
    Maintains typed nodes, edges, cycle analysis, topological ordering, and dangling checks.
    """

    def __init__(self):
        # Directed graph where an edge (A, B) denotes: A depends on / references B
        self._graph: nx.DiGraph = nx.DiGraph()
        self._nodes: Dict[str, HarnessNode] = {}
        # Reverse mapping: target -> list of sources referencing target
        self._edge_data: Dict[Tuple[str, str], EdgeMetadata] = {}

    @property
    def graph(self) -> nx.DiGraph:
        return self._graph

    def add_node(self, node: HarnessNode) -> None:
        """Adds or updates a node in the graph."""
        self._nodes[node.id] = node
        if not self._graph.has_node(node.id):
            self._graph.add_node(node.id, node=node, node_type=node.type)
        else:
            self._graph.nodes[node.id]["node"] = node
            self._graph.nodes[node.id]["node_type"] = node.type

    def remove_node(self, node_id: str) -> None:
        """Removes a node and its adjacent edges from the graph."""
        if node_id in self._nodes:
            del self._nodes[node_id]
        if self._graph.has_node(node_id):
            self._graph.remove_node(node_id)
        # Clean edge data
        keys_to_del = [k for k in self._edge_data if k[0] == node_id or k[1] == node_id]
        for k in keys_to_del:
            del self._edge_data[k]

    def get_node(self, node_id: str) -> Optional[HarnessNode]:
        """Returns node by ID if it exists."""
        return self._nodes.get(node_id)

    def has_node(self, node_id: str) -> bool:
        """Returns True if node exists in graph."""
        return node_id in self._nodes

    def all_nodes(self) -> List[HarnessNode]:
        """Returns a list of all nodes in the graph."""
        return list(self._nodes.values())

    def get_nodes_by_type(self, node_type: NodeType) -> List[HarnessNode]:
        """Returns all nodes matching the specified NodeType."""
        return [n for n in self._nodes.values() if n.type == node_type]

    def add_edge(self, source_id: str, target_id: str, edge_type: EdgeType) -> None:
        """Adds a typed directed edge (source depends on / references target)."""
        self._graph.add_edge(source_id, target_id, edge_type=edge_type)
        meta = EdgeMetadata(edge_type=edge_type, source_id=source_id, target_id=target_id)
        self._edge_data[(source_id, target_id)] = meta

    def build_edges_from_nodes(self) -> None:
        """
        Scans all registered nodes and connects typed edges according to
        depends_on, implements, validated_by, uses_tools, and validates fields.
        """
        # Clear existing edges
        self._graph.clear_edges()
        self._edge_data.clear()

        # Re-add all registered nodes to nx graph
        for node in self._nodes.values():
            self._graph.add_node(node.id, node=node, node_type=node.type)

        for node in self._nodes.values():
            # 1. depends_on
            for dep in node.depends_on:
                self.add_edge(node.id, dep, EdgeType.DEPENDS_ON)

            # 2. Directive-specific edges
            if isinstance(node, Directive):
                for adr_id in node.implements:
                    self.add_edge(node.id, adr_id, EdgeType.IMPLEMENTS)
                for eval_id in node.validated_by:
                    self.add_edge(eval_id, node.id, EdgeType.VALIDATES)
                for ov in node.overrides:
                    self.add_edge(node.id, ov, EdgeType.OVERRIDES)

            # 3. Skill-specific edges
            elif isinstance(node, Skill):
                for tool_id in node.uses_tools:
                    self.add_edge(node.id, tool_id, EdgeType.USES_TOOL)
                for adr_id in node.implements:
                    self.add_edge(node.id, adr_id, EdgeType.IMPLEMENTS)
                for eval_id in node.validated_by:
                    self.add_edge(eval_id, node.id, EdgeType.VALIDATES)

            # 4. EvalSpec-specific edges
            elif isinstance(node, EvalSpec):
                for validated_id in node.validates:
                    self.add_edge(node.id, validated_id, EdgeType.VALIDATES)

    def detect_cycles(self) -> List[List[str]]:
        """
        Detects all directed cycles in the graph.
        Returns list of cycle paths, e.g. [['A', 'B', 'C', 'A']].
        """
        # We only inspect subgraphs formed by strictly internal dependency edges
        # We construct a subgraph containing only existing nodes
        existing_nodes = set(self._nodes.keys())
        sub = self._graph.subgraph(existing_nodes).copy()

        cycles: List[List[str]] = []
        try:
            for cycle in nx.simple_cycles(sub):
                # Append first element to close the loop visualization
                cycle_path = list(cycle) + [cycle[0]]
                cycles.append(cycle_path)
        except Exception:
            pass

        return cycles

    def find_dangling_references(self) -> List[DanglingReference]:
        """
        Detects all edges referencing node IDs that do not exist in the graph.
        """
        dangling: List[DanglingReference] = []
        for (src, dst), meta in self._edge_data.items():
            if dst not in self._nodes:
                dangling.append(DanglingReference(source_id=src, target_id=dst, edge_type=meta.edge_type))
        return dangling

    def get_dependencies(self, node_id: str) -> List[str]:
        """Returns direct dependencies of node (what node_id depends on)."""
        if not self._graph.has_node(node_id):
            return []
        return list(self._graph.successors(node_id))

    def get_dependents(self, node_id: str) -> List[str]:
        """Returns direct dependents of node (nodes that depend on node_id)."""
        if not self._graph.has_node(node_id):
            return []
        return list(self._graph.predecessors(node_id))

    def topological_sort(self) -> List[str]:
        """
        Returns nodes in topologically sorted order.
        Raises CycleDetectedError if cyclic dependencies exist.
        """
        cycles = self.detect_cycles()
        if cycles:
            raise CycleDetectedError(cycles)

        existing_nodes = set(self._nodes.keys())
        sub = self._graph.subgraph(existing_nodes)
        
        # In our graph (A -> B means A depends on B), for compilation/loading
        # B must be processed before A. nx.topological_sort gives sources before sinks,
        # so reversing gives independent nodes first, followed by dependents.
        return list(reversed(list(nx.topological_sort(sub))))

    def get_adr_coverage(self) -> Dict[str, List[str]]:
        """
        Returns a mapping of ADR IDs to the list of node IDs (directives/skills) that implement them.
        """
        adr_nodes = self.get_nodes_by_type(NodeType.ADR)
        coverage: Dict[str, List[str]] = {adr.id: [] for adr in adr_nodes}

        for (src, dst), meta in self._edge_data.items():
            if meta.edge_type == EdgeType.IMPLEMENTS and dst in coverage:
                coverage[dst].append(src)

        return coverage

    def to_mermaid(self) -> str:
        """Exports the graph topology as a Mermaid diagram."""
        lines = ["flowchart TD"]
        for node_id, node in self._nodes.items():
            safe_id = node_id.replace(".", "_").replace("-", "_")
            title = node.title.replace('"', "'")
            lines.append(f'    {safe_id}["{node_id}<br/><i>{title}</i>"]')

        for (src, dst), meta in self._edge_data.items():
            safe_src = src.replace(".", "_").replace("-", "_")
            safe_dst = dst.replace(".", "_").replace("-", "_")
            label = meta.edge_type.value
            lines.append(f"    {safe_src} -->|{label}| {safe_dst}")

        return "\n".join(lines)
