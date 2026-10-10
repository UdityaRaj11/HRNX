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
exports.App = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const client_1 = __importDefault(require("react-dom/client"));
require("./styles/index.css");
const MultiAgentPreview_1 = require("./components/preview/MultiAgentPreview");
const BlastRadiusCanvas_1 = require("./components/blast/BlastRadiusCanvas");
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : {
    postMessage: (msg) => console.log('postMessage:', msg),
    getState: () => ({}),
    setState: () => { },
};
const App = () => {
    // View mode can be 'preview' or 'blast-radius'
    const [viewMode, setViewMode] = (0, react_1.useState)('preview');
    // Preview state
    const [previewData, setPreviewData] = (0, react_1.useState)(null);
    const [activeTarget, setActiveTarget] = (0, react_1.useState)('claude');
    // Blast radius state
    const [blastRadiusData, setBlastRadiusData] = (0, react_1.useState)(null);
    const [fullGraphData, setFullGraphData] = (0, react_1.useState)(null);
    const [evalResults, setEvalResults] = (0, react_1.useState)(null);
    const [isEvaluating, setIsEvaluating] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        // Notify VS Code that webview is ready
        vscode.postMessage({ type: 'WEBVIEW_READY' });
        // Handle incoming messages from extension host
        const handleMessage = (event) => {
            const message = event.data;
            switch (message.type) {
                case 'INIT_VIEW':
                    if (message.view)
                        setViewMode(message.view);
                    if (message.target)
                        setActiveTarget(message.target);
                    break;
                case 'UPDATE_PREVIEW':
                    setViewMode('preview');
                    setPreviewData(message.data);
                    if (message.activeTarget)
                        setActiveTarget(message.activeTarget);
                    break;
                case 'UPDATE_BLAST_RADIUS':
                    setViewMode('blast-radius');
                    setBlastRadiusData(message.data);
                    if (message.fullGraph)
                        setFullGraphData(message.fullGraph);
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
                    break;
                default:
                    break;
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
    return ((0, jsx_runtime_1.jsx)("div", { className: "h-screen w-screen overflow-hidden bg-[var(--vscode-editor-background)] text-[var(--vscode-editor-foreground)]", children: viewMode === 'preview' ? ((0, jsx_runtime_1.jsx)(MultiAgentPreview_1.MultiAgentPreview, { previewData: previewData, activeTarget: activeTarget, onSelectTarget: (target) => {
                setActiveTarget(target);
                vscode.postMessage({ type: 'CHANGE_TARGET', target });
            }, onSyncToDisk: (target) => {
                vscode.postMessage({ type: 'SYNC_TO_DISK', target });
            }, onOpenFile: (filename) => {
                vscode.postMessage({ type: 'OPEN_FILE', filename });
            } })) : ((0, jsx_runtime_1.jsx)(BlastRadiusCanvas_1.BlastRadiusCanvas, { blastRadiusData: blastRadiusData, fullGraphData: fullGraphData, evalResults: evalResults, isEvaluating: isEvaluating, onFocusNode: (nodeId) => {
                vscode.postMessage({ type: 'FOCUS_NODE', nodeId });
            }, onRunEvals: (evalIds) => {
                setIsEvaluating(true);
                vscode.postMessage({ type: 'RUN_EVALS', evalIds });
            }, onOpenFile: (filePath) => {
                vscode.postMessage({ type: 'OPEN_FILE_PATH', filePath });
            }, onResetView: () => {
                setBlastRadiusData(null);
                vscode.postMessage({ type: 'GET_FULL_GRAPH' });
            } })) }));
};
exports.App = App;
client_1.default.createRoot(document.getElementById('root')).render((0, jsx_runtime_1.jsx)(react_1.default.StrictMode, { children: (0, jsx_runtime_1.jsx)(exports.App, {}) }));
//# sourceMappingURL=main.js.map