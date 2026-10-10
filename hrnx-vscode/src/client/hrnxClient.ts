import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';
import { ServerManager } from './serverManager';
import {
  AtomicCommitResultData,
  BlastRadiusResponse,
  CommentReply,
  CommentThread,
  ConformanceMatrixData,
  DriftReportData,
  EvalRunResponse,
  EvaluationSpec,
  GraphResponse,
  MergeConflictData,
  RelayStatusData,
  StagedSyncStatusData,
  TranspilePreviewData,
} from '../types';

export class HRNXClient {
  private client: LanguageClient | null = null;
  private outputChannel: vscode.OutputChannel;
  private isReady = false;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('HRNX Language Server');
  }

  public async start(): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const executable = ServerManager.resolveServerExecutable(workspaceRoot);

    this.outputChannel.appendLine(
      `Starting hrnx-lsp: ${executable.command} ${executable.args.join(' ')}`
    );

    const serverOptions: ServerOptions = {
      command: executable.command,
      args: executable.args,
      options: {
        cwd: workspaceRoot,
      },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { scheme: 'file', language: 'markdown' },
        { scheme: 'file', pattern: '**/.hrnx/**/*.md' },
      ],
      synchronize: {
        fileEvents: vscode.workspace.createFileSystemWatcher('**/.hrnx/**/*.md'),
      },
      outputChannel: this.outputChannel,
    };

    this.client = new LanguageClient(
      'hrnxLanguageServer',
      'HRNX Language Server',
      serverOptions,
      clientOptions
    );

    try {
      await this.client.start();
      this.isReady = true;
      this.outputChannel.appendLine('hrnx-lsp Language Server started successfully.');
    } catch (err) {
      this.outputChannel.appendLine(`Failed to start hrnx-lsp: ${String(err)}`);
    }
  }

  public async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      this.isReady = false;
    }
  }

  public getRawClient(): LanguageClient | null {
    return this.client;
  }

  public async getGraph(): Promise<GraphResponse> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<GraphResponse>('hrnx/getGraph', {});
  }

  public async getBlastRadius(nodeId: string): Promise<BlastRadiusResponse> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<BlastRadiusResponse>('hrnx/getBlastRadius', {
      nodeId,
    });
  }

  public async previewTranspile(
    nodeId?: string,
    targetAgent = 'claude',
    docText?: string,
    docPath?: string
  ): Promise<TranspilePreviewData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<TranspilePreviewData>('hrnx/previewTranspile', {
      nodeId,
      targetAgent,
      docText,
      docPath,
    });
  }

  public async inspectDrift(): Promise<DriftReportData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<DriftReportData>('hrnx/inspectDrift', {});
  }

  public async reconcile(targetId?: string): Promise<{ reconciledFiles: string[]; items: any[] }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ reconciledFiles: string[]; items: any[] }>(
      'hrnx/reconcile',
      { targetId }
    );
  }

  public async getEvaluationSpecs(): Promise<{ specs: EvaluationSpec[]; total: number }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ specs: EvaluationSpec[]; total: number }>(
      'hrnx/getEvaluationSpecs',
      {}
    );
  }

  public async getConformanceMatrix(
    targets?: string[],
    sandboxMode = 'local'
  ): Promise<ConformanceMatrixData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<ConformanceMatrixData>(
      'hrnx/getConformanceMatrix',
      { targets, sandboxMode }
    );
  }

  public async runEvaluations(
    evalIds?: string[],
    targets?: string[],
    sandboxMode = 'local'
  ): Promise<EvalRunResponse> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<EvalRunResponse>('hrnx/runEvaluations', {
      evalIds,
      targets,
      sandboxMode,
    });
  }

  // =========================================================================
  // Stream 5: Multiplayer Collaboration, Semantic Merge & Git Synchronization
  // =========================================================================

  public async getComments(nodeId?: string): Promise<{ threads: CommentThread[]; total: number }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ threads: CommentThread[]; total: number }>(
      'hrnx/getComments',
      { nodeId }
    );
  }

  public async addComment(
    nodeId: string,
    text: string,
    author = 'Engineer',
    authorColor = '#6366f1'
  ): Promise<{ thread: CommentThread }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ thread: CommentThread }>('hrnx/addComment', {
      nodeId,
      text,
      author,
      authorColor,
    });
  }

  public async addReply(
    threadId: string,
    text: string,
    author = 'Engineer',
    authorColor = '#6366f1'
  ): Promise<{ reply: CommentReply }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ reply: CommentReply }>('hrnx/addReply', {
      threadId,
      text,
      author,
      authorColor,
    });
  }

  public async resolveComment(
    threadId: string,
    resolved = true
  ): Promise<{ thread: CommentThread }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ thread: CommentThread }>('hrnx/resolveComment', {
      threadId,
      resolved,
    });
  }

  public async getMergeConflict(
    filePath?: string,
    baseText?: string,
    oursText?: string,
    theirsText?: string
  ): Promise<MergeConflictData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<MergeConflictData>('hrnx/getMergeConflict', {
      filePath,
      baseText,
      oursText,
      theirsText,
    });
  }

  public async resolveMergeConflict(
    filePath: string,
    resolvedFrontmatter: Record<string, any>,
    resolvedBody: string
  ): Promise<{ success: boolean; filePath: string }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ success: boolean; filePath: string }>(
      'hrnx/resolveMergeConflict',
      {
        filePath,
        resolvedFrontmatter,
        resolvedBody,
      }
    );
  }

  public async checkStagedSyncStatus(): Promise<StagedSyncStatusData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<StagedSyncStatusData>('hrnx/checkStagedSyncStatus', {});
  }

  public async atomicCommit(message: string): Promise<AtomicCommitResultData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<AtomicCommitResultData>('hrnx/atomicCommit', { message });
  }

  public async installGitHooks(): Promise<{
    success: boolean;
    preCommitHook?: string;
    mergeDriverConfigured?: boolean;
    error?: string;
  }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{
      success: boolean;
      preCommitHook?: string;
      mergeDriverConfigured?: boolean;
      error?: string;
    }>('hrnx/installGitHooks', {});
  }

  public async getRelayStatus(): Promise<RelayStatusData> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<RelayStatusData>('hrnx/relayStatus', {});
  }

  public async startRelay(
    host = '127.0.0.1',
    port = 8765,
    roomId = 'main'
  ): Promise<{ success: boolean; host: string; port: number; roomId: string; error?: string }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{
      success: boolean;
      host: string;
      port: number;
      roomId: string;
      error?: string;
    }>('hrnx/startRelay', { host, port, roomId });
  }

  public async stopRelay(): Promise<{ success: boolean }> {
    if (!this.client || !this.isReady) {
      throw new Error('Language Server is not active');
    }
    return await this.client.sendRequest<{ success: boolean }>('hrnx/stopRelay', {});
  }
}

