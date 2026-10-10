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
exports.DriftTreeDataProvider = exports.DriftTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class DriftTreeItem extends vscode.TreeItem {
    driftData;
    isSummary;
    constructor(driftData, isSummary = false) {
        super(driftData.relative_path, vscode.TreeItemCollapsibleState.None);
        this.driftData = driftData;
        this.isSummary = isSummary;
        this.contextValue = 'driftItem';
        this.setupVisuals();
    }
    setupVisuals() {
        const status = this.driftData.status;
        this.description = `[${this.driftData.target.toUpperCase()}] ${status.replace('_', ' ')}`;
        if (status === 'in_sync') {
            this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
            this.tooltip = `In Sync with Canonical Graph\nPath: ${this.driftData.relative_path}`;
        }
        else if (status === 'drifted') {
            this.iconPath = new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('editorWarning.foreground'));
            this.tooltip = `DRIFT DETECTED: File was modified manually outside HRNX!\nClick to inspect or reconcile.`;
        }
        else {
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
exports.DriftTreeItem = DriftTreeItem;
class DriftTreeDataProvider {
    client;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    cachedReport = null;
    constructor(client) {
        this.client = client;
    }
    refresh() {
        this.cachedReport = null;
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        try {
            this.cachedReport = await this.client.inspectDrift();
        }
        catch (err) {
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
exports.DriftTreeDataProvider = DriftTreeDataProvider;
//# sourceMappingURL=driftView.js.map