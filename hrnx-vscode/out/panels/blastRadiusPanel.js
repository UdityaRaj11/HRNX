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
exports.BlastRadiusPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const webviewUtils_1 = require("./webviewUtils");
class BlastRadiusPanel {
    client;
    static currentPanel;
    panel;
    extensionUri;
    disposables = [];
    currentNodeId = null;
    constructor(panel, extensionUri, client) {
        this.client = client;
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.panel.webview.html = (0, webviewUtils_1.getWebviewContent)(this.panel.webview, this.extensionUri, 'blast-radius');
        // Handle messages from the React Flow canvas
        this.panel.webview.onDidReceiveMessage(async (message) => {
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
        }, null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }
    static createOrShow(extensionUri, client, nodeId) {
        const column = vscode.ViewColumn.Two;
        if (BlastRadiusPanel.currentPanel) {
            BlastRadiusPanel.currentPanel.panel.reveal(column);
            if (nodeId) {
                BlastRadiusPanel.currentPanel.focusNode(nodeId);
            }
            else {
                BlastRadiusPanel.currentPanel.refresh();
            }
            return BlastRadiusPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('hrnxBlastRadius', 'HRNX Blast Radius & Impact DAG', { viewColumn: column, preserveFocus: true }, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(extensionUri.fsPath, 'dist', 'webview')),
                vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
            ],
        });
        BlastRadiusPanel.currentPanel = new BlastRadiusPanel(panel, extensionUri, client);
        if (nodeId) {
            BlastRadiusPanel.currentPanel.currentNodeId = nodeId;
        }
        return BlastRadiusPanel.currentPanel;
    }
    async focusNode(nodeId) {
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
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to calculate blast radius for ${nodeId}: ${String(err)}`);
        }
    }
    async loadFullGraph() {
        this.currentNodeId = null;
        try {
            const fullGraph = await this.client.getGraph();
            this.panel.webview.postMessage({
                type: 'UPDATE_FULL_GRAPH',
                data: fullGraph,
            });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to load knowledge DAG: ${String(err)}`);
        }
    }
    async refresh() {
        if (this.currentNodeId) {
            await this.focusNode(this.currentNodeId);
        }
        else {
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
    async runEvaluations(evalIds) {
        this.panel.webview.postMessage({ type: 'EVAL_STARTED' });
        try {
            const results = await this.client.runEvaluations(evalIds);
            this.panel.webview.postMessage({
                type: 'EVAL_FINISHED',
                results,
            });
            if (results.failed > 0) {
                vscode.window.showWarningMessage(`Evaluations completed: ${results.passed} passed, ${results.failed} failed.`);
            }
            else {
                vscode.window.showInformationMessage(`All ${results.passed} impacted evaluations passed with zero regressions!`);
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to run evaluations: ${String(err)}`);
            this.panel.webview.postMessage({
                type: 'EVAL_FINISHED',
                results: { total: 0, passed: 0, failed: 0, results: [] },
            });
        }
    }
    async openFile(filePath) {
        if (!filePath)
            return;
        try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
        }
        catch (err) {
            vscode.window.showWarningMessage(`Could not open file: ${filePath}`);
        }
    }
    dispose() {
        BlastRadiusPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d)
                d.dispose();
        }
    }
}
exports.BlastRadiusPanel = BlastRadiusPanel;
//# sourceMappingURL=blastRadiusPanel.js.map