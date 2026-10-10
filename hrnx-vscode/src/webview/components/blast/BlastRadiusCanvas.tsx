import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
  Play,
  RotateCcw,
  CheckCircle,
  AlertOctagon,
  ListChecks,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Loader2,
  Search,
  Split,
} from 'lucide-react';
import {
  BlastRadiusResponse,
  CommentThread,
  DraftNode,
  EvalRunResponse,
  GraphResponse,
  HarnessNodeData,
  PeerInfo,
} from '../../../types';
import { CustomHarnessNode } from './CustomNode';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import { Badge } from '../common/Badge';

interface BlastRadiusCanvasProps {
  blastRadiusData: BlastRadiusResponse | null;
  fullGraphData: GraphResponse | null;
  evalResults: EvalRunResponse | null;
  isEvaluating: boolean;
  peers?: PeerInfo[];
  comments?: CommentThread[];
  drafts?: DraftNode[];
  onFocusNode: (nodeId: string) => void;
  onRunEvals: (evalIds: string[]) => void;
  onOpenFile: (filePath: string) => void;
  onResetView: () => void;
  onAddComment?: (nodeId: string, text: string) => void;
  onAddReply?: (threadId: string, text: string) => void;
  onResolveComment?: (threadId: string, resolved: boolean) => void;
  onPromoteDraft?: (nodeId: string) => void;
  onDiscardDraft?: (nodeId: string) => void;
}

const nodeTypes = {
  customHarnessNode: CustomHarnessNode,
};

