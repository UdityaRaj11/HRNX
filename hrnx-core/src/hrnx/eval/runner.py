from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from hrnx.eval.conformance import ConformanceMatrix
from hrnx.eval.judge import HybridJudge
from hrnx.eval.sandbox import BaseSandbox, DockerSandbox, LocalMockSandbox, SandboxResult
from hrnx.eval.spec import (
    AssertionResult,
    EvalAssertion,
    EvalSpec,
    evaluate_deterministic_assertion,
)
from hrnx.transpiler.registry import default_registry
from hrnx.workspace import Workspace


class EvalTargetRunResult(BaseModel):
    """Detailed outcome for one eval suite executed against one target agent."""
    eval_id: str
    target: str
    title: str
    passed: bool
    duration_ms: float
    message: str
    assertions: List[AssertionResult] = Field(default_factory=list)
    transcript: Dict[str, Any] = Field(default_factory=dict)
    backend: str = "local"


class EvaluationRunner:
    """Orchestrates headless test execution, sandboxing, assertions, and conformance scoring."""

    def __init__(self, workspace: Workspace):
        self.workspace = workspace
        self.judge = HybridJudge()

    def _get_sandbox(self, mode: str) -> BaseSandbox:
        if mode == "docker":
            return DockerSandbox()
        return LocalMockSandbox()

    async def run_target(
        self,
        eval_spec: EvalSpec,
        target: str,
        sandbox_mode: str = "local",
    ) -> EvalTargetRunResult:
        """Executes an evaluation spec against a single agent target."""
        start_time = time.perf_counter()

        # 1. Compile harness target artifacts for this target agent
        transpiler = default_registry.get(target)
        if not transpiler:
            return EvalTargetRunResult(
                eval_id=eval_spec.id,
                target=target,
                title=eval_spec.title,
                passed=False,
                duration_ms=0.0,
                message=f"Unknown or unsupported agent target: {target}",
                backend=sandbox_mode,
            )

        artifacts = transpiler.compile(self.workspace)

        # 2. Provision sandbox
        sandbox = self._get_sandbox(sandbox_mode)
        sandbox_dir = await sandbox.setup(eval_spec.preconditions, artifacts)

        try:
            # 3. Execute agent in sandbox
            sb_res: SandboxResult = await sandbox.execute_agent(
                agent_name=target,
                prompt=eval_spec.prompt,
                harness_artifacts=artifacts,
                timeout_seconds=eval_spec.timeout_seconds,
            )

            # 4. Evaluate assertions
            assertion_results: List[AssertionResult] = []
            all_passed = True

            for idx, assertion in enumerate(eval_spec.assertions):
                if assertion.type == "semantic" or assertion.check == "llm_rubric":
                    # Semantic LLM-as-a-judge assertion
                    rubric = assertion.prompt_rubric or assertion.pattern or ""
                    passed, score, explanation = await self.judge.evaluate(
                        rubric=rubric,
                        prompt=eval_spec.prompt,
                        transcript=sb_res.stdout,
                    )
                    if not passed:
                        all_passed = False
                    assertion_results.append(
                        AssertionResult(
                            assertion_index=idx,
                            check=assertion.check,
                            passed=passed,
                            message=explanation,
                            details={"score": score},
                        )
                    )
                else:
                    # Deterministic assertion
                    passed, msg = evaluate_deterministic_assertion(
                        assertion=assertion,
                        stdout=sb_res.stdout,
                        exit_code=sb_res.exit_code,
                        modified_files=sb_res.modified_files,
                        sandbox_dir=sandbox_dir,
                    )
                    if not passed:
                        all_passed = False
                    assertion_results.append(
                        AssertionResult(
                            assertion_index=idx,
                            check=assertion.check,
                            passed=passed,
                            message=msg,
                        )
                    )

            duration_ms = (time.perf_counter() - start_time) * 1000

            summary_msg = (
                "All assertions passed"
                if all_passed
                else f"Failed {sum(1 for a in assertion_results if not a.passed)} of {len(assertion_results)} assertion(s)"
            )

            return EvalTargetRunResult(
                eval_id=eval_spec.id,
                target=target,
                title=eval_spec.title,
                passed=all_passed,
                duration_ms=round(duration_ms, 2),
                message=summary_msg,
                assertions=assertion_results,
                transcript=sb_res.transcript,
                backend=sb_res.sandbox_backend,
            )
        finally:
            await sandbox.cleanup()

    async def run_eval(
        self,
        eval_spec: EvalSpec,
        targets: Optional[List[str]] = None,
        sandbox_mode: str = "local",
    ) -> List[EvalTargetRunResult]:
        """Runs an evaluation spec across all its configured target agents."""
        selected_targets = targets or eval_spec.target_agents or self.workspace.config.active_targets
        results = []
        for t in selected_targets:
            res = await self.run_target(eval_spec, t, sandbox_mode=sandbox_mode)
            results.append(res)
        return results

    async def run_all(
        self,
        eval_ids: Optional[List[str]] = None,
        targets: Optional[List[str]] = None,
        sandbox_mode: str = "local",
    ) -> ConformanceMatrix:
        """
        Runs all matching evaluations in the workspace and builds a ConformanceMatrix.
        """
        self.workspace.load_all()
        all_eval_nodes = [
            n for n in self.workspace.graph.all_nodes()
            if getattr(n, "type", None) and (n.type.value == "eval" or str(n.type) == "eval")
        ]

        selected_evals = [
            e for e in all_eval_nodes
            if not eval_ids or e.id in eval_ids
        ]

        # Convert to EvalSpec if needed
        parsed_specs: List[EvalSpec] = []
        for raw in selected_evals:
            if isinstance(raw, EvalSpec):
                parsed_specs.append(raw)
            else:
                # Convert dict or raw node
                parsed_specs.append(EvalSpec(**raw.model_dump()))

        results_by_eval: Dict[str, Dict[str, Any]] = {}
        for spec in parsed_specs:
            results_by_eval[spec.id] = {}
            target_list = targets or spec.target_agents or self.workspace.config.active_targets
            for t in target_list:
                res = await self.run_target(spec, t, sandbox_mode=sandbox_mode)
                results_by_eval[spec.id][t] = {
                    "passed": res.passed,
                    "message": res.message,
                    "duration_ms": res.duration_ms,
                    "title": res.title,
                    "assertions": [a.model_dump() for a in res.assertions],
                    "transcript": res.transcript,
                    "backend": res.backend,
                }

        return ConformanceMatrix.from_results(results_by_eval)

    def run_all_sync(
        self,
        eval_ids: Optional[List[str]] = None,
        targets: Optional[List[str]] = None,
        sandbox_mode: str = "local",
    ) -> ConformanceMatrix:
        """Synchronous wrapper for CLI and pytest runners, event-loop safe."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    asyncio.run,
                    self.run_all(eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode),
                )
                return future.result()
        else:
            return asyncio.run(self.run_all(eval_ids=eval_ids, targets=targets, sandbox_mode=sandbox_mode))
