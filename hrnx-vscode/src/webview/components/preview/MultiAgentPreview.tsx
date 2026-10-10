import React, { useState } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  FileCode,
  GitCompare,
  AlertTriangle,
  ExternalLink,
  Shield,
  Layers,
  Info,
  CheckCircle,
  SplitSquareVertical,
} from 'lucide-react';
import { TranspilePreviewData } from '../../../types';
import { Badge } from '../common/Badge';

interface MultiAgentPreviewProps {
  previewData: TranspilePreviewData | null;
  activeTarget: string;
  onSelectTarget: (target: string) => void;
  onSyncToDisk: (target: string) => void;
  onOpenFile: (filename: string) => void;
  onOpenNativeDiff?: (filename: string, content: string) => void;
}

export const TARGETS = [
  { id: 'claude', name: 'Anthropic Claude Code', file: 'CLAUDE.md', icon: '🤖', description: 'XML-tagged rules & hooks' },
  { id: 'antigravity', name: 'Google Antigravity', file: '.agent/rules.md', icon: '⚡', description: 'Skills & MCP specs' },
  { id: 'codex', name: 'OpenAI Codex & Assistants', file: '.openai/instructions.md', icon: '🧠', description: 'System prompts & tool calls' },
  { id: 'cursor', name: 'Cursor', file: '.cursorrules', icon: '🎯', description: 'Glob-scoped MDC & rules' },
  { id: 'copilot', name: 'GitHub Copilot', file: '.github/copilot-instructions.md', icon: '🐙', description: 'High-density checklists' },
  { id: 'openhands', name: 'OpenHands / OpenCode', file: '.openhands/instructions.md', icon: '🛠️', description: 'Triggered microagents' },
  { id: 'aider', name: 'Aider', file: 'CONVENTIONS.md', icon: '📝', description: 'Git & convention rules' },
  { id: 'cline', name: 'Cline & Roo Code', file: '.clinerules', icon: '🚀', description: 'Custom Roo Modes & permissions' },
  { id: 'windsurf', name: 'Windsurf (Codeium)', file: '.windsurfrules', icon: '🏄', description: 'Cascade domain rule-blocks' },
  { id: 'goose', name: 'Goose (Block)', file: '.goosehints', icon: '🪿', description: 'Actionable hints & tool configs' },
];

