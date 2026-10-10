import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HRNXClient } from '../../client/hrnxClient';
import { DriftItemData, DriftReportData } from '../../types';

export class DriftTreeItem extends vscode.TreeItem {
  constructor(
    public readonly driftData: DriftItemData,
    public readonly isSummary = false
  ) {
    super(driftData.relative_path, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'driftItem';
    this.setupVisuals();
  }

  private setupVisuals(): void {
    const status = this.driftData.status;
    this.description = `[${this.driftData.target.toUpperCase()}] ${status.replace('_', ' ')}`;

    if (status === 'in_sync') {
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      this.tooltip = `In Sync with Canonical Graph\nPath: ${this.driftData.relative_path}`;
    } else if (status === 'drifted') {
      this.iconPath = new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('editorWarning.foreground'));
      this.tooltip = `DRIFT DETECTED: File was modified manually outside HRNX!\nClick to inspect or reconcile.`;
    } else {
      this.iconPath = new vscode.ThemeIcon('diff-removed', new vscode.ThemeColor('errorForeground'));
      this.tooltip = `File missing on disk. Click Reconcile to generate.`;
    }

    if (fs.existsSync(this.driftData.absolute_path)) {
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [vscode.Uri.file(this.driftData.absolute_path)],
      };
    }
  }
}

export class DriftTreeDataProvider implements vscode.TreeDataProvider<DriftTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DriftTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DriftTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DriftTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private cachedReport: DriftReportData | null = null;

  constructor(private client: HRNXClient) {}

  public refresh(): void {
    this.cachedReport = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DriftTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DriftTreeItem): Promise<DriftTreeItem[]> {
    if (element) {
      return [];
    }

    try {
      this.cachedReport = await this.client.inspectDrift();
    } catch (err) {
      return [];
    }

    const items = this.cachedReport.items;
    // Sort so drifted and missing come first
    return items
      .slice()
      .sort((a, b) => {
        const order = { drifted: 0, missing: 1, in_sync: 2 };
        return order[a.status] - order[b.status];
      })
      .map((item) => new DriftTreeItem(item));
  }
}
