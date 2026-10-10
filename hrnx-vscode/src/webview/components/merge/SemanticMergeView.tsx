import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  Check,
  AlertTriangle,
  ArrowRight,
  Save,
  Layers,
  FileText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { MergeConflictData } from '../../../types';

interface SemanticMergeViewProps {
  conflictData: MergeConflictData | null;
  onResolve: (filePath: string, resolvedFrontmatter: Record<string, any>, resolvedBody: string) => void;
  onRefresh?: () => void;
}

export const SemanticMergeView: React.FC<SemanticMergeViewProps> = ({
  conflictData,
  onResolve,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'frontmatter' | 'body' | 'preview'>('frontmatter');
  const [resolutions, setResolutions] = useState<Record<string, 'ours' | 'theirs' | 'base'>>({});
  const [resolvedBody, setResolvedBody] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (conflictData) {
      // Default resolutions: choose 'ours' for conflicting fields
      const initial: Record<string, 'ours' | 'theirs' | 'base'> = {};
      for (const conf of conflictData.fieldConflicts) {
        initial[conf.field] = 'ours';
      }
      setResolutions(initial);
      setResolvedBody(conflictData.mergedBody || conflictData.ours.body || '');
      setIsSaved(false);
    }
  }, [conflictData]);

  if (!conflictData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[var(--vscode-editor-background)] text-[var(--vscode-descriptionForeground)]">
        <GitMerge className="w-12 h-12 mb-4 text-indigo-400 opacity-60" />
        <h2 className="text-xl font-semibold mb-2 text-[var(--vscode-editor-foreground)]">
          No Active Semantic Merge Conflict
        </h2>
        <p className="max-w-md text-sm">
          Select a conflicted canonical node or run a Git merge operation to review and resolve 3-way AST differences.
        </p>
      </div>
    );
  }

  // Compute resolved frontmatter based on resolutions and autoMerged
  const computeCurrentResolvedFrontmatter = (): Record<string, any> => {
    const fm = { ...conflictData.mergedFrontmatter };
    for (const conf of conflictData.fieldConflicts) {
      const choice = resolutions[conf.field] || 'ours';
      if (choice === 'theirs') {
        fm[conf.field] = conf.theirs_value;
      } else if (choice === 'base') {
        fm[conf.field] = conf.base_value;
      } else {
        fm[conf.field] = conf.ours_value;
      }
    }
    return fm;
  };

  const handleSelectChoice = (field: string, choice: 'ours' | 'theirs' | 'base') => {
    setResolutions((prev) => ({ ...prev, [field]: choice }));
    setIsSaved(false);
  };

  const handleAcceptAll = (choice: 'ours' | 'theirs') => {
    const next: Record<string, 'ours' | 'theirs' | 'base'> = {};
    for (const conf of conflictData.fieldConflicts) {
      next[conf.field] = choice;
    }
    setResolutions(next);
    if (choice === 'ours') {
      setResolvedBody(conflictData.ours.body || '');
    } else {
      setResolvedBody(conflictData.theirs.body || '');
    }
    setIsSaved(false);
  };

  const handleSmartCombine = () => {
    const next: Record<string, 'ours' | 'theirs' | 'base'> = {};
    for (const conf of conflictData.fieldConflicts) {
      // Pick ours for scalars
      next[conf.field] = 'ours';
    }
    setResolutions(next);
    setResolvedBody(conflictData.mergedBody || conflictData.ours.body || '');
    setIsSaved(false);
  };

  const handleSaveAndResolve = () => {
    const fm = computeCurrentResolvedFrontmatter();
    onResolve(conflictData.filePath || '', fm, resolvedBody);
    setIsSaved(true);
  };

  const currentResolvedFm = computeCurrentResolvedFrontmatter();

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--vscode-widget-border,#333)] bg-[var(--vscode-sideBar-background,#1e1e1e)]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
            <GitMerge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold">HRNX Semantic 3-Way Merge Resolver</h1>
              {conflictData.isClean ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Clean Merge
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {conflictData.fieldConflicts.length} Conflict(s)
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--vscode-descriptionForeground)] font-mono">
              {conflictData.nodeId ? `Node: ${conflictData.nodeId} • ` : ''}
              {conflictData.filePath || 'Active Buffer'}
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleAcceptAll('ours')}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-widget-border,#444)] transition-colors"
          >
            Accept All Ours
          </button>
          <button
            onClick={() => handleAcceptAll('theirs')}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-widget-border,#444)] transition-colors"
          >
            Accept All Theirs
          </button>
          <button
            onClick={handleSmartCombine}
            className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Smart Combine
          </button>
          <button
            onClick={handleSaveAndResolve}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[var(--vscode-button-background,#2563eb)] hover:bg-[var(--vscode-button-hoverBackground,#1d4ed8)] text-[var(--vscode-button-foreground,#fff)] flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaved ? 'Resolved & Saved' : 'Save & Resolve'}
          </button>
        </div>
      </div>

      {/* Auto-Merged Notification Bar */}
      {conflictData.autoMergedFields.length > 0 && (
        <div className="flex items-center px-5 py-2 text-xs bg-emerald-500/10 text-emerald-300 border-b border-emerald-500/20">
          <Check className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
          <span>
            <strong>Auto-Merged Cleanly:</strong> The following fields had non-colliding changes or list set unions and were merged automatically:{' '}
            <code className="px-1.5 py-0.5 rounded bg-emerald-950/60 font-mono text-emerald-200">
              {conflictData.autoMergedFields.join(', ')}
            </code>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-5 border-b border-[var(--vscode-widget-border,#333)] bg-[var(--vscode-sideBar-background,#1e1e1e)] space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('frontmatter')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'frontmatter'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-editor-foreground)]'
          }`}
        >
          <Layers className="w-4 h-4" /> Frontmatter AST Diff ({conflictData.fieldConflicts.length} conflicts)
        </button>
        <button
          onClick={() => setActiveTab('body')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'body'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-editor-foreground)]'
          }`}
        >
          <FileText className="w-4 h-4" /> Markdown Body {conflictData.hasBodyConflict ? '⚠️' : '✓'}
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'preview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-editor-foreground)]'
          }`}
        >
          <ArrowRight className="w-4 h-4" /> Final Resolved Preview
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'frontmatter' && (
          <div className="space-y-6">
            {/* Frontmatter 3-way table */}
            <div className="grid grid-cols-3 gap-4 mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] px-2">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span> Ancestor (Base)
              </div>
              <div className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Ours (Local Working Copy)
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Theirs (Incoming Remote)
              </div>
            </div>

            {/* Conflicted Fields */}
            {conflictData.fieldConflicts.map((conf) => {
              const currentChoice = resolutions[conf.field] || 'ours';
              return (
                <div
                  key={conf.field}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-1 rounded bg-amber-500/20 text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                      </span>
                      <span className="font-mono text-sm font-bold text-amber-300">
                        Property: {conf.field}
                      </span>
                    </div>

                    {/* Resolution Selector */}
                    <div className="flex items-center space-x-1.5 text-xs bg-[var(--vscode-editor-background)] p-1 rounded-lg border border-[var(--vscode-widget-border,#444)]">
                      <span className="text-[var(--vscode-descriptionForeground)] px-1.5">Resolve with:</span>
                      <button
                        onClick={() => handleSelectChoice(conf.field, 'ours')}
                        className={`px-2.5 py-1 rounded font-medium transition-all ${
                          currentChoice === 'ours'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-[var(--vscode-editor-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                        }`}
                      >
                        Keep Ours
                      </button>
                      <button
                        onClick={() => handleSelectChoice(conf.field, 'theirs')}
                        className={`px-2.5 py-1 rounded font-medium transition-all ${
                          currentChoice === 'theirs'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-[var(--vscode-editor-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                        }`}
                      >
                        Accept Theirs
                      </button>
                      <button
                        onClick={() => handleSelectChoice(conf.field, 'base')}
                        className={`px-2.5 py-1 rounded font-medium transition-all ${
                          currentChoice === 'base'
                            ? 'bg-slate-600 text-white shadow-sm'
                            : 'text-[var(--vscode-editor-foreground)] hover:bg-[var(--vscode-list-hoverBackground)]'
                        }`}
                      >
                        Base
                      </button>
                    </div>
                  </div>

                  {/* 3-Way Values Display */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-[var(--vscode-editor-background)] border border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Base</div>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-300">
                        {JSON.stringify(conf.base_value, null, 2) ?? 'null'}
                      </pre>
                    </div>

                    <div
                      className={`p-3 rounded-lg bg-[var(--vscode-editor-background)] border transition-all ${
                        currentChoice === 'ours'
                          ? 'border-indigo-500 shadow-sm ring-1 ring-indigo-500/50'
                          : 'border-slate-700/50 opacity-70'
                      }`}
                    >
                      <div className="text-[10px] text-indigo-400 uppercase font-bold mb-1 flex items-center justify-between">
                        <span>Ours</span>
                        {currentChoice === 'ours' && <span className="text-indigo-300">✓ Selected</span>}
                      </div>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-indigo-200">
                        {JSON.stringify(conf.ours_value, null, 2) ?? 'null'}
                      </pre>
                    </div>

                    <div
                      className={`p-3 rounded-lg bg-[var(--vscode-editor-background)] border transition-all ${
                        currentChoice === 'theirs'
                          ? 'border-emerald-500 shadow-sm ring-1 ring-emerald-500/50'
                          : 'border-slate-700/50 opacity-70'
                      }`}
                    >
                      <div className="text-[10px] text-emerald-400 uppercase font-bold mb-1 flex items-center justify-between">
                        <span>Theirs</span>
                        {currentChoice === 'theirs' && <span className="text-emerald-300">✓ Selected</span>}
                      </div>
                      <pre className="text-xs font-mono whitespace-pre-wrap break-all text-emerald-200">
                        {JSON.stringify(conf.theirs_value, null, 2) ?? 'null'}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Non-conflicted / Auto-Merged Properties */}
            <div className="rounded-xl border border-[var(--vscode-widget-border,#333)] p-4 space-y-3 bg-[var(--vscode-sideBar-background,#1e1e1e)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)]">
                All Frontmatter Properties
              </h3>
              <div className="space-y-2">
                {Object.entries(currentResolvedFm).map(([key, val]) => {
                  const isConflicted = conflictData.fieldConflicts.some((c) => c.field === key);
                  const isAutoMerged = conflictData.autoMergedFields.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-start justify-between text-xs py-2 px-3 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,#2a2a2a)] font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-300">{key}:</span>
                        {isAutoMerged && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                            Auto-Merged
                          </span>
                        )}
                        {isConflicted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
                            Resolved ({resolutions[key] || 'ours'})
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 break-all text-right max-w-lg">
                        {JSON.stringify(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'body' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-indigo-400 flex items-center justify-between">
                  <span>Ours (Local Markdown Body)</span>
                  <button
                    onClick={() => setResolvedBody(conflictData.ours.body || '')}
                    className="text-[10px] underline hover:text-white"
                  >
                    Copy to Resolved
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,#333)] font-mono text-xs whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {conflictData.ours.body || '(empty)'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                  <span>Theirs (Remote Markdown Body)</span>
                  <button
                    onClick={() => setResolvedBody(conflictData.theirs.body || '')}
                    className="text-[10px] underline hover:text-white"
                  >
                    Copy to Resolved
                  </button>
                </div>
                <div className="p-3 rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,#333)] font-mono text-xs whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {conflictData.theirs.body || '(empty)'}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--vscode-editor-foreground)] flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Resolved Markdown Body (Editable)
                </label>
                {conflictData.hasBodyConflict && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Please review and remove conflict markers if present
                  </span>
                )}
              </div>
              <textarea
                value={resolvedBody}
                onChange={(e) => {
                  setResolvedBody(e.target.value);
                  setIsSaved(false);
                }}
                rows={10}
                className="w-full p-3 font-mono text-xs rounded-lg bg-[var(--vscode-editor-background)] border border-[var(--vscode-input-border,#444)] text-[var(--vscode-editor-foreground)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--vscode-descriptionForeground)]">
              <span>This is the complete canonical document that will be written upon save:</span>
              <button
                onClick={handleSaveAndResolve}
                className="px-3 py-1 rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] flex items-center gap-1"
              >
                <Save className="w-3 h-3" /> Save to Disk
              </button>
            </div>
            <div className="p-4 rounded-xl bg-[var(--vscode-editor-background)] border border-[var(--vscode-widget-border,#333)] font-mono text-xs whitespace-pre-wrap">
              <span className="text-slate-500">---</span>
              <br />
              <span className="text-indigo-300">
                {Object.entries(currentResolvedFm)
                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                  .join('\n')}
              </span>
              <br />
              <span className="text-slate-500">---</span>
              <br />
              <br />
              <span className="text-slate-200">{resolvedBody}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
