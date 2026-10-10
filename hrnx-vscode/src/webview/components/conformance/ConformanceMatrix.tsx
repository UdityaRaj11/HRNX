import React, { useState } from 'react';
import {
  ConformanceMatrixData,
  EvalRunResponse,
  EvalResultData,
  EvalAssertionResult,
} from '../../../types';
import {
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCode,
  Shield,
  Activity,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';

interface ConformanceMatrixProps {
  matrixData: ConformanceMatrixData | null;
  evalResults: EvalRunResponse | null;
  isRunning: boolean;
  onRunAll: () => void;
  onRunTarget: (target: string) => void;
  onOpenEval: (evalId: string) => void;
}

export const ConformanceMatrix: React.FC<ConformanceMatrixProps> = ({
  matrixData,
  evalResults,
  isRunning,
  onRunAll,
  onRunTarget,
  onOpenEval,
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    evalId: string;
    target: string;
    details: any;
  } | null>(null);

  const targets = matrixData?.targets || ['claude', 'antigravity', 'codex', 'cursor'];
  const evalIds = matrixData?.eval_ids || [];
  const matrix = matrixData?.matrix || {};
  const agreementIndex = matrixData?.overall_agreement_index ?? 100;
  const divergences = matrixData?.divergences || [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
      {/* Top Header Bar */}
      <div className="border-b border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--vscode-editor-foreground)]">
                Cross-Agent Conformance Benchmark Matrix
              </h1>
              <p className="text-xs text-[var(--vscode-descriptionForeground)]">
                Stream 4: Headless sandbox evaluations asserting behavioral compliance across multi-agent targets.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onRunAll}
              disabled={isRunning}
              className={`flex items-center space-x-2 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all ${
                isRunning
                  ? 'cursor-not-allowed bg-indigo-500/50'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  <span>Evaluating Agents...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Run All Evaluations</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Summary Statistics */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
              Cross-Agent Agreement
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className={`text-2xl font-extrabold ${agreementIndex >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {agreementIndex}%
              </span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">consistency</span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
              Evaluated Invariants
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-[var(--vscode-editor-foreground)]">
                {evalIds.length}
              </span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">test suites</span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
              Active Targets
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-indigo-400">
                {targets.length}
              </span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">agents</span>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-editor-background)] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
              Behavioral Divergences
            </div>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className={`text-2xl font-extrabold ${divergences.length === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {divergences.length}
              </span>
              <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">conflicts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Divergence Warning Banner */}
        {divergences.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-300">
                  Detected Cross-Agent Behavioral Divergence
                </h3>
                <p className="mt-1 text-xs text-amber-200/80">
                  Different agents produced contradictory outputs for the same canonical harness invariant:
                </p>
                <div className="mt-2 space-y-1">
                  {divergences.map((div, i) => (
                    <div key={i} className="text-xs bg-amber-950/40 border border-amber-500/20 rounded p-2 text-amber-200">
                      <span className="font-mono font-bold text-amber-300">{div.eval_id}</span>: {div.description}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Performance Cards */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] mb-3">
            Agent Target Conformance Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {targets.map((target) => {
              const score = matrixData?.agent_scores?.[target];
              const passRate = score?.pass_rate ?? 100;
              const passed = score?.passed ?? 0;
              const total = score?.total ?? 0;
              const dur = score?.avg_duration_ms ?? 0;

              return (
                <div
                  key={target}
                  className="rounded-lg border border-[var(--vscode-widget-border)] bg-[var(--vscode-sideBar-background)] p-3.5 transition-all hover:border-indigo-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold capitalize text-[var(--vscode-editor-foreground)]">
                      {target}
                    </span>
                    <button
                      onClick={() => onRunTarget(target)}
                      disabled={isRunning}
                      className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground)] hover:text-white"
                      title={`Run tests for ${target}`}
                    >
                      <Play className="h-3 w-3 fill-current" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className={`text-xl font-extrabold ${passRate === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {passRate}%
                    </span>
                    <span className="text-xs text-[var(--vscode-descriptionForeground)]">
                      {passed} / {total} Passed
                    </span>
                  </div>

                  <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full ${passRate === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${passRate}%` }}
                    />
                  </div>

                  <div className="mt-2 text-[10px] text-[var(--vscode-descriptionForeground)] flex items-center justify-between">
                    <span>Avg Latency:</span>
                    <span className="font-mono">{dur.toFixed(1)}ms</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Conformance Matrix Table */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] mb-3">
            Suite-by-Agent Conformance Grid
          </h2>

          <div className="rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--vscode-sideBar-background)] text-xs font-semibold border-b border-[var(--vscode-widget-border)]">
                <tr>
                  <th className="p-3 w-1/3">Evaluation Suite / Invariant</th>
                  {targets.map((t) => (
                    <th key={t} className="p-3 text-center capitalize">
                      {t}
                    </th>
                  ))}
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vscode-widget-border)] text-xs">
                {evalIds.length === 0 ? (
                  <tr>
                    <td colSpan={targets.length + 2} className="p-8 text-center text-[var(--vscode-descriptionForeground)]">
                      No evaluation suites found in workspace. Run HRNX evaluations or add .hrnx/evals/*.md nodes.
                    </td>
                  </tr>
                ) : (
                  evalIds.map((eid) => {
                    const rowData = matrix[eid] || {};
                    return (
                      <tr
                        key={eid}
                        className="hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <FileCode className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                            <div>
                              <div className="font-medium text-[var(--vscode-editor-foreground)]">
                                {rowData[targets[0]]?.title || eid}
                              </div>
                              <div className="text-[10px] font-mono text-[var(--vscode-descriptionForeground)]">
                                {eid}
                              </div>
                            </div>
                          </div>
                        </td>

                        {targets.map((t) => {
                          const res = rowData[t];
                          if (!res) {
                            return (
                              <td key={t} className="p-3 text-center text-slate-500">
                                -
                              </td>
                            );
                          }

                          const passed = res.passed;
                          return (
                            <td key={t} className="p-3 text-center">
                              <button
                                onClick={() => setSelectedCell({ evalId: eid, target: t, details: res })}
                                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                                  passed
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                }`}
                              >
                                {passed ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-rose-400" />
                                )}
                                <span>{passed ? 'PASS' : 'FAIL'}</span>
                              </button>
                            </td>
                          );
                        })}

                        <td className="p-3 text-right">
                          <button
                            onClick={() => onOpenEval(eid)}
                            className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300"
                            title="Open evaluation spec file"
                          >
                            <span>Open</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-in Detail Drawer for Inspected Test Execution */}
      {selectedCell && (
        <div className="fixed inset-y-0 right-0 w-96 max-w-full bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-widget-border)] shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between p-4 border-b border-[var(--vscode-widget-border)]">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-sm text-[var(--vscode-editor-foreground)]">
                Execution Inspector
              </h3>
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="rounded p-1 text-[var(--vscode-descriptionForeground)] hover:bg-[var(--vscode-toolbar-hoverBackground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--vscode-descriptionForeground)]">
                Evaluation Suite
              </div>
              <div className="mt-1 font-mono font-semibold text-indigo-400">
                {selectedCell.evalId}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--vscode-descriptionForeground)]">
                Target Agent
              </div>
              <div className="mt-1 font-semibold capitalize text-[var(--vscode-editor-foreground)]">
                {selectedCell.target}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--vscode-descriptionForeground)]">
                Status & Timing
              </div>
              <div className="mt-1 flex items-center space-x-2">
                <span
                  className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedCell.details.passed
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {selectedCell.details.passed ? '✓ PASSED' : '✗ FAILED'}
                </span>
                <span className="text-[var(--vscode-descriptionForeground)] font-mono">
                  {selectedCell.details.duration_ms?.toFixed(1)}ms
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  {selectedCell.details.backend || 'local'}
                </span>
              </div>
            </div>

            {selectedCell.details.assertions && selectedCell.details.assertions.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--vscode-descriptionForeground)] mb-2">
                  Assertion Breakdown ({selectedCell.details.assertions.length})
                </div>
                <div className="space-y-1.5">
                  {selectedCell.details.assertions.map((a: EvalAssertionResult, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2 rounded border text-[11px] ${
                        a.passed
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                          : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
                      }`}
                    >
                      <div className="font-semibold flex items-center space-x-1">
                        <span>{a.passed ? '✓' : '✗'}</span>
                        <span className="font-mono">[{a.check}]</span>
                      </div>
                      <div className="mt-1 text-[10px] text-[var(--vscode-descriptionForeground)]">
                        {a.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCell.details.transcript?.stdout && (
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--vscode-descriptionForeground)] mb-1">
                  Agent Execution Output
                </div>
                <pre className="p-2.5 rounded bg-black/40 border border-[var(--vscode-widget-border)] font-mono text-[10px] overflow-x-auto whitespace-pre-wrap text-slate-300">
                  {selectedCell.details.transcript.stdout}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
