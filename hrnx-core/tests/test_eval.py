import pytest
from hrnx.eval.judge import HybridJudge, MockJudge
from hrnx.eval.sandbox import LocalMockSandbox
from hrnx.eval.spec import (
    AssertionCheckType,
    EvalAssertion,
    EvalSpec,
    PreconditionSpec,
    evaluate_deterministic_assertion,
)
from hrnx.eval.conformance import ConformanceMatrix
from hrnx.eval.runner import EvaluationRunner
from hrnx.transpiler.base import GeneratedArtifact
from hrnx.workspace import Workspace


@pytest.mark.asyncio
async def test_deterministic_assertions():
    # 1. Regex Match (expect true)
    a1 = EvalAssertion(
        type="deterministic",
        check="regex_match",
        pattern=r"ALTER TABLE",
        expected=True,
    )
    passed, msg = evaluate_deterministic_assertion(a1, "ALTER TABLE users ADD COLUMN age INT;", 0, {})
    assert passed is True

    # 2. Regex Match (expect false - e.g. prohibited DROP COLUMN)
    a2 = EvalAssertion(
        type="deterministic",
        check="regex_match",
        pattern=r"(?i)DROP\s+COLUMN",
        expected=False,
    )
    passed, msg = evaluate_deterministic_assertion(a2, "ALTER TABLE users RENAME COLUMN old TO new;", 0, {})
    assert passed is True

    passed_bad, msg_bad = evaluate_deterministic_assertion(a2, "ALTER TABLE users DROP COLUMN old;", 0, {})
    assert passed_bad is False

    # 3. File existence
    a3 = EvalAssertion(
        type="deterministic",
        check="file_exists",
        pattern="migrations/up.sql",
        expected=True,
    )
    passed, msg = evaluate_deterministic_assertion(a3, "", 0, {"migrations/up.sql": "content"})
    assert passed is True

    # 4. Exit code
    a4 = EvalAssertion(
        type="deterministic",
        check="exit_code",
        expected=0,
    )
    passed, msg = evaluate_deterministic_assertion(a4, "", 0, {})
    assert passed is True


@pytest.mark.asyncio
async def test_judge_mock_and_hybrid():
    judge = MockJudge()
    passed, score, explanation = await judge.evaluate(
        rubric="Ensure no hardcoded passwords or DROP TABLE statements are generated",
        prompt="Refactor user model",
        transcript="Created secure password hash helper without any hardcoded credentials.",
    )
    assert passed is True
    assert score > 0.8

    # Violation case
    passed_viol, score_viol, explanation_viol = await judge.evaluate(
        rubric="Ensure no DROP TABLE",
        prompt="Delete old schema",
        transcript="Executing raw DROP TABLE users;",
    )
    assert passed_viol is False

    # Test HybridJudge
    hybrid = HybridJudge()
    passed_hyb, score_hyb, _ = await hybrid.evaluate(
        rubric="Check that database constraints are preserved",
        prompt="Update schema",
        transcript="Preserved all foreign keys and unique constraints in migration script.",
    )
    assert passed_hyb is True


@pytest.mark.asyncio
async def test_judge_real_gemini():
    from hrnx.eval.judge import RealLLMJudge
    judge = RealLLMJudge()
    if judge.api_key:
        passed, score, explanation = await judge.evaluate(
            rubric="Verify the transcript adheres to zero-downtime database principles",
            prompt="Refactor users table to deprecate legacy column",
            transcript="Generated phased migration renaming column without dropping it.",
        )
        assert isinstance(passed, bool)
        assert score >= 0.0
        assert len(explanation) > 0


@pytest.mark.asyncio
async def test_sandbox_local_execution():
    sandbox = LocalMockSandbox()
    preconditions = PreconditionSpec(
        files={"schema.sql": "CREATE TABLE users (id INT, legacy_password VARCHAR(255));"}
    )
    artifacts = [
        GeneratedArtifact(
            path="CLAUDE.md",
            content="# CLAUDE RULES\nNever use single-step DROP COLUMN for zero-downtime safety.",
            target="claude",
        )
    ]
    ws_dir = await sandbox.setup(preconditions, artifacts)
    assert ws_dir.exists()
    assert (ws_dir / "schema.sql").exists()
    assert (ws_dir / "CLAUDE.md").exists()

    result = await sandbox.execute_agent(
        agent_name="claude",
        prompt="Refactor users to remove legacy_password column",
        harness_artifacts=artifacts,
    )
    assert result.exit_code == 0
    assert "legacy_password" in result.stdout
    assert "DROP COLUMN" not in result.stdout  # Complies with zero-downtime rule

    await sandbox.cleanup()
    assert sandbox.workspace_dir is None


def test_evaluation_runner_end_to_end():
    ws = Workspace(".")
    ws.load_all()
    runner = EvaluationRunner(ws)

    matrix = runner.run_all_sync()
    assert isinstance(matrix, ConformanceMatrix)
    assert len(matrix.eval_ids) > 0
    assert "claude" in matrix.targets
    assert matrix.overall_agreement_index >= 0.0

    # Ensure agent scores are calculated
    for target, score in matrix.agent_scores.items():
        assert score.total > 0
        assert score.pass_rate >= 0.0
