import * as vscode from 'vscode';
import * as path from 'path';
import { HRNXClient } from '../client/hrnxClient';
import { getWebviewContent } from './webviewUtils';
import { ConformanceMatrixData, EvalRunResponse } from '../types';

export class ConformancePanel {
  public static currentPanel: ConformancePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private client: HRNXClient
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = getWebviewContent(
      this.panel.webview,
      this.extensionUri,
      'conformance'
    );

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'WEBVIEW_READY':
            await this.loadMatrix();
            break;

          case 'RUN_ALL_EVALS':
            await this.runEvaluations();
            break;

          case 'RUN_TARGET_EVALS':
            await this.runEvaluations(undefined, [message.target]);
            break;

          case 'OPEN_EVAL_FILE':
            await this.openEvalFile(message.evalId);
            break;
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    client: HRNXClient
  ): ConformancePanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (ConformancePanel.currentPanel) {
      ConformancePanel.currentPanel.panel.reveal(column);
      ConformancePanel.currentPanel.loadMatrix();
      return ConformancePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'hrnxConformanceMatrix',
      'HRNX: Cross-Agent Conformance Matrix',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, 'dist', 'webview')),
          vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
        ],
      }
    );

    panel.iconPath = {
      light: vscode.Uri.file(path.join(extensionUri.fsPath, 'media', 'icons', 'hrnx-activitybar.svg')),
      dark: vscode.Uri.file(path.join(extensionUri.fsPath, 'media', 'icons', 'hrnx-activitybar.svg')),
    };

    ConformancePanel.currentPanel = new ConformancePanel(panel, extensionUri, client);
    return ConformancePanel.currentPanel;
  }

  public async loadMatrix(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('hrnx');
      const sandboxMode = config.get<string>('eval.sandboxBackend', 'local');
      const matrix: ConformanceMatrixData = await this.client.getConformanceMatrix(
        undefined,
        sandboxMode
      );
      this.panel.webview.postMessage({
        type: 'UPDATE_CONFORMANCE',
        data: matrix,
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to load conformance matrix: ${String(err)}`);
    }
  }

  public async runEvaluations(evalIds?: string[], targets?: string[]): Promise<void> {
    try {
      this.panel.webview.postMessage({ type: 'EVAL_STARTED' });
      const config = vscode.workspace.getConfiguration('hrnx');
      const sandboxMode = config.get<string>('eval.sandboxBackend', 'local');

      const results: EvalRunResponse = await this.client.runEvaluations(
        evalIds,
        targets,
        sandboxMode
      );
      const matrix: ConformanceMatrixData = await this.client.getConformanceMatrix(
        targets,
        sandboxMode
      );

      this.panel.webview.postMessage({
        type: 'EVAL_FINISHED',
        results,
        matrix,
      });

      const passed = results.passed;
      const failed = results.failed;
      if (failed === 0) {
        vscode.window.showInformationMessage(
          `Evaluations passed across all tested agents (${passed} suites verified).`
        );
      } else {
        vscode.window.showWarningMessage(
          `Evaluations completed: ${passed} passed, ${failed} failed across agents.`
        );
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Evaluation run failed: ${String(err)}`);
      this.panel.webview.postMessage({ type: 'EVAL_FINISHED', results: null });
    }
  }

  private async openEvalFile(evalId: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const evalPath = path.join(workspaceRoot, '.hrnx', 'evals', `${evalId}.md`);
    if (vscode.workspace.fs) {
      try {
        const uri = vscode.Uri.file(evalPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      } catch {
        vscode.window.showWarningMessage(`Could not locate evaluation file: ${evalPath}`);
      }
    }
  }

  public dispose(): void {
    ConformancePanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
