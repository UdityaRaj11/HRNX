import * as vscode from 'vscode';
import * as path from 'path';
import { HRNXClient } from '../../client/hrnxClient';
import { GraphResponse, HarnessNodeData } from '../../types';

export type TreeItemKind =
  | 'category'
  | 'node'
  | 'target'
  | 'summary';

export class HRNXTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly kind: TreeItemKind,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly nodeData?: HarnessNodeData,
    public readonly categoryId?: string,
    public readonly targetId?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = kind === 'node' ? 'hrnxNode' : kind;
    this.setupVisuals();
  }

  private setupVisuals(): void {
    if (this.kind === 'category') {
      this.iconPath = new vscode.ThemeIcon(this.getCategoryIcon(this.categoryId || ''));
      return;
    }

    if (this.kind === 'target') {
      this.iconPath = new vscode.ThemeIcon('hubot', new vscode.ThemeColor('charts.purple'));
      this.tooltip = `Target Profile: ${this.label}`;
      return;
    }

    if (this.nodeData) {
      this.tooltip = `${this.nodeData.title} (${this.nodeData.id})\nType: ${this.nodeData.type}`;
      this.description = this.nodeData.id;

      // Assign icon based on type and severity
      switch (this.nodeData.type) {
        case 'directive':
          if (this.nodeData.severity === 'fatal_invariant') {
            this.iconPath = new vscode.ThemeIcon('shield', new vscode.ThemeColor('errorForeground'));
            this.tooltip += '\n[FATAL INVARIANT: High Governance Priority]';
          } else if (this.nodeData.severity === 'warning') {
            this.iconPath = new vscode.ThemeIcon('alert', new vscode.ThemeColor('editorWarning.foreground'));
          } else {
            this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
          }
          break;
        case 'skill':
          this.iconPath = new vscode.ThemeIcon('zap', new vscode.ThemeColor('charts.yellow'));
          break;
        case 'tool':
          this.iconPath = new vscode.ThemeIcon('tools', new vscode.ThemeColor('charts.blue'));
          break;
        case 'eval':
          this.iconPath = new vscode.ThemeIcon('checklist', new vscode.ThemeColor('testing.iconPassed'));
          break;
        case 'adr':
          this.iconPath = new vscode.ThemeIcon('bookmark', new vscode.ThemeColor('charts.green'));
          break;
        default:
          this.iconPath = new vscode.ThemeIcon('symbol-property');
          break;
      }

      // Command to open the source file
      if (this.nodeData.filePath) {
        this.command = {
          command: 'vscode.open',
          title: 'Open Node File',
          arguments: [vscode.Uri.file(this.nodeData.filePath)],
        };
      }
    }
  }

  private getCategoryIcon(catId: string): string {
    switch (catId) {
      case 'directives':
        return 'shield';
      case 'skills':
        return 'zap';
      case 'tools':
        return 'tools';
      case 'evals':
        return 'checklist';
      case 'adrs':
        return 'repo';
      case 'targets':
        return 'organization';
      default:
        return 'folder';
    }
  }
}

export class HRNXTreeDataProvider implements vscode.TreeDataProvider<HRNXTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<HRNXTreeItem | undefined | null | void> =
    new vscode.EventEmitter<HRNXTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<HRNXTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private cachedGraph: GraphResponse | null = null;

  constructor(private client: HRNXClient) {}

  public refresh(): void {
    this.cachedGraph = null;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HRNXTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HRNXTreeItem): Promise<HRNXTreeItem[]> {
    if (!this.cachedGraph) {
      try {
        this.cachedGraph = await this.client.getGraph();
      } catch (err) {
        // Return placeholder error item if LSP is starting up
        return [
          new HRNXTreeItem(
            'LSP Connecting or Loading...',
            'summary',
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
    }

    const graph = this.cachedGraph;
    if (!element) {
      // Top-level categories
      const directivesCount = graph.nodes.filter((n) => n.type === 'directive').length;
      const skillsCount = graph.nodes.filter((n) => n.type === 'skill').length;
      const toolsCount = graph.nodes.filter((n) => n.type === 'tool').length;
      const evalsCount = graph.nodes.filter((n) => n.type === 'eval').length;
      const adrsCount = graph.nodes.filter((n) => n.type === 'adr').length;
      const targetsCount = graph.availableTargets?.length || 7;

      const healthIcon = graph.health.is_healthy ? '✓ Validated' : `⚠ ${graph.health.cycles.length + graph.health.dangling_references.length} Issues`;

      return [
        new HRNXTreeItem(
          `Directives (${directivesCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          'directives'
        ),
        new HRNXTreeItem(
          `Skills & Workflows (${skillsCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'skills'
        ),
        new HRNXTreeItem(
          `Capabilities & Tools (${toolsCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'tools'
        ),
        new HRNXTreeItem(
          `Evaluations & Tests (${evalsCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'evals'
        ),
        new HRNXTreeItem(
          `Architectural Decisions (${adrsCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'adrs'
        ),
        new HRNXTreeItem(
          `Target Profiles (${targetsCount})`,
          'category',
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          'targets'
        ),
      ];
    }

    if (element.kind === 'category') {
      const catId = element.categoryId;
      if (catId === 'directives') {
        const directives = graph.nodes.filter((n) => n.type === 'directive');
        return directives.map(
          (n) => new HRNXTreeItem(n.title, 'node', vscode.TreeItemCollapsibleState.None, n)
        );
      }
      if (catId === 'skills') {
        const skills = graph.nodes.filter((n) => n.type === 'skill');
        return skills.map(
          (n) => new HRNXTreeItem(n.title, 'node', vscode.TreeItemCollapsibleState.None, n)
        );
      }
      if (catId === 'tools') {
        const tools = graph.nodes.filter((n) => n.type === 'tool');
        return tools.map(
          (n) => new HRNXTreeItem(n.title, 'node', vscode.TreeItemCollapsibleState.None, n)
        );
      }
      if (catId === 'evals') {
        const evals = graph.nodes.filter((n) => n.type === 'eval');
        return evals.map(
          (n) => new HRNXTreeItem(n.title, 'node', vscode.TreeItemCollapsibleState.None, n)
        );
      }
      if (catId === 'adrs') {
        const adrs = graph.nodes.filter((n) => n.type === 'adr');
        return adrs.map(
          (n) => new HRNXTreeItem(n.title, 'node', vscode.TreeItemCollapsibleState.None, n)
        );
      }
      if (catId === 'targets') {
        const defaultTargets = [
          { id: 'claude', name: 'Anthropic Claude Code (CLAUDE.md)' },
          { id: 'antigravity', name: 'Google Antigravity (.agent/)' },
          { id: 'codex', name: 'OpenAI Codex & Assistants (.openai/)' },
          { id: 'cursor', name: 'Cursor (.cursorrules & .mdc)' },
          { id: 'copilot', name: 'GitHub Copilot (copilot-instructions.md)' },
          { id: 'openhands', name: 'OpenHands / OpenCode (.openhands/)' },
          { id: 'aider', name: 'Aider (CONVENTIONS.md)' },
        ];
        const targets = graph.availableTargets?.length ? graph.availableTargets : defaultTargets;
        return targets.map(
          (t) =>
            new HRNXTreeItem(
              t.name,
              'target',
              vscode.TreeItemCollapsibleState.None,
              undefined,
              undefined,
              t.id
            )
        );
      }
    }

    return [];
  }
}