export const MultiAgentPreview: React.FC<MultiAgentPreviewProps> = ({
  previewData,
  activeTarget,
  onSelectTarget,
  onSyncToDisk,
  onOpenFile,
  onOpenNativeDiff,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'diff'>('preview');
  const [copied, setCopied] = useState(false);

  const currentTargetMeta = TARGETS.find((t) => t.id === activeTarget) || TARGETS[0];

  const handleCopy = () => {
    if (previewData?.content) {
      navigator.clipboard.writeText(previewData.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const diagnostics = previewData?.diagnostics || [];
  const hasLossy = diagnostics.some((d) => d.lossy);
  const warningDiags = diagnostics.filter((d) => d.severity === 'warning');
  const infoDiags = diagnostics.filter((d) => d.severity === 'info');

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)] font-sans select-text">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-sm tracking-wide">Live Transpiled Preview</span>
          <Badge variant="purple">{currentTargetMeta.file}</Badge>
          {hasLossy ? (
            <Badge variant="warning">⚠️ Lossy Fallback</Badge>
          ) : (
            <Badge variant="success">✓ Full Fidelity</Badge>
          )}
        </div>

        {/* Target Agent Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400 font-medium">Target Agent ({TARGETS.length}):</label>
          <select
            value={activeTarget}
            onChange={(e) => onSelectTarget(e.target.value)}
            className="bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] text-xs rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
          >
            {TARGETS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name} ({t.file})
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onOpenNativeDiff && previewData?.filename && (
            <button
              onClick={() => onOpenNativeDiff(previewData.filename, previewData.content)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-sky-300 text-xs font-medium rounded border border-zinc-700 transition"
              title="Open side-by-side native VS Code diff editor comparing disk with live preview"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Native Diff</span>
            </button>
          )}

          <button
            onClick={() => onSyncToDisk(activeTarget)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition shadow-sm active:scale-95"
            title="Compile and sync canonical harness to target file on disk"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync to Disk</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded border border-zinc-700 transition"
            title="Copy transpiled preview to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {previewData?.filename && (
            <button
              onClick={() => onOpenFile(previewData.filename)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded border border-zinc-700 transition"
              title="Open target file on disk"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compatibility & Degradation Diagnostics Banner */}
      {diagnostics.length > 0 && (
        <div className="px-4 py-2 bg-[var(--vscode-sideBar-background)]/60 border-b border-[var(--vscode-panel-border)] text-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Compatibility & Degradation Engine ({currentTargetMeta.name})
            </span>
            <span className="text-zinc-500 font-normal">
              {hasLossy ? 'Lossy Fallback Active' : 'Lossless Translation'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {diagnostics.map((d, i) => {
              const isWarn = d.severity === 'warning';
              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] ${
                    isWarn
                      ? 'bg-amber-950/40 border border-amber-800/60 text-amber-300'
                      : 'bg-zinc-850/60 border border-zinc-800 text-zinc-300'
                  }`}
                >
                  {isWarn ? (
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  ) : (
                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                  )}
                  <span>{d.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drift / Sync Notification Banner */}
      {previewData?.hasDiff && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-950/60 border-b border-amber-800/80 text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Drift Detected:</strong> Local file on disk differs from canonical preview. Click{' '}
              <button
                onClick={() => onSyncToDisk(activeTarget)}
                className="underline font-semibold hover:text-white"
              >
                Sync to Disk
              </button>{' '}
              to reconcile.
            </span>
          </div>
          <div className="flex items-center gap-3">
            {onOpenNativeDiff && previewData?.filename && (
              <button
                onClick={() => onOpenNativeDiff(previewData.filename, previewData.content)}
                className="text-[11px] underline text-sky-300 hover:text-white"
              >
                Open Native Diff
              </button>
            )}
            <button
              onClick={() => setActiveTab('diff')}
              className="text-[11px] underline text-amber-300 hover:text-white"
            >
              View Embedded Diff
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between px-4 pt-2 border-b border-[var(--vscode-panel-border)] bg-[var(--vscode-sideBar-background)] text-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 pb-2 border-b-2 font-medium transition ${
              activeTab === 'preview'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Compiled Preview</span>
          </button>

          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1.5 pb-2 border-b-2 font-medium transition ${
              activeTab === 'diff'
                ? 'border-indigo-500 text-white font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>Embedded Diff vs Disk</span>
            {previewData?.hasDiff && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
            )}
          </button>
        </div>

        <div className="text-[11px] text-zinc-500 pb-2 font-mono">
          {previewData?.content ? `${previewData.content.split('\n').length} lines` : ''}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-[var(--vscode-editor-background)]">
        {activeTab === 'preview' ? (
          previewData?.content ? (
            <pre className="whitespace-pre-wrap break-words text-zinc-200">
              <code>{previewData.content}</code>
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <FileCode className="w-8 h-8 text-zinc-600" />
              <span>Select or edit a `.hrnx` node to preview real-time multi-agent transpilation.</span>
            </div>
          )
        ) : previewData?.hasDiff && previewData.diff ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-zinc-400 pb-2 text-[11px] font-sans">
              <span>
                Comparing disk file (<code>{previewData.filename}</code>) against canonical transpilation:
              </span>
              {onOpenNativeDiff && (
                <button
                  onClick={() => onOpenNativeDiff(previewData.filename, previewData.content)}
                  className="text-sky-400 hover:underline flex items-center gap-1"
                >
                  <SplitSquareVertical className="w-3.5 h-3.5" />
                  Open in VS Code Side-by-Side Diff
                </button>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-words">
              {previewData.diff.split('\n').map((line, idx) => {
                let color = 'text-zinc-400';
                if (line.startsWith('+')) color = 'text-emerald-400 bg-emerald-950/30';
                else if (line.startsWith('-')) color = 'text-red-400 bg-red-950/30';
                else if (line.startsWith('@')) color = 'text-sky-400';
                return (
                  <div key={idx} className={`${color} px-1 rounded-sm`}>
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-emerald-400/80 gap-2">
            <Check className="w-8 h-8 text-emerald-500" />
            <span className="font-sans text-xs">File on disk is strictly in sync with canonical harness. Zero drift.</span>
          </div>
        )}
      </div>
    </div>
  );
};
