import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HRNXClient } from '../client/hrnxClient';
import { HRNXTreeDataProvider, HRNXTreeItem } from '../views/explorer/hrnxTreeView';
import { DriftTreeDataProvider, DriftTreeItem } from '../views/drift/driftView';
import { PreviewPanel } from '../panels/previewPanel';
import { BlastRadiusPanel } from '../panels/blastRadiusPanel';
import { ConformancePanel } from '../panels/conformancePanel';
import { SemanticMergePanel } from '../panels/semanticMergePanel';
import { CollabStatusBar } from '../collaboration/collabStatusBar';
import { GitManager } from '../git/gitManager';

export function registerCommands(
  context: vscode.ExtensionContext,
  client: HRNXClient,
  treeProvider: HRNXTreeDataProvider,
  driftProvider: DriftTreeDataProvider,
  collabStatusBar?: CollabStatusBar,
  gitManager?: GitManager
): void {
  const registerSafe = (commandId: string, handler: (...args: any[]) => any) => {
    try {
      context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
    } catch (err: any) {
      console.warn(`[HRNX] Command '${commandId}' registration bypassed: ${err?.message || String(err)}`);
    }
  };

  // 1. Open Blast Radius Canvas
  registerSafe('hrnx.openBlastRadius', (item?: HRNXTreeItem) => {
    const nodeId = item?.nodeData?.id;
    BlastRadiusPanel.createOrShow(context.extensionUri, client, nodeId);
  });

  // 2. Open Live Transpiler Preview
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.openPreview', (item?: HRNXTreeItem) => {
      const panel = PreviewPanel.createOrShow(context.extensionUri, client);
      if (item?.nodeData?.id) {
        panel.update(item.nodeData.id);
      }
    })
  );

  // 2b. Open Native VS Code Diff for Active Preview
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.openNativeDiff', async (item?: HRNXTreeItem) => {
      try {
        const previewData = await client.previewTranspile(item?.nodeData?.id);
        if (previewData && previewData.filename) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!workspaceRoot) return;
          const diskPath = path.join(workspaceRoot, previewData.filename);
          const diskUri = vscode.Uri.file(diskPath);
          const previewUri = vscode.Uri.parse(`untitled:${previewData.filename}.hrnx-preview`);
          const previewDoc = await vscode.workspace.openTextDocument(previewUri);
          const edit = new vscode.WorkspaceEdit();
          edit.replace(
            previewUri,
            new vscode.Range(0, 0, previewDoc.lineCount, 0),
            previewData.content || ''
          );
          await vscode.workspace.applyEdit(edit);
          await vscode.commands.executeCommand(
            'vscode.diff',
            diskUri,
            previewUri,
            `${previewData.filename} (Disk ⟷ Live HRNX Preview)`
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to open native diff: ${String(err)}`);
      }
    })
  );

  // 3. Reconcile / Overwrite all drifted agent files
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.reconcileDrift', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reconcile will overwrite all drifted agent configuration files (CLAUDE.md, .cursorrules, etc.) with canonical definitions. Proceed?',
        { modal: true },
        'Reconcile All'
      );

      if (confirm === 'Reconcile All') {
        try {
          const res = await client.reconcile();
          vscode.window.showInformationMessage(
            `Reconciliation complete: ${res.reconciledFiles.length} files aligned with canonical harness.`
          );
          driftProvider.refresh();
          treeProvider.refresh();
        } catch (err) {
          vscode.window.showErrorMessage(`Reconcile failed: ${String(err)}`);
        }
      }
    })
  );

  // 4. Reconcile selected target
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.reconcileTarget', async (item?: DriftTreeItem) => {
      const target = item?.driftData?.target;
      try {
        const res = await client.reconcile(target);
        vscode.window.showInformationMessage(
          `Target '${target}' reconciled successfully (${res.reconciledFiles.length} files updated).`
        );
        driftProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to reconcile target: ${String(err)}`);
      }
    })
  );

  // 5. Refresh Views
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.refreshViews', () => {
      treeProvider.refresh();
      driftProvider.refresh();
      vscode.window.showInformationMessage('HRNX views refreshed.');
    })
  );

  // 6. Run All Impacted Evals
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.runAllEvals', async () => {
      try {
        const results = await client.runEvaluations();
        if (results.failed === 0) {
          vscode.window.showInformationMessage(
            `All ${results.total} evaluation suites passed successfully!`
          );
        } else {
          vscode.window.showWarningMessage(
            `Evaluations completed: ${results.passed} passed, ${results.failed} failed.`
          );
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to run evaluations: ${String(err)}`);
      }
    })
  );

  // 6b. Open Cross-Agent Conformance Matrix Webview
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.openConformanceMatrix', () => {
      ConformancePanel.createOrShow(context.extensionUri, client);
    })
  );

  // 7. Create New Directive
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.createDirective', async () => {
      const id = await vscode.window.showInputBox({
        prompt: 'Enter Directive ID (e.g., dir.auth.rate-limiting)',
        value: 'dir.',
        validateInput: (v) => (v.startsWith('dir.') ? null : 'Directive ID must start with "dir."'),
      });
      if (!id) return;

      const title = await vscode.window.showInputBox({
        prompt: 'Enter Directive Title',
        value: 'Rate Limiting Policy',
      });
      if (!title) return;

      const rawClient = client.getRawClient();
      if (rawClient) {
        await rawClient.sendRequest('workspace/executeCommand', {
          command: 'hrnx.createSkeletonNode',
          arguments: [id],
        });
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Created directive skeleton: ${id}`);
      }
    })
  );

  // 8. Create New Skill
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.createSkill', async () => {
      const id = await vscode.window.showInputBox({
        prompt: 'Enter Skill ID (e.g., skill.db.rollback)',
        value: 'skill.',
        validateInput: (v) => (v.startsWith('skill.') ? null : 'Skill ID must start with "skill."'),
      });
      if (!id) return;

      const rawClient = client.getRawClient();
      if (rawClient) {
        await rawClient.sendRequest('workspace/executeCommand', {
          command: 'hrnx.createSkeletonNode',
          arguments: [id],
        });
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Created skill skeleton: ${id}`);
      }
    })
  );

  // 9. Create Architectural Decision Record (ADR)
  context.subscriptions.push(
    vscode.commands.registerCommand('hrnx.createADR', async () => {
      const id = await vscode.window.showInputBox({
        prompt: 'Enter ADR ID (e.g., ADR-002-jwt-auth)',
        value: 'ADR-',
        validateInput: (v) => (v.startsWith('ADR-') ? null : 'ADR ID must start with "ADR-"'),
      });
      if (!id) return;

      const rawClient = client.getRawClient();
      if (rawClient) {
        await rawClient.sendRequest('workspace/executeCommand', {
          command: 'hrnx.createSkeletonNode',
          arguments: [id],
        });
        treeProvider.refresh();
        vscode.window.showInformationMessage(`Created ADR skeleton: ${id}`);
      }
    })
  );

  // =========================================================================
  // Stream 5: Multiplayer Collaboration, Semantic Merge & Git Synchronization
  // =========================================================================

  // 10. Open Semantic 3-Way Merge Resolver
  registerSafe('hrnx.openSemanticMerge', (item?: any) => {
    let targetPath: string | undefined;
    if (item instanceof vscode.Uri) {
      targetPath = item.fsPath;
    } else if (item?.nodeData?.filePath) {
      targetPath = item.nodeData.filePath;
    } else if (vscode.window.activeTextEditor) {
      targetPath = vscode.window.activeTextEditor.document.uri.fsPath;
    }
    SemanticMergePanel.createOrShow(context.extensionUri, client, targetPath);
  });

  // 11. Atomic Multi-Target Commit
  registerSafe('hrnx.atomicCommit', async () => {
    if (gitManager) {
      await gitManager.triggerAtomicCommit();
    } else {
      const message = await vscode.window.showInputBox({
        prompt: 'Enter Git commit message (HRNX will auto-compile and stage all active agent targets)',
      });
      if (message) {
        const res = await client.atomicCommit(message);
        if (res.success) {
          vscode.window.showInformationMessage(`[+] Atomic Commit: ${res.commit_hash}`);
        } else {
          vscode.window.showErrorMessage(`[!] Commit failed: ${res.message}`);
        }
      }
    }
  });

  // 12. Install Git Pre-Commit Hooks & Semantic Merge Driver
  registerSafe('hrnx.installGitHooks', async () => {
    if (gitManager) {
      await gitManager.installGitHooks();
    } else {
      const res = await client.installGitHooks();
      if (res.success) {
        vscode.window.showInformationMessage(
          '[+] HRNX Git Pre-Commit Hook & Merge Driver installed successfully!'
        );
      } else {
        vscode.window.showErrorMessage(`[!] Failed: ${res.error}`);
      }
    }
  });

  // 13. Collaboration Session Menu
  registerSafe('hrnx.collabSessionMenu', async () => {
    if (collabStatusBar) {
      await collabStatusBar.showSessionMenu();
    }
  });
}

