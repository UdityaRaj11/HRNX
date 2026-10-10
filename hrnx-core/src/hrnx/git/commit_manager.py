from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from hrnx.workspace import Workspace


class StagedSyncStatus(BaseModel):
    """Reflects whether staged Git commits align canonical nodes with compiled agent targets."""
    has_staged_hrnx: bool
    targets_in_sync: bool
    staged_hrnx_files: List[str] = Field(default_factory=list)
    drifted_targets: List[str] = Field(default_factory=list)
    staged_target_files: List[str] = Field(default_factory=list)


class CommitResult(BaseModel):
    """Result of an atomic multi-target commit."""
    success: bool
    message: str
    commit_hash: Optional[str] = None
    staged_files: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class GitManager:
    """Manages atomic multi-target Git commits and installation of HRNX Git hooks and merge drivers."""

    def __init__(self, workspace_root: Path):
        self.workspace_root = workspace_root.resolve()
        # Search for .git in workspace_root, then traverse parents
        git_dir = self.workspace_root / ".git"
        if not git_dir.exists():
            for p in self.workspace_root.parents:
                if (p / ".git").exists():
                    git_dir = p / ".git"
                    self.workspace_root = p
                    break
        self.git_dir = git_dir

    def is_git_repo(self) -> bool:
        return self.git_dir.exists() and self.git_dir.is_dir()

    def run_git(self, *args: str) -> subprocess.CompletedProcess:
        """Executes a git command within the workspace directory."""
        return subprocess.run(
            ["git", *args],
            cwd=str(self.workspace_root),
            capture_output=True,
            text=True,
            shell=False,
        )

    def check_staged_sync(self) -> StagedSyncStatus:
        """Inspects Git staging index to detect if canonical nodes are staged without compiled targets."""
        if not self.is_git_repo():
            return StagedSyncStatus(has_staged_hrnx=False, targets_in_sync=True)

        res = self.run_git("diff", "--cached", "--name-only", "--diff-filter=ACM")
        if res.returncode != 0:
            return StagedSyncStatus(has_staged_hrnx=False, targets_in_sync=True)

        staged_files = [line.strip().replace("\\", "/") for line in res.stdout.splitlines() if line.strip()]
        staged_hrnx = [f for f in staged_files if f.startswith(".hrnx/")]

        ws = Workspace(self.workspace_root)
        drift_report = ws.inspect_drift()

        # Check target files that have drifted
        drifted = [
            item.relative_path
            for item in drift_report.items
            if item.status in ("drifted", "missing")
        ]

        # Target files that are staged
        target_prefixes = ("CLAUDE.md", ".agent/", ".openai/", ".cursor/", ".github/", ".openhands/", "CONVENTIONS.md", ".clinerules", ".roomodes", ".windsurfrules", ".goosehints")
        staged_targets = [f for f in staged_files if any(f.startswith(p) for p in target_prefixes)]

        # If canonical files are staged, targets must not be drifted
        in_sync = True
        if staged_hrnx and drifted:
            in_sync = False

        return StagedSyncStatus(
            has_staged_hrnx=len(staged_hrnx) > 0,
            targets_in_sync=in_sync,
            staged_hrnx_files=staged_hrnx,
            drifted_targets=drifted,
            staged_target_files=staged_targets,
        )

    def atomic_commit(self, message: str) -> CommitResult:
        """
        Executes an atomic commit:
        1. Compiles all active agent targets.
        2. Automatically stages .hrnx canonical nodes and all generated target artifacts.
        3. Commits atomically in the exact same Git transaction.
        """
        if not self.is_git_repo():
            return CommitResult(
                success=False,
                message="Not a git repository",
                error=f"No .git directory found at {self.workspace_root}",
            )

        # 1. Compile all targets
        ws = Workspace(self.workspace_root)
        artifacts = ws.compile_all()

        # 2. Stage .hrnx canonical tree
        add_res = self.run_git("add", ".hrnx")
        if add_res.returncode != 0:
            return CommitResult(
                success=False,
                message="Failed to stage .hrnx directory",
                error=add_res.stderr,
            )

        # Stage generated artifacts
        for art in artifacts:
            art_path = Path(art.file_path)
            if art_path.exists():
                try:
                    rel_p = str(art_path.relative_to(self.workspace_root))
                except ValueError:
                    rel_p = art.target_path
                self.run_git("add", rel_p)

        # Find what is staged now
        status_res = self.run_git("diff", "--cached", "--name-only")
        staged_now = [line.strip() for line in status_res.stdout.splitlines() if line.strip()]

        if not staged_now:
            return CommitResult(
                success=False,
                message="Nothing to commit (staging index is empty)",
                error="Working tree clean",
            )

        # 3. Commit
        commit_res = self.run_git("commit", "-m", message)
        if commit_res.returncode != 0:
            return CommitResult(
                success=False,
                message="Git commit failed",
                error=commit_res.stderr or commit_res.stdout,
                staged_files=staged_now,
            )

        # Extract commit hash
        rev_res = self.run_git("rev-parse", "--short", "HEAD")
        commit_hash = rev_res.stdout.strip() if rev_res.returncode == 0 else None

        return CommitResult(
            success=True,
            message=f"Committed {len(staged_now)} files atomically [{commit_hash}]",
            commit_hash=commit_hash,
            staged_files=staged_now,
        )

    def install_git_hooks(self) -> Dict[str, Any]:
        """Installs the pre-commit hook and semantic merge driver into the repository."""
        if not self.is_git_repo():
            return {
                "success": False,
                "error": f"No .git directory found at {self.workspace_root}",
            }

        hooks_dir = self.git_dir / "hooks"
        hooks_dir.mkdir(parents=True, exist_ok=True)

        # 1. Pre-commit bash hook
        pre_commit_script = """#!/bin/sh
# HRNX Pre-Commit Hook: Enforces atomic synchronization between .hrnx and agent targets
echo "[HRNX] Checking staged canonical harness nodes..."
STAGED_HRNX=$(git diff --cached --name-only --diff-filter=ACM | grep '^\\.hrnx/' || true)

if [ -n "$STAGED_HRNX" ]; then
    echo "[HRNX] Canonical harness nodes staged. Compiling active agent targets..."
    if command -v hrnx >/dev/null 2>&1; then
        hrnx compile || exit 1
    elif [ -f "./hrnx-core/.venv/bin/python" ]; then
        ./hrnx-core/.venv/bin/python -m hrnx.cli.main compile || exit 1
    elif [ -f "./hrnx-core/.venv/Scripts/python.exe" ]; then
        ./hrnx-core/.venv/Scripts/python.exe -m hrnx.cli.main compile || exit 1
    fi
    # Stage generated targets
    git add CLAUDE.md .agent/ .openai/ .cursor/ .github/ .openhands/ CONVENTIONS.md .clinerules .roomodes .windsurfrules .goosehints 2>/dev/null || true
    echo "[HRNX] Active agent targets compiled and staged atomically."
fi
exit 0
"""
        pre_commit_path = hooks_dir / "pre-commit"
        pre_commit_path.write_text(pre_commit_script, encoding="utf-8")
        try:
            pre_commit_path.chmod(0o755)
        except Exception:
            pass

        # 2. Windows pre-commit.bat
        pre_commit_bat = """@echo off
REM HRNX Windows Pre-Commit Hook
git diff --cached --name-only --diff-filter=ACM | findstr /R "^\\.hrnx/" >nul
if %ERRORLEVEL% EQU 0 (
    echo [HRNX] Canonical harness nodes staged. Compiling active agent targets...
    where hrnx >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        hrnx compile
    ) else (
        if exist ".\\hrnx-core\\.venv\\Scripts\\python.exe" (
            .\\hrnx-core\\.venv\\Scripts\\python.exe -m hrnx.cli.main compile
        )
    )
    git add CLAUDE.md .agent .openai .cursor .github .openhands CONVENTIONS.md .clinerules .roomodes .windsurfrules .goosehints 2>nul
    echo [HRNX] Active agent targets compiled and staged atomically.
)
exit /b 0
"""
        (hooks_dir / "pre-commit.bat").write_text(pre_commit_bat, encoding="utf-8")

        # 3. Configure Git Merge Driver
        self.run_git("config", "merge.hrnx-merge-driver.name", "HRNX AST Semantic Merge Driver")
        self.run_git("config", "merge.hrnx-merge-driver.driver", "hrnx merge-driver %O %A %B %P")

        # 4. Update .gitattributes
        gitattributes_file = self.workspace_root / ".gitattributes"
        driver_entry = ".hrnx/**/*.md merge=hrnx-merge-driver\n"
        existing_attr = gitattributes_file.read_text(encoding="utf-8") if gitattributes_file.exists() else ""
        if "merge=hrnx-merge-driver" not in existing_attr:
            gitattributes_file.write_text(existing_attr + driver_entry, encoding="utf-8")

        return {
            "success": True,
            "preCommitHook": str(pre_commit_path),
            "mergeDriverConfigured": True,
            "gitattributesUpdated": True,
        }
