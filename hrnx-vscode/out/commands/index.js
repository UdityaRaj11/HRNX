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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const previewPanel_1 = require("../panels/previewPanel");
const blastRadiusPanel_1 = require("../panels/blastRadiusPanel");
function registerCommands(context, client, treeProvider, driftProvider) {
    // 1. Open Blast Radius Canvas
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.openBlastRadius', (item) => {
        const nodeId = item?.nodeData?.id;
        blastRadiusPanel_1.BlastRadiusPanel.createOrShow(context.extensionUri, client, nodeId);
    }));
    // 2. Open Live Transpiler Preview
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.openPreview', (item) => {
        const panel = previewPanel_1.PreviewPanel.createOrShow(context.extensionUri, client);
        if (item?.nodeData?.id) {
            panel.update(item.nodeData.id);
        }
    }));
    // 3. Reconcile / Overwrite all drifted agent files
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.reconcileDrift', async () => {
        const confirm = await vscode.window.showWarningMessage('Reconcile will overwrite all drifted agent configuration files (CLAUDE.md, .cursorrules, etc.) with canonical definitions. Proceed?', { modal: true }, 'Reconcile All');
        if (confirm === 'Reconcile All') {
            try {
                const res = await client.reconcile();
                vscode.window.showInformationMessage(`Reconciliation complete: ${res.reconciledFiles.length} files aligned with canonical harness.`);
                driftProvider.refresh();
                treeProvider.refresh();
            }
            catch (err) {
                vscode.window.showErrorMessage(`Reconcile failed: ${String(err)}`);
            }
        }
    }));
    // 4. Reconcile selected target
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.reconcileTarget', async (item) => {
        const target = item?.driftData?.target;
        try {
            const res = await client.reconcile(target);
            vscode.window.showInformationMessage(`Target '${target}' reconciled successfully (${res.reconciledFiles.length} files updated).`);
            driftProvider.refresh();
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to reconcile target: ${String(err)}`);
        }
    }));
    // 5. Refresh Views
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.refreshViews', () => {
        treeProvider.refresh();
        driftProvider.refresh();
        vscode.window.showInformationMessage('HRNX views refreshed.');
    }));
    // 6. Run All Impacted Evals
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.runAllEvals', async () => {
        try {
            const results = await client.runEvaluations();
            if (results.failed === 0) {
                vscode.window.showInformationMessage(`All ${results.total} evaluation suites passed successfully!`);
            }
            else {
                vscode.window.showWarningMessage(`Evaluations completed: ${results.passed} passed, ${results.failed} failed.`);
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`Failed to run evaluations: ${String(err)}`);
        }
    }));
    // 7. Create New Directive
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.createDirective', async () => {
        const id = await vscode.window.showInputBox({
            prompt: 'Enter Directive ID (e.g., dir.auth.rate-limiting)',
            value: 'dir.',
            validateInput: (v) => (v.startsWith('dir.') ? null : 'Directive ID must start with "dir."'),
        });
        if (!id)
            return;
        const title = await vscode.window.showInputBox({
            prompt: 'Enter Directive Title',
            value: 'Rate Limiting Policy',
        });
        if (!title)
            return;
        const rawClient = client.getRawClient();
        if (rawClient) {
            await rawClient.sendRequest('workspace/executeCommand', {
                command: 'hrnx.createSkeletonNode',
                arguments: [id],
            });
            treeProvider.refresh();
            vscode.window.showInformationMessage(`Created directive skeleton: ${id}`);
        }
    }));
    // 8. Create New Skill
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.createSkill', async () => {
        const id = await vscode.window.showInputBox({
            prompt: 'Enter Skill ID (e.g., skill.db.rollback)',
            value: 'skill.',
            validateInput: (v) => (v.startsWith('skill.') ? null : 'Skill ID must start with "skill."'),
        });
        if (!id)
            return;
        const rawClient = client.getRawClient();
        if (rawClient) {
            await rawClient.sendRequest('workspace/executeCommand', {
                command: 'hrnx.createSkeletonNode',
                arguments: [id],
            });
            treeProvider.refresh();
            vscode.window.showInformationMessage(`Created skill skeleton: ${id}`);
        }
    }));
    // 9. Create Architectural Decision Record (ADR)
    context.subscriptions.push(vscode.commands.registerCommand('hrnx.createADR', async () => {
        const id = await vscode.window.showInputBox({
            prompt: 'Enter ADR ID (e.g., ADR-002-jwt-auth)',
            value: 'ADR-',
            validateInput: (v) => (v.startsWith('ADR-') ? null : 'ADR ID must start with "ADR-"'),
        });
        if (!id)
            return;
        const rawClient = client.getRawClient();
        if (rawClient) {
            await rawClient.sendRequest('workspace/executeCommand', {
                command: 'hrnx.createSkeletonNode',
                arguments: [id],
            });
            treeProvider.refresh();
            vscode.window.showInformationMessage(`Created ADR skeleton: ${id}`);
        }
    }));
}
//# sourceMappingURL=index.js.map