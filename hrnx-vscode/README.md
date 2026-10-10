# HRNX for VS Code (`hrnx-vscode`)

> **The AI-Native Harness Engineering IDE — Stream 2: Frontend & Developer Experience**

[![Extension: VS Code](https://img.shields.io/badge/extension-VS%20Code%201.85+-blue.svg)](https://code.visualstudio.com/)
[![React: 18](https://img.shields.io/badge/webview-React%2018-cyan.svg)](https://react.dev/)
[![Canvas: React Flow](https://img.shields.io/badge/graph-React%20Flow%2011-purple.svg)](https://reactflow.dev/)
[![Styling: Tailwind CSS](https://img.shields.io/badge/styles-Tailwind%20CSS-38bdf8.svg)](https://tailwindcss.com/)
[![Protocol: JSON--RPC LSP](https://img.shields.io/badge/protocol-LSP%20over%20stdio-green.svg)](https://microsoft.github.io/language-server-protocol/)

---

## 1. Overview & Architecture

`hrnx-vscode` provides the visual developer experience for the **HRNX Harness Engineering Platform**. It bridges traditional code editing with **visual knowledge engineering, real-time multi-agent compilation previews, interactive blast-radius dependency graphs, and agent configuration drift governance**.

```text
+----------------------------------------------------------------------------------------------------+
| VS CODE / CURSOR WORKSPACE                                                                        |
+--------------------------+----------------------------------------+--------------------------------+
| HRNX NAVIGATOR           | CANONICAL NODE EDITOR                  | LIVE COMPILED ARTIFACT         |
|                          |                                        | (Select Target: 7+ Agents)     |
| v Directives             | ```yaml                                |                                |
|   - auth.rbac.md         | id: dir.auth.jwt-validation            | Target: [ Claude Code v ]      |
|   * db.migrations.md     | severity: fatal_invariant              | ------------------------------ |
| > Skills                 | depends_on: [dir.auth.tokens]          | <rule id="jwt-validation">     |
| > Capabilities (Tools)   | ```                                    |   All incoming HTTP requests   |
| > Evaluations            |                                        |   must validate RS256 JWTs     |
| > Target Profiles        | All API routes must validate RS256     |   before routing to handlers.  |
|   (Claude, Antigravity,  | JWT signatures before dispatching...   | </rule>                        |
|    Codex, Cursor, etc.)  |                                        |                                |
+--------------------------+----------------------------------------+--------------------------------+
| INTERACTIVE BLAST RADIUS CANVAS (React Flow Webview)                                              |
| [ADR-012] ---> (dir.auth.jwt-validation) [MODIFIED] ===> [eval.auth.test-token] (EVAL REQUIRED)    |
|                               |                                                                    |
|                               +---> [skill.api.scaffold] (Direct Impact, Needs Review)             |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Core Frontend Components

### 2.1 HRNX Explorer Sidebar (`hrnx.navigator`)
- **Categorized TreeView**: Organizes nodes into `Architectural Decisions` (ADRs), `Directives`, `Skills & Workflows`, `Capabilities & Tools`, `Evaluations & Tests`, and `Target Profiles`.
- **Health & Severity Badges**:
  - `fatal_invariant`: High-priority red shield icon with strict governance warnings.
  - `warning`: Amber warning icon.
  - `advisory`: Informational blue icon.
  - `eval`: Emerald checklist icon showing test validation status.
- **One-Click Navigation**: Clicking any node opens the source `.md` file directly in the editor.

### 2.2 Dual-Pane Live Multi-Agent Transpilation Preview
- **Real-Time Split Editor**: Automatic side-by-side view (`ViewColumn.Beside`) updating dynamically as you author or edit canonical `.hrnx` nodes.
- **Universal Multi-Agent Dropdown (10 Target Coding Agents)**: Instant preview across:
  - 🤖 **Anthropic Claude Code** (`CLAUDE.md`)
  - ⚡ **Google Antigravity** (`.agent/rules.md` / `SKILL.md`)
  - 🧠 **OpenAI Codex & Assistants** (`.openai/instructions.md` & `tools.json`)
  - 🎯 **Cursor** (`.cursorrules` & `.cursor/rules/*.mdc`)
  - 🐙 **GitHub Copilot** (`.github/copilot-instructions.md`)
  - 🛠️ **OpenHands / OpenCode** (`.openhands/instructions.md` & microagents)
  - 📝 **Aider** (`CONVENTIONS.md`)
  - 🚀 **Cline & Roo Code** (`.clinerules` & `.roomodes` custom modes)
  - 🏄 **Windsurf (Codeium)** (`.windsurfrules`)
  - 🪿 **Goose (Block)** (`.goosehints` & `.goose/config.yaml`)
- **Compatibility & Degradation Diagnostics Engine**: Real-time inspection badges detecting feature gaps before deployment:
  - `✓ Full Fidelity`: Lossless translation with native primitives (e.g. Claude XML, Antigravity MCP/Skills, Roo custom modes).
  - `⚠️ Lossy Fallback`: Automatic graceful degradation with warnings (e.g. subagents synthesized to sequential prompt checklists in Copilot/Goose/Windsurf).
- **Native Side-by-Side Diffing**: "Native Diff" button launches VS Code's rich diff editor (`vscode.diff`) comparing disk configurations with live in-memory preview buffers.
- **Diff vs. Disk (Embedded Tab)**: Automatically detects if the active target file on disk differs from canonical compilation, displaying line-by-line colored diffs.
- **1-Click Sync**: "Sync to Disk" button overwrites or generates target agent configs directly.

### 2.3 Interactive Blast Radius Canvas (React Flow Webview)
- **Visual Subgraph Engine**: Powered by `@xyflow/react` (React Flow) and **Dagre hierarchical auto-layout** (Horizontal `LR` or Vertical `TB`).
- **Color-Coded Risk Levels**:
  - **Origin Node**: Glowing indigo border (`MODIFIED / ORIGIN`).
  - **Fatal Broken Risk**: High-risk red border (`FATAL RISK`).
  - **Required Evals**: Emerald border (`EVAL REQUIRED`).
  - **Direct Impact**: Amber border (`DIRECT DEPENDENT`).
  - **Transitive Impact**: Slate border (`TRANSITIVE CLOSURE`).
- **Interactive "Re-run Impacted Tests"**: Executes test suites validating the impacted invariants and renders live pass/fail test results on canvas.
- **Slide-in Node Detail Drawer**: Inspects node frontmatter, dependencies, invariants, and allows focusing the blast radius on any node with 1 click.

### 2.4 Agent Drift & Governance Inspector (`hrnx.drift`)
- **Continuous Drift Detection**: Scans generated agent configurations (`CLAUDE.md`, `.cursorrules`, etc.) and alerts the engineer if a file was modified outside of HRNX.
- **Reconciliation Engine**:
  - 1-click **"Reconcile Target"** to overwrite individual out-of-sync files.
  - Global **"Reconcile / Overwrite Drifted Agent Files"** command to align the entire repository.

### 2.5 Native VS Code Test Controller (`Testing` Activity Bar)
- **Standard Testing Tree**: Discovers `.hrnx/evals/*.md` and generates hierarchical test items with child agent targets (`[claude]`, `[antigravity]`, `[codex]`, `[cursor]`).
- **Standard VS Code Run / Debug Handlers**: Execute suites directly from the Testing panel with real-time pass/fail indicators, execution durations, and assertion failure diff messages.
- **Dynamic File Watcher**: Automatically refreshes test suites as evaluation markdown files are authored or updated.

### 2.6 Cross-Agent Conformance Benchmark Matrix (`hrnx.openConformanceMatrix`)
- **Multi-Agent Evaluation Webview**: Interactive grid comparing behavioral adherence to canonical invariants across 10 coding agent targets.
- **Agreement Index Gauge**: Real-time cross-agent consistency percentage (e.g., 100% agreement).
- **Divergence Warning Engine**: Highlights cases where different agents make contradictory decisions on the same invariant rule.
- **Execution Inspector Drawer**: Slide-in inspection panel displaying the dispatched synthetic prompt, assertion breakdown, agent transcript, and runtime duration.

### 2.7 Visual 3-Way AST Semantic Merge Panel (`hrnx.openSemanticMerge`)
- **Field-by-Field 3-Way Diffing**: Compares **Base**, **Ours**, and **Theirs** AST structures with syntax highlighting.
- **1-Click Conflict Resolution**: Accept "Ours", accept "Theirs", or "Smart Combine" to synthesize joint directives.
- **Live Resolved Preview**: Real-time syntax-checked preview of the resulting document before saving back to disk.

### 2.8 Multiplayer Collaboration & Live Sessions (`hrnx.collabSessionMenu`)
- **Status Bar Presence Indicator**: Shows live peer count (`👥 HRNX: 2 peers`).
- **One-Click Session Management**: Start Relay (`hrnx share`), join session with URL/room, copy invite link, promote in-memory drafts, or disconnect.
- **DAG & Node Threaded Reviews**: Interactive review comment bubbles pinned to graph coordinates and node drawers, synced in real time across peers.

### 2.9 Git Atomic Multi-Target Synchronization (`hrnx.atomicCommit`)
- **Status Bar Target Guard**: Alerts when staged canonical nodes are out of sync with target files (`$(shield) HRNX: Targets Out of Sync`).
- **Atomic Multi-Target Commit**: 1-click execution compiling targets, staging everything atomically, and committing in one operation.
- **Pre-Commit Hook Installation**: `HRNX: Install Git Pre-Commit Hooks` installs bash/Windows hooks directly.

---

## 3. Communication Protocol (Unified LSP over stdio)

`hrnx-vscode` integrates directly with the Python `hrnx-core` daemon via standard Language Server Protocol (LSP) plus custom JSON-RPC methods:

| Endpoint | Direction | Description |
|---|---|---|
| `hrnx/getGraph` | Client ➔ Server | Returns serialized DAG nodes, typed edges, and workspace health diagnostics |
| `hrnx/getBlastRadius` | Client ➔ Server | Computes downstream blast radius for a given `nodeId` and returns the induced visual subgraph |
| `hrnx/previewTranspile` | Client ➔ Server | Live compilation preview of a node or active editor text into target agent format with disk diff |
| `hrnx/inspectDrift` | Client ➔ Server | Compares disk target files with canonical compilation, returning drift statuses and diffs |
| `hrnx/reconcile` | Client ➔ Server | Overwrites drifted or missing target files with compiled canonical output |
| `hrnx/getEvaluationSpecs` | Client ➔ Server | Returns all parsed evaluation suite specifications with metadata |
| `hrnx/getConformanceMatrix`| Client ➔ Server | Computes cross-agent pass/fail matrix, agreement index, and divergences |
| `hrnx/runEvaluations` | Client ➔ Server | Runs test evaluation suites in isolated sandbox asserting invariant compliance |
| `hrnx/getComments` | Client ➔ Server | Retrieves persisted review comment threads for workspace or specific node |
| `hrnx/addComment` | Client ➔ Server | Creates a new review comment thread pinned to a node or DAG position |
| `hrnx/addReply` | Client ➔ Server | Appends a reply to an existing comment thread |
| `hrnx/resolveComment` | Client ➔ Server | Marks a review thread resolved |
| `hrnx/getMergeConflict` | Client ➔ Server | Computes 3-way AST merge and returns field-level conflicts |
| `hrnx/resolveMergeConflict` | Client ➔ Server | Applies resolved conflict dictionary and saves merged file to disk |
| `hrnx/checkStagedSyncStatus` | Client ➔ Server | Validates that git staging index has canonical nodes and targets in sync |
| `hrnx/atomicCommit` | Client ➔ Server | Compiles targets, stages both canonical and compiled files, and commits |
| `hrnx/installGitHooks` | Client ➔ Server | Installs git pre-commit hook and semantic merge driver |
| `hrnx/relayStatus` | Client ➔ Server | Returns current status of local `hrnx-relay` server process |
| `hrnx/startRelay` | Client ➔ Server | Spawns `hrnx share` background process on specified port/room |
| `hrnx/stopRelay` | Client ➔ Server | Terminates background relay process |

---

## 4. Building & Running

### Prerequisites
- Node.js 18+ and npm 10+
- Python 3.10+ with `hrnx-core` installed (or located in `hrnx-core/.venv`)

### Build Commands
```bash
cd hrnx-vscode

# Install dependencies
npm install

# Build both extension host (esbuild) and webview bundle (vite)
npm run build

# Run verification suite
node scripts/verify-extension.js
```

### Debugging in VS Code

A pre-configured [`.vscode/launch.json`](file:///c:/Research/HRNX/hrnx-vscode/.vscode/launch.json) and [`.vscode/tasks.json`](file:///c:/Research/HRNX/hrnx-vscode/.vscode/tasks.json) are provided for a turnkey developer experience.

#### Step 1: Pre-Flight Verification
Ensure that the Python backend environment (`hrnx-core`) is ready. The extension host automatically looks for Python at:
- `hrnx-core/.venv/Scripts/python.exe` (Windows) or `hrnx-core/.venv/bin/python` (macOS/Linux)
- Your active VS Code Python interpreter or system `python` / `python3`.

*(Optional)* You can explicitly set the Python path in your VS Code user or workspace settings (`settings.json`):
```json
{
  "hrnx.pythonPath": "C:/Research/HRNX/hrnx-core/.venv/Scripts/python.exe",
  "hrnx.defaultTargetAgent": "claude",
  "hrnx.autoOpenPreview": true
}
```

#### Step 2: Launch the Extension Development Host
1. Open either the `hrnx-vscode/` directory or the root `HRNX/` workspace in VS Code.
2. Open the **Run and Debug** view (`Ctrl+Shift+D` on Windows/Linux or `Cmd+Shift+D` on macOS).
3. Select **"Run Extension (with hrnx-core workspace)"** from the configuration dropdown.
4. Press **`F5`** (or click the green Play icon).
   - VS Code will execute the `npm: build` pre-launch task automatically, bundling both `extension.js` and the React webview bundle.
   - A new **[Extension Development Host]** window will open with the sample `.hrnx/` knowledge graph pre-loaded.

#### Step 3: Interactive Features to Test
In the Extension Development Host window:
1. **Activity Bar**: Click the **HRNX Harness** icon on the primary activity bar to open the **Harness Explorer** and **Agent Drift & Governance** sidebars.
2. **Dual-Pane Split Editor**: Open any canonical node file (e.g., `.hrnx/nodes/directives/dir.db.zero-downtime.md`). The **Live Transpiler Preview** will open side-by-side (`ViewColumn.Beside`). Switch between targets (Claude Code, Google Antigravity, OpenAI Codex, Cursor, etc.) and observe real-time diffing against disk.
3. **Interactive Blast Radius Canvas**: Click the **Open Blast Radius Canvas** icon in the editor toolbar or run command `HRNX: Open Blast Radius Canvas`. Interact with the React Flow DAG, toggle between Horizontal and Vertical layouts, inspect nodes in the slide-in drawer, and click **"Re-run Impacted Tests"**.
4. **Drift Governance**: Modify any generated file on disk (or delete one), click refresh in the **Agent Drift** view, and use the **"Reconcile Target"** inline action.

#### Step 4: Inspecting Logs & Breakpoint Debugging
- **Language Server Logs**: Open `View` ➔ `Output` (`Ctrl+K Ctrl+H`) and select **`HRNX Language Server`** from the channel dropdown. All JSON-RPC client-server communication, indexings, and errors appear here in real time.
- **Webview Elements & React Console**: To debug the React Flow canvas or Live Preview webviews, press `Ctrl+Shift+P` ➔ select **`Developer: Open Webview Developer Tools`**.
- **Extension Host Console**: Open `Help` ➔ `Toggle Developer Tools` ➔ `Console` tab to see extension activation and command execution logs.
- **Breakpoints**: Set breakpoints in any TypeScript file inside `src/**/*.ts`. Breakpoints will hit whenever commands or language client events trigger.

#### Step 5: Hot Reloading During Development
For a continuous live-reload workflow:
```bash
# Terminal 1: Watch extension and webview changes
npm run watch
```
When you make changes to extension files, press **`Ctrl+R`** (or **`Cmd+R`**) in the Extension Development Host window to reload the window immediately without terminating your debug session.

#### Common Troubleshooting
| Symptom | Root Cause | Resolution |
|---|---|---|
| Sidebar shows *"LSP Connecting or Loading..."* | Language server daemon could not locate Python | Check Output channel `HRNX Language Server`. Configure `"hrnx.pythonPath"` in settings to point to your `hrnx-core/.venv`. |
| Webview shows *"Webview bundle not built yet"* | Vite webview bundle missing from `dist/webview/assets` | Run `npm run build:webview` in `hrnx-vscode`. |
| Breakpoints show unverified / grey circle | Source maps not loaded | Ensure `npm run build` ran and verify `outFiles` in `.vscode/launch.json` points to `${workspaceFolder}/dist/**/*.js`. |

