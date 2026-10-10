import * as vscode from 'vscode';
import { HRNXClient } from '../client/hrnxClient';

export class GitManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(private client: HRNXClient) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      95
    );
    this.statusBarItem.command = 'hrnx.atomicCommit';
    this.statusBarItem.text = '$(git-commit) HRNX Targets: Checking...';
    this.statusBarItem.show();

    this.checkSyncStatus();
    // Poll sync status every 15 seconds or when files change
    this.intervalTimer = setInterval(() => this.checkSyncStatus(), 15000);
  }

  public async checkSyncStatus(): Promise<void> {
    try {
      const status = await this.client.checkStagedSyncStatus();
      if (!status.has_staged_hrnx) {
        this.statusBarItem.text = '$(git-commit) HRNX Targets: Idle';
        this.statusBarItem.tooltip = 'No canonical .hrnx files staged in Git.';
        this.statusBarItem.backgroundColor = undefined;
      } else if (status.targets_in_sync) {
        this.statusBarItem.text = '$(check) HRNX Targets: Staged & Synced';
        this.statusBarItem.tooltip = `Staged canonical nodes: ${status.staged_hrnx_files.join(', ')}\nGenerated target files are strictly in sync.`;
        this.statusBarItem.backgroundColor = undefined;
      } else {
        this.statusBarItem.text = '$(warning) HRNX Targets: Out of Sync';
        this.statusBarItem.tooltip = new vscode.MarkdownString(
          `**[!] Staged Canonical Nodes Have Drifted Targets**\n\n` +
            `Drifted targets: \`${status.drifted_targets.join(', ')}\`\n\n` +
            `Click to perform an **Atomic Multi-Target Commit** to compile and stage all targets.`
        );
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      }
    } catch {
      // Ignored if LSP not ready or not git repo
    }
  }

  public async triggerAtomicCommit(): Promise<void> {
    const message = await vscode.window.showInputBox({
      prompt: 'Enter Git commit message (HRNX will auto-compile and stage all active agent targets)',
      placeHolder: 'feat(harness): update database migration invariant',
    });

    if (!message) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Executing HRNX Atomic Multi-Target Commit...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 30, message: 'Compiling all active agent targets...' });
        const res = await this.client.atomicCommit(message);
        progress.report({ increment: 70, message: 'Finalizing Git transaction...' });

        if (res.success) {
          vscode.window.showInformationMessage(
            `[+] HRNX Atomic Commit Succeeded: ${res.commit_hash} (${res.staged_files.length} files staged and committed atomically)`
          );
          this.checkSyncStatus();
        } else {
          vscode.window.showErrorMessage(`[!] Atomic Commit failed: ${res.message} ${res.error || ''}`);
        }
      }
    );
  }

  public async installGitHooks(): Promise<void> {
    try {
      const res = await this.client.installGitHooks();
      if (res.success) {
        vscode.window.showInformationMessage(
          `[+] HRNX Git Pre-Commit Hook & AST Semantic Merge Driver installed successfully!\nPre-commit hook: ${res.preCommitHook}`
        );
      } else {
        vscode.window.showErrorMessage(`[!] Failed to install Git hooks: ${res.error}`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error installing Git hooks: ${err.message}`);
    }
  }

  public dispose(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.statusBarItem.dispose();
  }
}
