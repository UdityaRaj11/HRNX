from __future__ import annotations

import pytest
from pathlib import Path
from hrnx.workspace import Workspace
from hrnx.eval.runner import EvaluationRunner


def pytest_addoption(parser):
    group = parser.getgroup("hrnx", "HRNX AI Harness Testing")
    group.addoption(
        "--hrnx-eval",
        action="store_true",
        default=False,
        help="Run HRNX harness evaluation suites against active coding agents",
    )
    group.addoption(
        "--hrnx-target",
        action="store",
        default=None,
        help="Filter HRNX evaluation target agent (e.g. claude, antigravity, codex)",
    )


@pytest.fixture
def hrnx_workspace():
    """Provides an initialized HRNX Workspace instance for the current directory."""
    ws = Workspace(".")
    ws.load_all()
    return ws


@pytest.fixture
def hrnx_runner(hrnx_workspace):
    """Provides an EvaluationRunner instance."""
    return EvaluationRunner(hrnx_workspace)
