const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying HRNX VS Code Extension Build ---');

// 1. Verify extension bundle
const extensionBundle = path.join(__dirname, '..', 'dist', 'extension.js');
assert(fs.existsSync(extensionBundle), 'dist/extension.js must exist');
const extStat = fs.statSync(extensionBundle);
console.log(`[PASS] Extension bundle exists (${(extStat.size / 1024).toFixed(1)} KB)`);

// 2. Verify webview assets
const webviewAssets = path.join(__dirname, '..', 'dist', 'webview', 'assets');
assert(fs.existsSync(webviewAssets), 'dist/webview/assets must exist');
const files = fs.readdirSync(webviewAssets);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));
assert(jsFile, 'Webview JS asset must be generated');
assert(cssFile, 'Webview CSS asset must be generated');
console.log(`[PASS] Webview bundle exists (JS: ${jsFile}, CSS: ${cssFile})`);

// 3. Verify package.json contributions
const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
);
assert.strictEqual(pkg.name, 'hrnx-vscode');
assert(pkg.contributes.viewsContainers.activitybar.length > 0, 'Activity bar container defined');
assert(pkg.contributes.views['hrnx-sidebar'].length === 2, 'Sidebar views defined (navigator & drift)');
assert(pkg.contributes.commands.length >= 13, 'All 13 Stream 2, Stream 4 & Stream 5 commands registered');
const cmdIds = pkg.contributes.commands.map((c) => c.command);
assert(cmdIds.includes('hrnx.openSemanticMerge'), 'hrnx.openSemanticMerge command registered');
assert(cmdIds.includes('hrnx.atomicCommit'), 'hrnx.atomicCommit command registered');
assert(cmdIds.includes('hrnx.installGitHooks'), 'hrnx.installGitHooks command registered');
assert(cmdIds.includes('hrnx.collabSessionMenu'), 'hrnx.collabSessionMenu command registered');
console.log(`[PASS] Package.json contributes ${pkg.contributes.commands.length} commands (including Stream 5 commands) and 2 sidebar views`);

// 4. Verify activity bar icon
const iconPath = path.join(__dirname, '..', 'media', 'icons', 'hrnx-activitybar.svg');
assert(fs.existsSync(iconPath), 'Activity bar SVG icon exists');
console.log('[PASS] Activity bar SVG icon present');

console.log('--- All HRNX VS Code Extension Verifications Passed! ---');
