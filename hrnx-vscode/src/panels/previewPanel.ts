import * as vscode from 'vscode';
import * as path from 'path';
import { HRNXClient } from '../client/hrnxClient';
import { getWebviewContent } from './webviewUtils';
import { TranspilePreviewData } from '../types';

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private activeTarget = 'claude';
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastActiveDocText: string | undefined;
  private lastActiveDocPath: string | undefined;
  private lastActiveNodeId: string | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private client: HRNXClient
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    const config = vscode.workspace.getConfiguration('hrnx');
    this.activeTarget = config.get<string>('defaultTargetAgent', 'claude');

    this.panel.webview.html = getWebviewContent(
      this.panel.webview,
      this.extensionUri,
      'preview',
      this.activeTarget
    );

    // Track initial document if open
    const initEditor = vscode.window.activeTextEditor;
    if (initEditor && initEditor.document.uri.scheme === 'file') {
      this.lastActiveDocText = initEditor.document.getText();
      this.lastActiveDocPath = initEditor.document.uri.fsPath;
    }

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'WEBVIEW_READY':
            await this.update();
            break;
          case 'CHANGE_TARGET':
            this.activeTarget = message.target;
            await this.update();
            break;
          case 'SYNC_TO_DISK':
            await this.syncToDisk(message.target);
            break;
          case 'OPEN_FILE':
            await this.openFile(message.filename);
            break;
          case 'OPEN_NATIVE_DIFF':
            await this.openNativeDiff(message.filename, message.content);
            break;
        }
      },
      null,
      this.disposables
    );

    // Watch for active editor changes
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && editor.document.uri.scheme === 'file' && editor.document.uri.fsPath.endsWith('.md')) {
          this.lastActiveDocText = editor.document.getText();
          this.lastActiveDocPath = editor.document.uri.fsPath;
          this.lastActiveNodeId = undefined;
        }
        this.triggerDebouncedUpdate();
      },
      null,
      this.disposables
    );

    // Watch for document modifications in real-time
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.scheme === 'file' && e.document.uri.fsPath.endsWith('.md')) {
          this.lastActiveDocText = e.document.getText();
          this.lastActiveDocPath = e.document.uri.fsPath;
          this.triggerDebouncedUpdate();
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri, client: HRNXClient): PreviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel.panel.reveal(column);
      PreviewPanel.currentPanel.update();
      return PreviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'hrnxPreview',
      'HRNX Live Transpiler Preview',
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

    PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, client);
    return PreviewPanel.currentPanel;
  }

  private triggerDebouncedUpdate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.update();
    }, 200);
  }

  public async update(explicitNodeId?: string): Promise<void> {
    if (explicitNodeId) {
      this.lastActiveNodeId = explicitNodeId;
    }

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.scheme === 'file' && editor.document.uri.fsPath.endsWith('.md')) {
      this.lastActiveDocText = editor.document.getText();
      this.lastActiveDocPath = editor.document.uri.fsPath;
    }

    const docText = this.lastActiveDocText;
    const docPath = this.lastActiveDocPath;
    const nodeId = this.lastActiveNodeId;

    try {
      const data: TranspilePreviewData = await this.client.previewTranspile(
        nodeId,
        this.activeTarget,
        docText,
        docPath
      );

      this.panel.webview.postMessage({
        type: 'UPDATE_PREVIEW',
        data,
        activeTarget: this.activeTarget,
      });
    } catch (err) {
      this.panel.webview.postMessage({
        type: 'UPDATE_PREVIEW',
        data: {
          target: this.activeTarget,
          filename: '',
          content: `# Connecting to hrnx-lsp...\n\nPlease ensure a .hrnx/ node file is selected.\n${String(err)}`,
          hasDiff: false,
        },
        activeTarget: this.activeTarget,
      });
    }
  }

  private async syncToDisk(target: string): Promise<void> {
    try {
      const res = await this.client.reconcile(target);
      vscode.window.showInformationMessage(
        `Successfully synced canonical harness to target: ${target.toUpperCase()} (${res.reconciledFiles.length} files written)`
      );
      await this.update();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to sync to disk: ${String(err)}`);
    }
  }

  private async openFile(filename: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const fullPath = path.join(workspaceRoot, filename);
    const uri = vscode.Uri.file(fullPath);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
    } catch (err) {
      vscode.window.showWarningMessage(`Could not open file: ${filename}`);
    }
  }

  private async openNativeDiff(filename: string, previewContent?: string): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !filename) return;

    const fullPath = path.join(workspaceRoot, filename);
    const diskUri = vscode.Uri.file(fullPath);

    // If file doesn't exist on disk yet, prompt user or create empty scratch
    try {
      const previewUri = vscode.Uri.parse(`untitled:${filename}.hrnx-preview`);
      const previewDoc = await vscode.workspace.openTextDocument(previewUri);
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        previewUri,
        new vscode.Range(0, 0, previewDoc.lineCount, 0),
        previewContent || ''
      );
      await vscode.workspace.applyEdit(edit);

      await vscode.commands.executeCommand(
        'vscode.diff',
        diskUri,
        previewUri,
        `${filename} (Disk ⟷ HRNX Live Preview)`
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to open native diff: ${String(err)}`);
    }
  }

  public dispose(): void {
    PreviewPanel.currentPanel = undefined;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
