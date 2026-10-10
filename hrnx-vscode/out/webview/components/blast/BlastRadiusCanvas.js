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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlastRadiusCanvas = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const reactflow_1 = __importStar(require("reactflow"));
require("reactflow/dist/style.css");
const dagre_1 = __importDefault(require("dagre"));
const lucide_react_1 = require("lucide-react");
const CustomNode_1 = require("./CustomNode");
const NodeDetailDrawer_1 = require("./NodeDetailDrawer");
const Badge_1 = require("../common/Badge");
const nodeTypes = {
    customHarnessNode: CustomNode_1.CustomHarnessNode,
};
// Dagre automatic graph layout computation
function computeDagreLayout(nodes, edges, direction = 'LR') {
    const dagreGraph = new dagre_1.default.graphlib.Graph();
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
    dagre_1.default.layout(dagreGraph);
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
const BlastRadiusCanvas = ({ blastRadiusData, fullGraphData, evalResults, isEvaluating, onFocusNode, onRunEvals, onOpenFile, onResetView, }) => {
    const [nodes, setNodes, onNodesChange] = (0, reactflow_1.useNodesState)([]);
    const [edges, setEdges, onEdgesChange] = (0, reactflow_1.useEdgesState)([]);
    const [selectedNode, setSelectedNode] = (0, react_1.useState)(null);
    const [layoutDirection, setLayoutDirection] = (0, react_1.useState)('LR');
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    // Determine current active dataset: blast radius subgraph or full workspace DAG
    const rawNodes = (0, react_1.useMemo)(() => {
        if (blastRadiusData?.subgraphNodes?.length) {
            return blastRadiusData.subgraphNodes;
        }
        return fullGraphData?.nodes || [];
    }, [blastRadiusData, fullGraphData]);
    const rawEdges = (0, react_1.useMemo)(() => {
        if (blastRadiusData?.subgraphEdges?.length) {
            return blastRadiusData.subgraphEdges;
        }
        return fullGraphData?.edges || [];
    }, [blastRadiusData, fullGraphData]);
    // Construct React Flow elements whenever dataset or direction changes
    (0, react_1.useEffect)(() => {
        if (!rawNodes.length)
            return;
        const initialNodes = rawNodes.map((n) => ({
            id: n.id,
            type: 'customHarnessNode',
            data: n,
            position: { x: 0, y: 0 },
        }));
        const initialEdges = rawEdges.map((e, index) => {
            let strokeColor = '#64748b';
            let strokeDasharray;
            if (e.type === 'implements') {
                strokeColor = '#10b981';
                strokeDasharray = '5 5';
            }
            else if (e.type === 'validates') {
                strokeColor = '#a855f7';
                strokeDasharray = '3 3';
            }
            else if (e.type === 'uses_tool') {
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
                    type: reactflow_1.MarkerType.ArrowClosed,
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
    const handleSearch = (query) => {
        setSearchQuery(query);
        if (!query.trim())
            return;
        const match = rawNodes.find((n) => n.id.toLowerCase().includes(query.toLowerCase()) ||
            n.title.toLowerCase().includes(query.toLowerCase()));
        if (match) {
            setSelectedNode(match);
        }
    };
    const handleNodeClick = (0, react_1.useCallback)((_, node) => {
        const found = rawNodes.find((n) => n.id === node.id);
        if (found) {
            setSelectedNode(found);
        }
    }, [rawNodes]);
    const report = blastRadiusData?.report;
    const isBlastMode = Boolean(blastRadiusData);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "relative flex flex-col h-screen w-full bg-[#121316] text-zinc-100 font-sans select-none overflow-hidden", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur z-20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-sm tracking-wide text-zinc-100", children: isBlastMode ? 'Blast Radius Impact Canvas' : 'Canonical Knowledge DAG' }), isBlastMode && report && ((0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "purple", children: ["Origin: ", report.origin_nodes[0] || 'Unknown'] }))] }), isBlastMode && report && ((0, jsx_runtime_1.jsxs)("div", { className: "hidden sm:flex items-center gap-2 text-xs", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-zinc-400", children: "Total Blast:" }), (0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "default", children: [report.total_blast_radius, " nodes"] }), report.impacted_fatal_invariants.length > 0 && ((0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "danger", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ShieldAlert, { className: "w-3 h-3" }), report.impacted_fatal_invariants.length, " Fatal Risk"] })), report.impacted_evals.length > 0 && ((0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "success", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ListChecks, { className: "w-3 h-3" }), report.impacted_evals.length, " Evals Required"] }))] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative hidden md:block", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { className: "w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" }), (0, jsx_runtime_1.jsx)("input", { type: "text", placeholder: "Search node...", value: searchQuery, onChange: (e) => handleSearch(e.target.value), className: "bg-zinc-950/80 text-zinc-200 border border-zinc-800 text-xs rounded-md pl-8 pr-2.5 py-1 w-36 focus:w-48 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500" })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: () => setLayoutDirection((prev) => (prev === 'LR' ? 'TB' : 'LR')), className: "flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 transition", title: "Toggle Layout Direction (Horizontal / Vertical)", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Split, { className: "w-3 h-3" }), (0, jsx_runtime_1.jsx)("span", { children: layoutDirection === 'LR' ? 'Horizontal' : 'Vertical' })] }), (0, jsx_runtime_1.jsxs)("button", { onClick: () => onRunEvals(report?.impacted_evals || []), disabled: isEvaluating, className: "flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded shadow transition active:scale-95", title: "Execute test suites validating the impacted invariants", children: [isEvaluating ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "w-3.5 h-3.5 animate-spin" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.Play, { className: "w-3.5 h-3.5" })), (0, jsx_runtime_1.jsx)("span", { children: isEvaluating ? 'Running...' : 'Re-run Impacted Tests' })] }), isBlastMode && ((0, jsx_runtime_1.jsxs)("button", { onClick: onResetView, className: "flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 transition", title: "Reset to Full Workspace Graph", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RotateCcw, { className: "w-3 h-3" }), (0, jsx_runtime_1.jsx)("span", { children: "Full Graph" })] }))] })] }), evalResults && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between px-4 py-2 bg-zinc-950/90 border-b border-zinc-800 text-xs z-20", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-zinc-300", children: "Evaluation Suite Run:" }), (0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "success", children: ["Passed: ", evalResults.passed] }), evalResults.failed > 0 && (0, jsx_runtime_1.jsxs)(Badge_1.Badge, { variant: "danger", children: ["Failed: ", evalResults.failed] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-zinc-500", children: ["Total: ", evalResults.total, " tests executed"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex items-center gap-2", children: evalResults.results.map((r) => ((0, jsx_runtime_1.jsxs)("span", { className: `font-mono text-[11px] ${r.status === 'passed' ? 'text-emerald-400' : 'text-red-400'}`, children: [r.evalId, ": ", r.status.toUpperCase()] }, r.evalId))) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 w-full h-full relative", children: [(0, jsx_runtime_1.jsxs)(reactflow_1.default, { nodes: nodes, edges: edges, nodeTypes: nodeTypes, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, onNodeClick: handleNodeClick, fitView: true, attributionPosition: "bottom-right", children: [(0, jsx_runtime_1.jsx)(reactflow_1.Background, { color: "#27272a", gap: 18, size: 1 }), (0, jsx_runtime_1.jsx)(reactflow_1.Controls, { position: "bottom-left" }), (0, jsx_runtime_1.jsx)(reactflow_1.MiniMap, { nodeColor: (n) => {
                                    if (n.data?.riskLevel === 'origin')
                                        return '#6366f1';
                                    if (n.data?.riskLevel === 'fatal_broken')
                                        return '#ef4444';
                                    if (n.data?.riskLevel === 'required_eval')
                                        return '#10b981';
                                    return '#3f3f46';
                                }, maskColor: "rgba(0, 0, 0, 0.6)", className: "!bottom-4 !right-4 !bg-zinc-950/80 !border !border-zinc-800 !rounded-lg" })] }), (0, jsx_runtime_1.jsx)(NodeDetailDrawer_1.NodeDetailDrawer, { node: selectedNode, onClose: () => setSelectedNode(null), onOpenFile: onOpenFile, onFocusBlastRadius: (id) => {
                            onFocusNode(id);
                        } })] })] }));
};
exports.BlastRadiusCanvas = BlastRadiusCanvas;
//# sourceMappingURL=BlastRadiusCanvas.js.map