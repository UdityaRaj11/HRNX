"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const hrnxClient_1 = require("./client/hrnxClient");
const hrnxTreeView_1 = require("./views/explorer/hrnxTreeView");
const driftView_1 = require("./views/drift/driftView");
const commands_1 = require("./commands");
const previewPanel_1 = require("./panels/previewPanel");
let client = null;
async function activate(context) {
    console.log('[HRNX] Activating HRNX Extension (Stream 2)...');
    // 1. Initialize and start the Language Client
    client = new hrnxClient_1.HRNXClient(context);
    await client.start();
    // 2. Register Tree View Providers
    const treeProvider = new hrnxTreeView_1.HRNXTreeDataProvider(client);
    const driftProvider = new driftView_1.DriftTreeDataProvider(client);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('hrnx.navigator', treeProvider));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('hrnx.drift', driftProvider));
    // 3. Register All Commands
    (0, commands_1.registerCommands)(context, client, treeProvider, driftProvider);
    // 4. File Watcher to auto-refresh TreeViews on changes to .hrnx/
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/.hrnx/**/*.md');
    fileWatcher.onDidChange(() => {
        treeProvider.refresh();
        driftProvider.refresh();
    });
    fileWatcher.onDidCreate(() => {
        treeProvider.refresh();
        driftProvider.refresh();
    });
    fileWatcher.onDidDelete(() => {
        treeProvider.refresh();
        driftProvider.refresh();
    });
    context.subscriptions.push(fileWatcher);
    // 5. Watch for active editor changes: if opening a .hrnx file and autoOpenPreview is true, open preview
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (!editor)
            return;
        const fsPath = editor.document.uri.fsPath;
        if (fsPath.includes('.hrnx') && fsPath.endsWith('.md')) {
            const config = vscode.workspace.getConfiguration('hrnx');
            if (config.get('autoOpenPreview', false)) {
                previewPanel_1.PreviewPanel.createOrShow(context.extensionUri, client);
            }
        }
    }));
    console.log('[HRNX] HRNX Extension activated successfully.');
}
async function deactivate() {
    console.log('[HRNX] Deactivating HRNX Extension...');
    if (client) {
        await client.stop();
        client = null;
    }
}
//# sourceMappingURL=extension.js.map