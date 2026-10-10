import * as vscode from 'vscode';
import * as path from 'path';
import { HRNXClient } from '../client/hrnxClient';
import { getWebviewContent } from './webviewUtils';
import { BlastRadiusResponse, GraphResponse } from '../types';

export class BlastRadiusPanel {
  public static currentPanel: BlastRadiusPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private currentNodeId: string | null = null;

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
      'blast-radius'
    );

    // Handle messages from the React Flow canvas
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'WEBVIEW_READY':
            await this.refresh();
            break;

          case 'FOCUS_NODE':
            await this.focusNode(message.nodeId);
            break;

          case 'GET_FULL_GRAPH':
            await this.loadFullGraph();
            break;

          case 'RUN_EVALS':
            await this.runEvaluations(message.evalIds);
            break;

          case 'OPEN_FILE_PATH':
            await this.openFile(message.filePath);
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
    client: HRNXClient,
    nodeId?: string
  ): BlastRadiusPanel {
    const column = vscode.ViewColumn.Two;

    if (BlastRadiusPanel.currentPanel) {
      BlastRadiusPanel.currentPanel.panel.reveal(column);
      if (nodeId) {
        BlastRadiusPanel.currentPanel.focusNode(nodeId);
      } else {
        BlastRadiusPanel.currentPanel.refresh();
      }
      return BlastRadiusPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'hrnxBlastRadius',
      'HRNX Blast Radius & Impact DAG',
      { viewColumn: column, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, 'dist', 'webview')),
          vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
        ],
      }
    );

    BlastRadiusPanel.currentPanel = new BlastRadiusPanel(panel, extensionUri, client);
    if (nodeId) {
      BlastRadiusPanel.currentPanel.currentNodeId = nodeId;
    }
    return BlastRadiusPanel.currentPanel;
  }

  public async focusNode(nodeId: string): Promise<void> {
    this.currentNodeId = nodeId;
    try {
      const [blastData, fullGraph] = await Promise.all([
        this.client.getBlastRadius(nodeId),
        this.client.getGraph(),
      ]);

      this.panel.webview.postMessage({
        type: 'UPDATE_BLAST_RADIUS',
        data: blastData,
        fullGraph,
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to calculate blast radius for ${nodeId}: ${String(err)}`);
    }
  }

  public async loadFullGraph(): Promise<void> {
    this.currentNodeId = null;
    try {
      const fullGraph: GraphResponse = await this.client.getGraph();
      this.panel.webview.postMessage({
        type: 'UPDATE_FULL_GRAPH',
        data: fullGraph,
      });
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to load knowledge DAG: ${String(err)}`);
    }
  }

  public async refresh(): Promise<void> {
    if (this.currentNodeId) {
      await this.focusNode(this.currentNodeId);
    } else {
      // Check if active editor has a node
      const activeDoc = vscode.window.activeTextEditor?.document;
      if (activeDoc) {
        const text = activeDoc.getText();
        const idMatch = text.match(/^id:\s*([^\s\r\n]+)/m);
        if (idMatch && idMatch[1]) {
          await this.focusNode(idMatch[1].trim());
          return;
        }
      }
      await this.loadFullGraph();
    }
  }

  private async runEvaluations(evalIds: string[]): Promise<void> {
    this.panel.webview.postMessage({ type: 'EVAL_STARTED' });
    try {
      const results = await this.client.runEvaluations(evalIds);
      this.panel.webview.postMessage({
        type: 'EVAL_FINISHED',
        results,
      });

      if (results.failed > 0) {
        vscode.window.showWarningMessage(
          `Evaluations completed: ${results.passed} passed, ${results.failed} failed.`
        );
      } else {
        vscode.window.showInformationMessage(
          `All ${results.passed} impacted evaluations passed with zero regressions!`
        );
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to run evaluations: ${String(err)}`);
      this.panel.webview.postMessage({
        type: 'EVAL_FINISHED',
        results: { total: 0, passed: 0, failed: 0, results: [] },
      });
    }
  }

  private async openFile(filePath: string): Promise<void> {
    if (!filePath) return;
    try {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
    } catch (err) {
      vscode.window.showWarningMessage(`Could not open file: ${filePath}`);
    }
  }

  public dispose(): void {
    BlastRadiusPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
