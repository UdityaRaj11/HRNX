import * as vscode from 'vscode';
import { HRNXClient } from './client/hrnxClient';
import { HRNXTreeDataProvider } from './views/explorer/hrnxTreeView';
import { DriftTreeDataProvider } from './views/drift/driftView';
import { registerCommands } from './commands';
import { PreviewPanel } from './panels/previewPanel';
import { HRNXTestController } from './testing/testController';
import { RelayClient } from './collaboration/relayClient';
import { CollabStatusBar } from './collaboration/collabStatusBar';
import { GitManager } from './git/gitManager';

let client: HRNXClient | null = null;
let testController: HRNXTestController | null = null;
let relayClient: RelayClient | null = null;
let collabStatusBar: CollabStatusBar | null = null;
let gitManager: GitManager | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[HRNX] Activating HRNX Extension (Stream 2, Stream 4 & Stream 5)...');

  // 1. Initialize and start the Language Client
  client = new HRNXClient(context);
  await client.start();

  // 1b. Initialize Native VS Code Test Controller (Stream 4)
  testController = new HRNXTestController(context, client);
  await testController.initialize();
  context.subscriptions.push(testController);

  // 1c. Initialize Multiplayer Live Relay Client & Status Bar (Stream 5)
  relayClient = new RelayClient();
  collabStatusBar = new CollabStatusBar(relayClient, client);
  context.subscriptions.push(collabStatusBar);

  // 1d. Initialize Git Manager & Multi-Target Sync Status (Stream 5)
  gitManager = new GitManager(client);
  context.subscriptions.push(gitManager);

  // 2. Register Tree View Providers
  const treeProvider = new HRNXTreeDataProvider(client);
  const driftProvider = new DriftTreeDataProvider(client);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('hrnx.navigator', treeProvider)
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('hrnx.drift', driftProvider)
  );

  // 3. Register All Commands
  registerCommands(context, client, treeProvider, driftProvider, collabStatusBar, gitManager);

  // 4. File Watcher to auto-refresh TreeViews on changes to .hrnx/
  const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.hrnx/**/*.md');
  fileWatcher.onDidChange(() => {
    treeProvider.refresh();
    driftProvider.refresh();
    gitManager?.checkSyncStatus();
  });
  fileWatcher.onDidCreate(() => {
    treeProvider.refresh();
    driftProvider.refresh();
    gitManager?.checkSyncStatus();
  });
  fileWatcher.onDidDelete(() => {
    treeProvider.refresh();
    driftProvider.refresh();
    gitManager?.checkSyncStatus();
  });
  context.subscriptions.push(fileWatcher);

  // 5. Watch for active editor changes: if opening a .hrnx file and autoOpenPreview is true, open preview
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      const fsPath = editor.document.uri.fsPath;
      if (fsPath.includes('.hrnx') && fsPath.endsWith('.md')) {
        const config = vscode.workspace.getConfiguration('hrnx');
        if (config.get<boolean>('autoOpenPreview', false)) {
          PreviewPanel.createOrShow(context.extensionUri, client!);
        }
      }
    })
  );

  console.log('[HRNX] HRNX Extension activated successfully with Stream 5 multiplayer collaboration & git sync.');
}

export async function deactivate(): Promise<void> {
  console.log('[HRNX] Deactivating HRNX Extension...');
  if (relayClient) {
    relayClient.disconnect();
    relayClient = null;
  }
  if (collabStatusBar) {
    collabStatusBar.dispose();
    collabStatusBar = null;
  }
  if (gitManager) {
    gitManager.dispose();
    gitManager = null;
  }
  if (client) {
    await client.stop();
    client = null;
  }
}
