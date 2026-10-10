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
exports.getWebviewContent = getWebviewContent;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function getWebviewContent(webview, extensionUri, initialView, initialTarget = 'claude') {
    // Locate compiled assets in dist/webview/assets
    const distWebview = path.join(extensionUri.fsPath, 'dist', 'webview');
    const assetsDir = path.join(distWebview, 'assets');
    let scriptUri = '';
    let styleUri = '';
    if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const jsFile = files.find((f) => f.endsWith('.js'));
        const cssFile = files.find((f) => f.endsWith('.css'));
        if (jsFile) {
            scriptUri = webview
                .asWebviewUri(vscode.Uri.file(path.join(assetsDir, jsFile)))
                .toString();
        }
        if (cssFile) {
            styleUri = webview
                .asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile)))
                .toString();
        }
    }
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HRNX Webview</title>
    ${styleUri ? `<link rel="stylesheet" href="${styleUri}" />` : ''}
  </head>
  <body class="bg-zinc-950 text-zinc-100">
    <div id="root"></div>
    <script nonce="${nonce}">
      window.initialHRNXConfig = {
        view: '${initialView}',
        target: '${initialTarget}'
      };
    </script>
    ${scriptUri ? `<script nonce="${nonce}" type="module" src="${scriptUri}"></script>` : '<div class="p-4 text-amber-400">Webview bundle not built yet. Run npm run build:webview.</div>'}
  </body>
</html>`;
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=webviewUtils.js.map