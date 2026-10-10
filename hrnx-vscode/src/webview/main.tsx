import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import { MultiAgentPreview } from './components/preview/MultiAgentPreview';
import { BlastRadiusCanvas } from './components/blast/BlastRadiusCanvas';
import { ConformanceMatrix } from './components/conformance/ConformanceMatrix';
import { SemanticMergeView } from './components/merge/SemanticMergeView';
import {
  BlastRadiusResponse,
  CommentThread,
  ConformanceMatrixData,
  DraftNode,
  EvalRunResponse,
  GraphResponse,
  MergeConflictData,
  PeerInfo,
  TranspilePreviewData,
} from '../types';

// Acquire VS Code webview API
declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : {
  postMessage: (msg: any) => console.log('postMessage:', msg),
  getState: () => ({}),
  setState: () => {},
};

export const App: React.FC = () => {
  // View mode can be 'preview' | 'blast-radius' | 'conformance' | 'semantic-merge'
  const [viewMode, setViewMode] = useState<'preview' | 'blast-radius' | 'conformance' | 'semantic-merge'>('preview');

  // Preview state
  const [previewData, setPreviewData] = useState<TranspilePreviewData | null>(null);
  const [activeTarget, setActiveTarget] = useState<string>('claude');

  // Blast radius state
  const [blastRadiusData, setBlastRadiusData] = useState<BlastRadiusResponse | null>(null);
  const [fullGraphData, setFullGraphData] = useState<GraphResponse | null>(null);
  const [evalResults, setEvalResults] = useState<EvalRunResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Conformance matrix state
  const [conformanceData, setConformanceData] = useState<ConformanceMatrixData | null>(null);

  // Stream 5: Semantic Merge & Multiplayer Collaboration State
  const [mergeConflictData, setMergeConflictData] = useState<MergeConflictData | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [drafts, setDrafts] = useState<DraftNode[]>([]);

  useEffect(() => {
    // Notify VS Code that webview is ready
    vscode.postMessage({ type: 'WEBVIEW_READY' });

    // Handle incoming messages from extension host
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'INIT_VIEW':
          if (message.view) setViewMode(message.view);
          if (message.target) setActiveTarget(message.target);
          break;

        case 'UPDATE_PREVIEW':
          setViewMode('preview');
          setPreviewData(message.data);
          if (message.activeTarget) setActiveTarget(message.activeTarget);
          break;

        case 'UPDATE_BLAST_RADIUS':
          setViewMode('blast-radius');
          setBlastRadiusData(message.data);
          if (message.fullGraph) setFullGraphData(message.fullGraph);
          break;

        case 'UPDATE_CONFORMANCE':
          setViewMode('conformance');
          setConformanceData(message.data);
          break;

        case 'UPDATE_SEMANTIC_MERGE':
          setViewMode('semantic-merge');
          setMergeConflictData(message.data);
          break;

        case 'UPDATE_COLLAB_STATE':
          if (message.peers) setPeers(message.peers);
          if (message.comments) setComments(message.comments);
          if (message.drafts) setDrafts(message.drafts);
          break;

        case 'UPDATE_COMMENTS':
          if (message.comments) setComments(message.comments);
          break;

        case 'UPDATE_FULL_GRAPH':
          setFullGraphData(message.data);
          break;

        case 'EVAL_STARTED':
          setIsEvaluating(true);
          break;

        case 'EVAL_FINISHED':
          setIsEvaluating(false);
          setEvalResults(message.results);
          if (message.matrix) {
            setConformanceData(message.matrix);
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]">
      {viewMode === 'preview' ? (
        <MultiAgentPreview
          previewData={previewData}
          activeTarget={activeTarget}
          onSelectTarget={(target) => {
            setActiveTarget(target);
            vscode.postMessage({ type: 'CHANGE_TARGET', target });
          }}
          onSyncToDisk={(target) => {
            vscode.postMessage({ type: 'SYNC_TO_DISK', target });
          }}
          onOpenFile={(filename) => {
            vscode.postMessage({ type: 'OPEN_FILE', filename });
          }}
          onOpenNativeDiff={(filename, content) => {
            vscode.postMessage({ type: 'OPEN_NATIVE_DIFF', filename, content });
          }}
        />
      ) : viewMode === 'blast-radius' ? (
        <BlastRadiusCanvas
          blastRadiusData={blastRadiusData}
          fullGraphData={fullGraphData}
          evalResults={evalResults}
          isEvaluating={isEvaluating}
          peers={peers}
          comments={comments}
          drafts={drafts}
          onFocusNode={(nodeId) => {
            vscode.postMessage({ type: 'FOCUS_NODE', nodeId });
          }}
          onRunEvals={(evalIds) => {
            setIsEvaluating(true);
            vscode.postMessage({ type: 'RUN_EVALS', evalIds });
          }}
          onOpenFile={(filePath) => {
            vscode.postMessage({ type: 'OPEN_FILE_PATH', filePath });
          }}
          onResetView={() => {
            setBlastRadiusData(null);
            vscode.postMessage({ type: 'GET_FULL_GRAPH' });
          }}
          onAddComment={(nodeId, text) => {
            vscode.postMessage({ type: 'ADD_COMMENT', nodeId, text });
          }}
          onAddReply={(threadId, text) => {
            vscode.postMessage({ type: 'ADD_REPLY', threadId, text });
          }}
          onResolveComment={(threadId, resolved) => {
            vscode.postMessage({ type: 'RESOLVE_COMMENT', threadId, resolved });
          }}
          onPromoteDraft={(nodeId) => {
            vscode.postMessage({ type: 'PROMOTE_DRAFT', nodeId });
          }}
          onDiscardDraft={(nodeId) => {
            vscode.postMessage({ type: 'DISCARD_DRAFT', nodeId });
          }}
        />
      ) : viewMode === 'conformance' ? (
        <ConformanceMatrix
          matrixData={conformanceData}
          evalResults={evalResults}
          isRunning={isEvaluating}
          onRunAll={() => {
            setIsEvaluating(true);
            vscode.postMessage({ type: 'RUN_ALL_EVALS' });
          }}
          onRunTarget={(target) => {
            setIsEvaluating(true);
            vscode.postMessage({ type: 'RUN_TARGET_EVALS', target });
          }}
          onOpenEval={(evalId) => {
            vscode.postMessage({ type: 'OPEN_EVAL_FILE', evalId });
          }}
        />
      ) : (
        <SemanticMergeView
          conflictData={mergeConflictData}
          onResolve={(filePath, resolvedFrontmatter, resolvedBody) => {
            vscode.postMessage({
              type: 'RESOLVE_MERGE',
              filePath,
              resolvedFrontmatter,
              resolvedBody,
            });
          }}
          onRefresh={() => {
            vscode.postMessage({ type: 'REFRESH_MERGE' });
          }}
        />
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
