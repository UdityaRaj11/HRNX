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
exports.HRNXClient = void 0;
const vscode = __importStar(require("vscode"));
const node_1 = require("vscode-languageclient/node");
const serverManager_1 = require("./serverManager");
class HRNXClient {
    context;
    client = null;
    outputChannel;
    isReady = false;
    constructor(context) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('HRNX Language Server');
    }
    async start() {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const executable = serverManager_1.ServerManager.resolveServerExecutable(workspaceRoot);
        this.outputChannel.appendLine(`Starting hrnx-lsp: ${executable.command} ${executable.args.join(' ')}`);
        const serverOptions = {
            command: executable.command,
            args: executable.args,
            options: {
                cwd: workspaceRoot,
            },
        };
        const clientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'markdown' },
                { scheme: 'file', pattern: '**/.hrnx/**/*.md' },
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/.hrnx/**/*.md'),
            },
            outputChannel: this.outputChannel,
        };
        this.client = new node_1.LanguageClient('hrnxLanguageServer', 'HRNX Language Server', serverOptions, clientOptions);
        try {
            await this.client.start();
            this.isReady = true;
            this.outputChannel.appendLine('hrnx-lsp Language Server started successfully.');
        }
        catch (err) {
            this.outputChannel.appendLine(`Failed to start hrnx-lsp: ${String(err)}`);
        }
    }
    async stop() {
        if (this.client) {
            await this.client.stop();
            this.client = null;
            this.isReady = false;
        }
    }
    getRawClient() {
        return this.client;
    }
    async getGraph() {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/getGraph', {});
    }
    async getBlastRadius(nodeId) {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/getBlastRadius', {
            nodeId,
        });
    }
    async previewTranspile(nodeId, targetAgent = 'claude', docText, docPath) {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/previewTranspile', {
            nodeId,
            targetAgent,
            docText,
            docPath,
        });
    }
    async inspectDrift() {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/inspectDrift', {});
    }
    async reconcile(targetId) {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/reconcile', { targetId });
    }
    async runEvaluations(evalIds) {
        if (!this.client || !this.isReady) {
            throw new Error('Language Server is not active');
        }
        return await this.client.sendRequest('hrnx/runEvaluations', {
            evalIds,
        });
    }
}
exports.HRNXClient = HRNXClient;
//# sourceMappingURL=hrnxClient.js.map