import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ServerExecutable {
  command: string;
  args: string[];
}

export class ServerManager {
  /**
   * Resolves the Python executable to run the hrnx-lsp server.
   */
  public static resolveServerExecutable(workspaceRoot?: string): ServerExecutable {
    const config = vscode.workspace.getConfiguration('hrnx');
    const customPython = config.get<string>('pythonPath');
    const customServer = config.get<string>('serverPath');

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
