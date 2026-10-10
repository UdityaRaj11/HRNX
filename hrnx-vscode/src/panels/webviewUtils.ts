import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  initialView: 'preview' | 'blast-radius' | 'conformance',
  initialTarget = 'claude'
): string {
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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
