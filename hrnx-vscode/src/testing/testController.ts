import * as vscode from 'vscode';
import * as path from 'path';
import { HRNXClient } from '../client/hrnxClient';
import { EvaluationSpec, EvalRunResponse, EvalResultData } from '../types';

export class HRNXTestController {
  private controller: vscode.TestController;
  private disposables: vscode.Disposable[] = [];
  private runProfile: vscode.TestRunProfile;

  constructor(
    private context: vscode.ExtensionContext,
    private client: HRNXClient
  ) {
    this.controller = vscode.tests.createTestController(
      'hrnxTestController',
      'HRNX Harness Evaluations'
    );

    this.runProfile = this.controller.createRunProfile(
      'Run Evaluations',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runHandler(request, token),
      true
    );

    this.controller.refreshHandler = (token) => this.discoverTests(token);

    this.setupFileWatcher();
    this.disposables.push(this.controller, this.runProfile);
  }

  public async initialize(): Promise<void> {
    await this.discoverTests();
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  private setupFileWatcher(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/.hrnx/evals/**/*.md');

    watcher.onDidCreate(() => this.discoverTests(), null, this.disposables);
    watcher.onDidChange(() => this.discoverTests(), null, this.disposables);
    watcher.onDidDelete((uri) => {
      const id = path.basename(uri.fsPath, '.md');
      this.controller.items.delete(id);
    }, null, this.disposables);

    this.disposables.push(watcher);
  }

  public async discoverTests(token?: vscode.CancellationToken): Promise<void> {
    try {
      const response = await this.client.getEvaluationSpecs();
      if (token?.isCancellationRequested) return;

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      for (const spec of response.specs) {
        let uri: vscode.Uri | undefined;
        if (spec.filePath) {
          uri = vscode.Uri.file(
            path.isAbsolute(spec.filePath)
              ? spec.filePath
              : path.join(workspaceRoot || '', spec.filePath)
          );
        } else if (workspaceRoot) {
          uri = vscode.Uri.file(path.join(workspaceRoot, '.hrnx', 'evals', `${spec.id}.md`));
        }

        // Parent test item: The evaluation suite
        let suiteItem = this.controller.items.get(spec.id);
        if (!suiteItem) {
          suiteItem = this.controller.createTestItem(
            spec.id,
            `${spec.title} (${spec.id})`,
            uri
          );
          this.controller.items.add(suiteItem);
        } else {
          suiteItem.label = `${spec.title} (${spec.id})`;
        }

        suiteItem.description = `${spec.assertionsCount} assertion(s)`;

        // Child test items: Each configured target agent
        const targets = spec.targetAgents.length > 0
          ? spec.targetAgents
          : ['claude', 'antigravity', 'codex', 'cursor'];

        // Remove old children that are no longer in targetAgents
        suiteItem.children.forEach((child) => {
          const targetName = child.id.split('::')[1];
          if (!targets.includes(targetName)) {
            suiteItem?.children.delete(child.id);
          }
        });

        for (const target of targets) {
          const childId = `${spec.id}::${target}`;
          let childItem = suiteItem.children.get(childId);
          if (!childItem) {
            childItem = this.controller.createTestItem(
              childId,
              `Agent: ${target.toUpperCase()}`,
              uri
            );
            suiteItem.children.add(childItem);
          }
        }
      }
    } catch (err) {
      // If language server is still connecting, retry silently later
      console.warn('HRNX Test Controller discovery waiting for LSP:', err);
    }
  }

  private async runHandler(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    const run = this.controller.createTestRun(request);
    const config = vscode.workspace.getConfiguration('hrnx');
    const sandboxMode = config.get<string>('eval.sandboxBackend', 'local');

    // Collect all targeted items
    const queue: vscode.TestItem[] = [];
    if (request.include) {
      request.include.forEach((item) => queue.push(item));
    } else {
      this.controller.items.forEach((item) => queue.push(item));
    }

    const evalIdsToRun: Set<string> = new Set();
    const targetsToRun: Set<string> = new Set();
    const itemMap: Map<string, vscode.TestItem> = new Map();

    for (const item of queue) {
      if (item.id.includes('::')) {
        // Child item: specific target
        const [evalId, target] = item.id.split('::');
        evalIdsToRun.add(evalId);
        targetsToRun.add(target);
        itemMap.set(item.id, item);
      } else {
        // Parent suite: include all children
        evalIdsToRun.add(item.id);
        itemMap.set(item.id, item);
        item.children.forEach((child) => {
          const [, target] = child.id.split('::');
          targetsToRun.add(target);
          itemMap.set(child.id, child);
        });
      }
    }

    // Mark items as enqueued/started
    for (const item of itemMap.values()) {
      run.started(item);
    }

    try {
      const evalIdList = evalIdsToRun.size > 0 ? Array.from(evalIdsToRun) : undefined;
      const targetList = targetsToRun.size > 0 ? Array.from(targetsToRun) : undefined;

      const response: EvalRunResponse = await this.client.runEvaluations(
        evalIdList,
        targetList,
        sandboxMode
      );

      if (token.isCancellationRequested) {
        run.end();
        return;
      }

      // Record results for each individual target run
      for (const res of response.results) {
        const childId = `${res.evalId}::${res.target}`;
        const childItem = itemMap.get(childId);
        const parentItem = itemMap.get(res.evalId);

        const duration = res.durationMs || 10;

        if (res.status === 'passed') {
          if (childItem) {
            run.passed(childItem, duration);
          }
        } else {
          const msg = new vscode.TestMessage(
            `[${res.target?.toUpperCase()}] Evaluation Failed: ${res.message}`
          );
          if (childItem) {
            run.failed(childItem, msg, duration);
          }
        }

        // Output detailed execution log to VS Code Test Output stream
        run.appendOutput(`\r\n--- [${res.evalId}] Target: ${res.target} ---\r\n`);
        run.appendOutput(`Status: ${res.status.toUpperCase()} (${duration.toFixed(1)}ms)\r\n`);
        run.appendOutput(`Message: ${res.message}\r\n`);

        if (res.assertions && res.assertions.length > 0) {
          run.appendOutput(`Assertions (${res.assertions.length}):\r\n`);
          for (const a of res.assertions) {
            const sym = a.passed ? '✓' : '✗';
            run.appendOutput(`  ${sym} [${a.check}] ${a.message}\r\n`);
          }
        }

        if (res.transcript && res.transcript.stdout) {
          run.appendOutput(`Agent Transcript Excerpt:\r\n${res.transcript.stdout}\r\n`);
        }
      }

      // Update parent suite status
      for (const evalId of evalIdsToRun) {
        const parentItem = this.controller.items.get(evalId);
        if (parentItem) {
          const targetRuns = response.results.filter((r) => r.evalId === evalId);
          const allPassed = targetRuns.length > 0 && targetRuns.every((r) => r.status === 'passed');
          const totalDur = targetRuns.reduce((acc, r) => acc + (r.durationMs || 0), 0);

          if (allPassed) {
            run.passed(parentItem, totalDur);
          } else {
            const failCount = targetRuns.filter((r) => r.status === 'failed').length;
            run.failed(
              parentItem,
              new vscode.TestMessage(`${failCount} of ${targetRuns.length} agent target(s) failed`),
              totalDur
            );
          }
        }
      }
    } catch (err) {
      for (const item of itemMap.values()) {
        run.errored(item, new vscode.TestMessage(`Execution error: ${String(err)}`));
      }
    } finally {
      run.end();
    }
  }
}