// Dagre automatic graph layout computation
function computeDagreLayout(
  nodes: Node<HarnessNodeData>[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 260;
  const nodeHeight = 110;

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: direction === 'LR' ? 120 : 80,
    nodesep: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - nodeWidth / 2 : 0,
        y: nodeWithPosition ? nodeWithPosition.y - nodeHeight / 2 : 0,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export const BlastRadiusCanvas: React.FC<BlastRadiusCanvasProps> = ({
  blastRadiusData,
  fullGraphData,
  evalResults,
  isEvaluating,
  peers = [],
  comments = [],
  drafts = [],
  onFocusNode,
  onRunEvals,
  onOpenFile,
  onResetView,
  onAddComment,
  onAddReply,
  onResolveComment,
  onPromoteDraft,
  onDiscardDraft,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<HarnessNodeData | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');
  const [searchQuery, setSearchQuery] = useState('');

  // Determine current active dataset: blast radius subgraph or full workspace DAG
  const rawNodes = useMemo(() => {
    if (blastRadiusData?.subgraphNodes?.length) {
      return blastRadiusData.subgraphNodes;
    }
    return fullGraphData?.nodes || [];
  }, [blastRadiusData, fullGraphData]);

  const rawEdges = useMemo(() => {
    if (blastRadiusData?.subgraphEdges?.length) {
      return blastRadiusData.subgraphEdges;
    }
    return fullGraphData?.edges || [];
  }, [blastRadiusData, fullGraphData]);

  // Construct React Flow elements whenever dataset or direction changes
  useEffect(() => {
    if (!rawNodes.length) return;

    const initialNodes: Node<HarnessNodeData>[] = rawNodes.map((n) => ({
      id: n.id,
      type: 'customHarnessNode',
      data: n,
      position: { x: 0, y: 0 },
    }));

    const initialEdges: Edge[] = rawEdges.map((e, index) => {
      let strokeColor = '#64748b';
      let strokeDasharray: string | undefined;

      if (e.type === 'implements') {
        strokeColor = '#10b981';
        strokeDasharray = '5 5';
      } else if (e.type === 'validates') {
        strokeColor = '#a855f7';
        strokeDasharray = '3 3';
      } else if (e.type === 'uses_tool') {
        strokeColor = '#06b6d4';
      }

      return {
        id: `e-${e.source}-${e.target}-${index}`,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: e.type === 'validates',
        label: e.type.replace('_', ' '),
        labelStyle: { fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.8 },
        style: { stroke: strokeColor, strokeWidth: 1.5, strokeDasharray },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 15,
          height: 15,
        },
      };
    });

    const layouted = computeDagreLayout(initialNodes, initialEdges, layoutDirection);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [rawNodes, rawEdges, layoutDirection, setNodes, setEdges]);

  // Filter nodes if user types in search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return;
    const match = rawNodes.find(
      (n) =>
        n.id.toLowerCase().includes(query.toLowerCase()) ||
        n.title.toLowerCase().includes(query.toLowerCase())
    );
    if (match) {
      setSelectedNode(match);
    }
  };

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const found = rawNodes.find((n) => n.id === node.id);
      if (found) {
        setSelectedNode(found);
      }
    },
    [rawNodes]
  );

  const report = blastRadiusData?.report;
  const isBlastMode = Boolean(blastRadiusData);

  return (
    <div className="relative flex flex-col h-screen w-full bg-[#121316] text-zinc-100 font-sans select-none overflow-hidden">
      {/* Top Interactive Metric & Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-wide text-zinc-100">
              {isBlastMode ? 'Blast Radius Impact Canvas' : 'Canonical Knowledge DAG'}
            </span>
            {isBlastMode && report && (
              <Badge variant="purple">
                Origin: {report.origin_nodes[0] || 'Unknown'}
              </Badge>
            )}
          </div>

          {/* Quick Metrics Badges */}
          {isBlastMode && report && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-zinc-400">Total Blast:</span>
              <Badge variant="default">{report.total_blast_radius} nodes</Badge>

              {report.impacted_fatal_invariants.length > 0 && (
                <Badge variant="danger">
                  <ShieldAlert className="w-3 h-3" />
                  {report.impacted_fatal_invariants.length} Fatal Risk
                </Badge>
              )}

              {report.impacted_evals.length > 0 && (
                <Badge variant="success">
                  <ListChecks className="w-3 h-3" />
                  {report.impacted_evals.length} Evals Required
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search node..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="bg-zinc-950/80 text-zinc-200 border border-zinc-800 text-xs rounded-md pl-8 pr-2.5 py-1 w-36 focus:w-48 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Peer Presence Avatar Stack */}
          {peers && peers.length > 0 && (
            <div className="flex items-center -space-x-1.5 pl-2 border-l border-zinc-800">
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow ring-1 ring-zinc-900 cursor-pointer"
                  style={{ backgroundColor: peer.color || '#6366f1' }}
                  title={`${peer.name}${peer.activeNodeId ? ` (viewing ${peer.activeNodeId})` : ''}`}
                >
                  {peer.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <span className="text-[10px] text-zinc-400 pl-2">{peers.length} active</span>
            </div>
          )}

          {/* Layout Direction Toggle */}
          <button
            onClick={() => setLayoutDirection((prev) => (prev === 'LR' ? 'TB' : 'LR'))}
            className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 transition"
            title="Toggle Layout Direction (Horizontal / Vertical)"
          >
            <Split className="w-3 h-3" />
            <span>{layoutDirection === 'LR' ? 'Horizontal' : 'Vertical'}</span>
          </button>

          {/* Re-run Impacted Tests button */}
          <button
            onClick={() => onRunEvals(report?.impacted_evals || [])}
            disabled={isEvaluating}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded shadow transition active:scale-95"
            title="Execute test suites validating the impacted invariants"
          >
            {isEvaluating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isEvaluating ? 'Running...' : 'Re-run Impacted Tests'}</span>
          </button>

          {isBlastMode && (
            <button
              onClick={onResetView}
              className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 transition"
              title="Reset to Full Workspace Graph"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Full Graph</span>
            </button>
          )}
        </div>
      </div>

      {/* Test Evaluation Feedback Banner */}
      {evalResults && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/90 border-b border-zinc-800 text-xs z-20">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-zinc-300">Evaluation Suite Run:</span>
            <Badge variant="success">Passed: {evalResults.passed}</Badge>
            {evalResults.failed > 0 && <Badge variant="danger">Failed: {evalResults.failed}</Badge>}
            <span className="text-zinc-500">Total: {evalResults.total} tests executed</span>
          </div>
          <div className="flex items-center gap-2">
            {evalResults.results.map((r) => (
              <span
                key={r.evalId}
                className={`font-mono text-[11px] ${
                  r.status === 'passed' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {r.evalId}: {r.status.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#27272a" gap={18} size={1} />
          <Controls position="bottom-left" />
          <MiniMap
            nodeColor={(n) => {
              if (n.data?.riskLevel === 'origin') return '#6366f1';
              if (n.data?.riskLevel === 'fatal_broken') return '#ef4444';
              if (n.data?.riskLevel === 'required_eval') return '#10b981';
              return '#3f3f46';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
            className="!bottom-4 !right-4 !bg-zinc-950/80 !border !border-zinc-800 !rounded-lg"
          />
        </ReactFlow>

        {/* Node Detail Slide-in Drawer */}
        <NodeDetailDrawer
          node={selectedNode}
          comments={comments}
          draft={selectedNode ? drafts.find((d) => (d.nodeId || (d as any).node_id) === selectedNode.id) : null}
          onClose={() => setSelectedNode(null)}
          onOpenFile={onOpenFile}
          onFocusBlastRadius={(id) => {
            onFocusNode(id);
          }}
          onAddComment={onAddComment}
          onAddReply={onAddReply}
          onResolveComment={onResolveComment}
          onPromoteDraft={onPromoteDraft}
          onDiscardDraft={onDiscardDraft}
        />
      </div>
    </div>
  );
};
