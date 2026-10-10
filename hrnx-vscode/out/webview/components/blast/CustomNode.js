"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomHarnessNode = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const reactflow_1 = require("reactflow");
const lucide_react_1 = require("lucide-react");
const Badge_1 = require("../common/Badge");
exports.CustomHarnessNode = (0, react_1.memo)(({ data, selected }) => {
    const risk = data.riskLevel || 'transitive_impact';
    // Dynamic styling based on blast radius risk
    const getRiskStyles = () => {
        switch (risk) {
            case 'origin':
                return 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] ring-2 ring-indigo-500/40';
            case 'fatal_broken':
                return 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] ring-2 ring-red-500/30';
            case 'required_eval':
                return 'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/30';
            case 'direct_impact':
                return 'border-amber-500/90 shadow-[0_0_10px_rgba(245,158,11,0.3)]';
            case 'transitive_impact':
            default:
                return 'border-zinc-700 hover:border-zinc-500';
        }
    };
    const getTypeIcon = () => {
        switch (data.type) {
            case 'directive':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "w-3.5 h-3.5 text-sky-400" });
            case 'skill':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "w-3.5 h-3.5 text-yellow-400" });
            case 'tool':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Wrench, { className: "w-3.5 h-3.5 text-blue-400" });
            case 'eval':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.ListChecks, { className: "w-3.5 h-3.5 text-emerald-400" });
            case 'adr':
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Bookmark, { className: "w-3.5 h-3.5 text-purple-400" });
            default:
                return (0, jsx_runtime_1.jsx)(lucide_react_1.Bookmark, { className: "w-3.5 h-3.5 text-zinc-400" });
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: `relative min-w-[220px] max-w-[280px] rounded-lg border-2 bg-zinc-900/95 p-3 text-zinc-100 backdrop-blur transition-all duration-150 ${getRiskStyles()} ${selected ? 'ring-2 ring-white/60' : ''}`, children: [(0, jsx_runtime_1.jsx)(reactflow_1.Handle, { type: "target", position: reactflow_1.Position.Left, className: "!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-zinc-900" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-1 pb-1.5 border-b border-zinc-800", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5 overflow-hidden", children: [getTypeIcon(), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] font-semibold uppercase tracking-wider text-zinc-400 truncate", children: data.type })] }), risk === 'origin' && (0, jsx_runtime_1.jsx)(Badge_1.Badge, { variant: "purple", children: "ORIGIN" }), risk === 'required_eval' && (0, jsx_runtime_1.jsx)(Badge_1.Badge, { variant: "success", children: "EVAL REQUIRED" }), risk === 'fatal_broken' && (0, jsx_runtime_1.jsx)(Badge_1.Badge, { variant: "danger", children: "FATAL RISK" }), risk !== 'origin' && risk !== 'required_eval' && risk !== 'fatal_broken' && data.severity && ((0, jsx_runtime_1.jsx)(Badge_1.Badge, { variant: data.severity === 'fatal_invariant'
                            ? 'danger'
                            : data.severity === 'warning'
                                ? 'warning'
                                : 'info', children: data.severity === 'fatal_invariant' ? 'FATAL' : data.severity.toUpperCase() }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "pt-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-xs text-zinc-100 leading-tight line-clamp-2", children: data.title }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 font-mono text-[10px] text-zinc-400 truncate", children: data.id })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Deps: ", data.dependsOn?.length || 0] }), data.validatedBy?.length ? ((0, jsx_runtime_1.jsx)("span", { className: "text-emerald-400", children: "Validated" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-zinc-500", children: "Unvalidated" }))] }), (0, jsx_runtime_1.jsx)(reactflow_1.Handle, { type: "source", position: reactflow_1.Position.Right, className: "!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-zinc-900" })] }));
});
//# sourceMappingURL=CustomNode.js.map