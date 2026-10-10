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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ServerManager {
    /**
     * Resolves the Python executable to run the hrnx-lsp server.
     */
    static resolveServerExecutable(workspaceRoot) {
        const config = vscode.workspace.getConfiguration('hrnx');
        const customPython = config.get('pythonPath');
        const customServer = config.get('serverPath');
        if (customServer) {
            return {
                command: customServer,
                args: [],
            };
        }
        if (customPython && fs.existsSync(customPython)) {
            return {
                command: customPython,
                args: ['-m', 'hrnx.server.lsp'],
            };
        }
        // Check candidate virtual environments in workspace
        if (workspaceRoot) {
            const candidates = [
                path.join(workspaceRoot, 'hrnx-core', '.venv', 'Scripts', 'python.exe'),
                path.join(workspaceRoot, 'hrnx-core', '.venv', 'bin', 'python'),
                path.join(workspaceRoot, '.venv', 'Scripts', 'python.exe'),
                path.join(workspaceRoot, '.venv', 'bin', 'python'),
            ];
            for (const candidate of candidates) {
                if (fs.existsSync(candidate)) {
                    return {
                        command: candidate,
                        args: ['-m', 'hrnx.server.lsp'],
                    };
                }
            }
        }
        // Default fallback to python in PATH
        return {
            command: process.platform === 'win32' ? 'python' : 'python3',
            args: ['-m', 'hrnx.server.lsp'],
        };
    }
}
exports.ServerManager = ServerManager;
//# sourceMappingURL=serverManager.js.map