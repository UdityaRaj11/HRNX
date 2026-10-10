from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field

from ruamel.yaml import YAML

from hrnx.graph.blast_radius import BlastRadiusAnalyzer, BlastRadiusReport
from hrnx.graph.dag import CycleDetectedError, DanglingReference, HarnessGraph
from hrnx.graph.edges import EdgeType
from hrnx.index.cache import NodeCache, compute_sha256
from hrnx.models.base import NodeType, Severity
from hrnx.models.schema import ADR, Directive, HarnessNode, ProjectConfig
from hrnx.parser.ast import FrontmatterParser, ParseDiagnostic, ParsedDocument


class WorkspaceCheckReport(BaseModel):
    """Overall health and validation diagnostics of the HRNX workspace."""
    total_nodes: int = 0
    node_counts_by_type: Dict[str, int] = Field(default_factory=dict)
    severity_counts: Dict[str, int] = Field(default_factory=dict)
    parse_errors: List[str] = Field(default_factory=list)
    cycles: List[List[str]] = Field(default_factory=list)
    dangling_references: List[Dict[str, str]] = Field(default_factory=list)
    unimplemented_adrs: List[str] = Field(default_factory=list)
    is_healthy: bool = True


class Workspace:
    """
    Coordinates file discovery, incremental indexing, caching, and DAG building.
    Represents an active HRNX project.
    """

    def __init__(self, root_dir: Path | str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.hrnx_dir = self._find_hrnx_dir()
        self.config = self._load_config()
        self.cache = NodeCache(self.hrnx_dir / "cache.db")
        self.parser = FrontmatterParser()
        self.graph = HarnessGraph()
        self.documents: Dict[str, ParsedDocument] = {}  # file_path -> ParsedDocument

    def _find_hrnx_dir(self) -> Path:
        """Finds .hrnx directory in current, sub-packages, or parent directories."""
        if (self.root_dir / ".hrnx" / "config.yaml").is_file():
            return self.root_dir / ".hrnx"
        if (self.root_dir / "hrnx-core" / ".hrnx" / "config.yaml").is_file():
            return self.root_dir / "hrnx-core" / ".hrnx"

        curr = self.root_dir
        while curr != curr.parent:
            candidate = curr / ".hrnx"
            if candidate.is_dir() and (candidate / "config.yaml").is_file():
                return candidate
            curr = curr.parent
        return self.root_dir / ".hrnx"

    def _load_config(self) -> ProjectConfig:
        """Loads .hrnx/config.yaml or provides default config."""
        config_file = self.hrnx_dir / "config.yaml"
        if config_file.is_file():
            try:
                yaml = YAML()
                raw = yaml.load(config_file.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    return ProjectConfig.model_validate(raw)
            except Exception:
                pass
        return ProjectConfig()

    def discover_files(self) -> List[Path]:
        """Finds all candidate markdown files within the HRNX directories."""
        found: List[Path] = []
        if not self.hrnx_dir.is_dir():
            return found

        scan_dirs = [
            self.hrnx_dir / "nodes",
            self.hrnx_dir / "adrs",
            self.hrnx_dir / "evals",
        ]

        for sdir in scan_dirs:
            if sdir.is_dir():
                for p in sdir.rglob("*.md"):
                    if p.is_file():
                        found.append(p)

        return sorted(found)

    def load_all(self, force: bool = False) -> None:
        """
        Discovers and parses all files in the workspace.
        Uses incremental cache to avoid reparsing unchanged files.
        """
        files = self.discover_files()
        active_paths = set(str(f) for f in files)

        for fpath in files:
            str_path = str(fpath)
            stat = fpath.stat()
            mtime = stat.st_mtime

            content = fpath.read_text(encoding="utf-8")
            sha = compute_sha256(content)

            doc = self.parser.parse_string(content, file_path=str_path)
            self.documents[str_path] = doc

            if doc.node:
                self.graph.add_node(doc.node)
                self.cache.upsert_parsed_document(doc, mtime=mtime, sha256=sha)

        # Build all typed graph edges
        self.graph.build_edges_from_nodes()

    def reload_file(self, file_path: Path | str) -> ParsedDocument:
        """Parses and updates a single file in memory and in the DAG."""
        path_obj = Path(file_path).resolve()
        str_path = str(path_obj)

        if not path_obj.is_file():
            # File deleted
            if str_path in self.documents:
                doc = self.documents[str_path]
                if doc.node:
                    self.graph.remove_node(doc.node.id)
                del self.documents[str_path]
            self.cache.remove_file(str_path)
            self.graph.build_edges_from_nodes()
            return ParsedDocument(
                node=None,
                frontmatter_raw="",
                frontmatter_data={},
                body_raw="",
                frontmatter_lines=0,
                file_path=str_path,
            )

        content = path_obj.read_text(encoding="utf-8")
        doc = self.parser.parse_string(content, file_path=str_path)
        self.documents[str_path] = doc

        if doc.node:
            self.graph.add_node(doc.node)
            stat = path_obj.stat()
            self.cache.upsert_parsed_document(
                doc,
                mtime=stat.st_mtime,
                sha256=compute_sha256(content),
            )

        self.graph.build_edges_from_nodes()
        return doc

    def check_workspace(self) -> WorkspaceCheckReport:
        """Validates all files, cycles, dangling references, and ADR coverage."""
        self.load_all()

        parse_errors: List[str] = []
        for path_str, doc in self.documents.items():
            for d in doc.diagnostics:
                if d.severity == "error":
                    parse_errors.append(f"{path_str}:{d.line}:{d.column} - {d.message}")

        cycles = self.graph.detect_cycles()
        dangling_raw = self.graph.find_dangling_references()
        dangling = [
            {
                "source": d.source_id,
                "target": d.target_id,
                "edge_type": d.edge_type.value,
            }
            for d in dangling_raw
        ]

        # ADR Coverage
        adr_coverage = self.graph.get_adr_coverage()
        unimplemented_adrs = [
            adr_id for adr_id, implementing in adr_coverage.items()
            if len(implementing) == 0
        ]

        # Counts
        all_nodes = self.graph.all_nodes()
        node_counts: Dict[str, int] = {}
        severity_counts: Dict[str, int] = {}

        for n in all_nodes:
            t = n.type.value if hasattr(n.type, "value") else str(n.type)
            node_counts[t] = node_counts.get(t, 0) + 1
            if isinstance(n, Directive):
                s = n.severity.value
                severity_counts[s] = severity_counts.get(s, 0) + 1

        is_healthy = (
            len(parse_errors) == 0
            and len(cycles) == 0
            and len(dangling) == 0
        )

        return WorkspaceCheckReport(
            total_nodes=len(all_nodes),
            node_counts_by_type=node_counts,
            severity_counts=severity_counts,
            parse_errors=parse_errors,
            cycles=cycles,
            dangling_references=dangling,
            unimplemented_adrs=unimplemented_adrs,
            is_healthy=is_healthy,
        )

    def calculate_blast_radius(self, node_id: str) -> BlastRadiusReport:
        """Calculates blast radius for a given node ID."""
        analyzer = BlastRadiusAnalyzer(self.graph)
        return analyzer.calculate(node_id)

    def compile_all(self):
        """Compiles all active agent target configurations."""
        from hrnx.transpiler.registry import default_registry
        self.load_all()
        return default_registry.compile_all(self)

    def inspect_drift(self):
        """Inspects drift across all configured targets."""
        from hrnx.transpiler.registry import default_registry
        self.load_all()
        return default_registry.inspect_drift(self)

    def reconcile(self, target_id: Optional[str] = None):
        """Reconciles drifted or missing target files."""
        from hrnx.transpiler.registry import default_registry
        self.load_all()
        return default_registry.reconcile(self, target_id)

