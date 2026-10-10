from __future__ import annotations

import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from rich.table import Table


class AgentScore(BaseModel):
    """Aggregate performance and adherence score for an individual agent target."""
    target: str
    total: int = 0
    passed: int = 0
    failed: int = 0
    pass_rate: float = 0.0
    avg_duration_ms: float = 0.0


class DivergenceItem(BaseModel):
    """Represents an invariant or evaluation where agents diverged in behavior."""
    eval_id: str
    title: str
    passing_agents: List[str]
    failing_agents: List[str]
    description: str


class ConformanceMatrix(BaseModel):
    """Cross-agent evaluation and conformance benchmark matrix."""
    eval_ids: List[str] = Field(default_factory=list)
    targets: List[str] = Field(default_factory=list)
    agent_scores: Dict[str, AgentScore] = Field(default_factory=dict)
    # matrix structure: { eval_id: { target: { passed: bool, message: str, duration_ms: float } } }
    matrix: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    overall_agreement_index: float = 100.0
    divergences: List[DivergenceItem] = Field(default_factory=list)
    total_evaluations: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat() + "Z")

    @classmethod
    def from_results(cls, results_by_eval: Dict[str, Dict[str, Any]]) -> ConformanceMatrix:
        """
        Builds a ConformanceMatrix from raw execution results.
        results_by_eval: { eval_id: { target: { passed, message, duration_ms, title } } }
        """
        eval_ids = list(results_by_eval.keys())
        all_targets: set[str] = set()
        for res_map in results_by_eval.values():
            all_targets.update(res_map.keys())
        sorted_targets = sorted(all_targets)

        agent_scores: Dict[str, AgentScore] = {}
        for target in sorted_targets:
            total = 0
            passed = 0
            total_duration = 0.0
            for eval_id, target_map in results_by_eval.items():
                if target in target_map:
                    total += 1
                    res = target_map[target]
                    if res.get("passed", False):
                        passed += 1
                    total_duration += res.get("duration_ms", 0.0)

            failed = total - passed
            pass_rate = round((passed / total * 100.0), 1) if total > 0 else 0.0
            avg_dur = round(total_duration / total, 2) if total > 0 else 0.0
            agent_scores[target] = AgentScore(
                target=target,
                total=total,
                passed=passed,
                failed=failed,
                pass_rate=pass_rate,
                avg_duration_ms=avg_dur,
            )

        # Detect divergences & calculate agreement index
        divergences: List[DivergenceItem] = []
        unanimous_count = 0
        for eval_id, target_map in results_by_eval.items():
            first_title = "Evaluation"
            passes: List[str] = []
            fails: List[str] = []
            for t, data in target_map.items():
                first_title = data.get("title", eval_id)
                if data.get("passed", False):
                    passes.append(t)
                else:
                    fails.append(t)

            if len(passes) > 0 and len(fails) > 0:
                divergences.append(
                    DivergenceItem(
                        eval_id=eval_id,
                        title=first_title,
                        passing_agents=passes,
                        failing_agents=fails,
                        description=f"Behavior diverged: adhered by {', '.join(passes)}, violated by {', '.join(fails)}",
                    )
                )
            else:
                unanimous_count += 1

        agreement = round((unanimous_count / len(eval_ids) * 100.0), 1) if eval_ids else 100.0

        return cls(
            eval_ids=eval_ids,
            targets=sorted_targets,
            agent_scores=agent_scores,
            matrix=results_by_eval,
            overall_agreement_index=agreement,
            divergences=divergences,
            total_evaluations=len(eval_ids),
        )

    def to_rich_table(self) -> Table:
        """Renders an interactive ASCII / ANSI table for CLI consumption."""
        table = Table(
            title=f"[bold cyan]Cross-Agent Conformance Benchmark Matrix[/] (Agreement: {self.overall_agreement_index}%)",
            show_header=True,
            header_style="bold magenta",
        )
        table.add_column("Evaluation Suite", style="cyan", no_wrap=True)
        for t in self.targets:
            score = self.agent_scores.get(t)
            score_text = f" ({score.pass_rate:.0f}%)" if score else ""
            table.add_column(f"{t.capitalize()}{score_text}", justify="center")

        for eval_id in self.eval_ids:
            row = [eval_id]
            target_data = self.matrix.get(eval_id, {})
            for t in self.targets:
                if t not in target_data:
                    row.append("[dim]-[/]")
                else:
                    res = target_data[t]
                    if res.get("passed", False):
                        row.append("[bold green]PASS[/]")
                    else:
                        row.append("[bold red]FAIL[/]")
            table.add_row(*row)

        return table
