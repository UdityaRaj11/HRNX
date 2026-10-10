import * as vscode from 'vscode';
import { HRNXClient } from '../client/hrnxClient';
import { getWebviewContent } from './webviewUtils';
import { MergeConflictData } from '../types';

export class SemanticMergePanel {
  public static currentPanel: SemanticMergePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private currentFilePath: string | null = null;
  private currentConflictData: MergeConflictData | null = null;

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
      'semantic-merge'
    );

    // Handle incoming messages from the Webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'WEBVIEW_READY':
            await this.refresh();
            break;

          case 'RESOLVE_MERGE':
            await this.resolveMerge(
              message.filePath,
              message.resolvedFrontmatter,
              message.resolvedBody
            );
            break;

          case 'REFRESH_MERGE':
            await this.refresh();
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
    filePath?: string,
    baseText?: string,
    oursText?: string,
    theirsText?: string
  ): SemanticMergePanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SemanticMergePanel.currentPanel) {
      SemanticMergePanel.currentPanel.panel.reveal(column);
      if (filePath) {
        SemanticMergePanel.currentPanel.currentFilePath = filePath;
      }
      SemanticMergePanel.currentPanel.refresh(filePath, baseText, oursText, theirsText);
      return SemanticMergePanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'hrnxSemanticMerge',
      'HRNX Semantic Merge Resolver',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media'),
        ],
      }
    );

    SemanticMergePanel.currentPanel = new SemanticMergePanel(panel, extensionUri, client);
    if (filePath) {
      SemanticMergePanel.currentPanel.currentFilePath = filePath;
    }
    SemanticMergePanel.currentPanel.refresh(filePath, baseText, oursText, theirsText);
    return SemanticMergePanel.currentPanel;
  }

  public async refresh(
    filePath?: string,
    baseText?: string,
    oursText?: string,
    theirsText?: string
  ): Promise<void> {
    const targetPath = filePath || this.currentFilePath;
    if (!targetPath && !oursText) {
      return;
    }

    try {
      const conflictData = await this.client.getMergeConflict(
        targetPath || undefined,
        baseText,
        oursText,
        theirsText
      );
      this.currentConflictData = conflictData;

      await this.panel.webview.postMessage({
        type: 'UPDATE_SEMANTIC_MERGE',
        data: conflictData,
      });
    } catch (err: any) {
      console.error('[SemanticMergePanel] Failed to get conflict analysis:', err);
    }
  }

  private async resolveMerge(
    filePath: string,
    resolvedFrontmatter: Record<string, any>,
    resolvedBody: string
  ): Promise<void> {
    try {
      const res = await this.client.resolveMergeConflict(
        filePath,
        resolvedFrontmatter,
        resolvedBody
      );
      if (res.success) {
        vscode.window.showInformationMessage(
          `[+] Successfully resolved and saved HRNX node: ${filePath}`
        );
        // Refresh panel
        await this.refresh(filePath);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to resolve conflict: ${err.message}`);
    }
  }

  public dispose(): void {
    SemanticMergePanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
