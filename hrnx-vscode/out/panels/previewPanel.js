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
exports.PreviewPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const webviewUtils_1 = require("./webviewUtils");
class PreviewPanel {
    client;
    static currentPanel;
    panel;
    extensionUri;
    disposables = [];
    activeTarget = 'claude';
    debounceTimer = null;
    lastActiveDocText;
    lastActiveDocPath;
    lastActiveNodeId;
    constructor(panel, extensionUri, client) {
        this.client = client;
        this.panel = panel;
        this.extensionUri = extensionUri;
        const config = vscode.workspace.getConfiguration('hrnx');
        this.activeTarget = config.get('defaultTargetAgent', 'claude');
        this.panel.webview.html = (0, webviewUtils_1.getWebviewContent)(this.panel.webview, this.extensionUri, 'preview', this.activeTarget);
        // Track initial document if open
        const initEditor = vscode.window.activeTextEditor;
        if (initEditor && initEditor.document.uri.scheme === 'file') {
            this.lastActiveDocText = initEditor.document.getText();
            this.lastActiveDocPath = initEditor.document.uri.fsPath;
        }
        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
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
            }
        }, null, this.disposables);
        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor && editor.document.uri.scheme === 'file' && editor.document.uri.fsPath.endsWith('.md')) {
                this.lastActiveDocText = editor.document.getText();
                this.lastActiveDocPath = editor.document.uri.fsPath;
                this.lastActiveNodeId = undefined;
            }
            this.triggerDebouncedUpdate();
        }, null, this.disposables);
        // Watch for document modifications in real-time
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.uri.scheme === 'file' && e.document.uri.fsPath.endsWith('.md')) {
                this.lastActiveDocText = e.document.getText();
                this.lastActiveDocPath = e.document.uri.fsPath;
                this.triggerDebouncedUpdate();
            }
        }, null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }
    static createOrShow(extensionUri, client) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;
        if (PreviewPanel.currentPanel) {
            PreviewPanel.currentPanel.panel.reveal(column);
            PreviewPanel.currentPanel.update();
            return PreviewPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('hrnxPreview', 'HRNX Live Transpiler Preview', { viewColumn: column, preserveFocus: true }, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionUri.fsPath, 'dist', 'webview')),
                vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
            ],
        });
        PreviewPanel.currentPanel = new PreviewPanel(panel, extensionUri, client);
        return PreviewPanel.currentPanel;
    }
    triggerDebouncedUpdate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.update();
        }, 200);
    }
    async update(explicitNodeId) {
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
            const data = await this.client.previewTranspile(nodeId, this.activeTarget, docText, docPath);
            this.panel.webview.postMessage({
                type: 'UPDATE_PREVIEW',
                data,
                activeTarget: this.activeTarget,
            });
        }
        catch (err) {
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
    async syncToDisk(target) {
        try {
            const res = await this.client.reconcile(target);
            vscode.window.showInformationMessage(`Successfully synced canonical harness to target: ${target.toUpperCase()} (${res.reconciledFiles.length} files written)`);
            await this.update();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to sync to disk: ${String(err)}`);
        }
    }
    async openFile(filename) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot)
            return;
        const fullPath = path.join(workspaceRoot, filename);
        const uri = vscode.Uri.file(fullPath);
        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
        }
        catch (err) {
            vscode.window.showWarningMessage(`Could not open file: ${filename}`);
        }
    }
    dispose() {
        PreviewPanel.currentPanel = undefined;
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d)
                d.dispose();
        }
    }
}
exports.PreviewPanel = PreviewPanel;
//# sourceMappingURL=previewPanel.js.map