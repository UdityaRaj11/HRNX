import * as vscode from 'vscode';
import { RelayClient } from './relayClient';
import { HRNXClient } from '../client/hrnxClient';

export class CollabStatusBar implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private relayClient: RelayClient,
    private hrnxClient: HRNXClient
  ) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'hrnx.collabSessionMenu';
    this.updateStatus();
    this.statusBarItem.show();

    // Event listeners
    this.relayClient.on('connected', () => this.updateStatus());
    this.relayClient.on('disconnected', () => this.updateStatus());
    this.relayClient.on('peerJoined', () => this.updateStatus());
    this.relayClient.on('peerLeft', () => this.updateStatus());
    this.relayClient.on('draftUpdated', () => this.updateStatus());
    this.relayClient.on('draftDiscarded', () => this.updateStatus());
    this.relayClient.on('draftPromoted', () => this.updateStatus());
  }

  public updateStatus(): void {
    if (this.relayClient.isConnected) {
      const peerCount = this.relayClient.peers.size + 1; // including self
      const draftCount = this.relayClient.drafts.size;
      const draftBadge = draftCount > 0 ? ` [${draftCount} draft${draftCount > 1 ? 's' : ''}]` : '';

      this.statusBarItem.text = `$(broadcast) HRNX Live: ${peerCount} Peer${peerCount > 1 ? 's' : ''}${draftBadge}`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        `**HRNX Multiplayer Session**\n\n` +
          `• **Room**: \`${this.relayClient.currentRoomId}\`\n` +
          `• **Connected Peers**: ${peerCount}\n` +
          `• **Active Drafts**: ${draftCount}\n\n` +
          `Click to manage session.`
      );
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(radio-tower) HRNX Live: Off`;
      this.statusBarItem.tooltip = 'HRNX Multiplayer Collaboration is disconnected. Click to start or join.';
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  public async showSessionMenu(): Promise<void> {
    if (this.relayClient.isConnected) {
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(link) Copy Invite / Session URL',
          description: `ws://127.0.0.1:8765 (Room: ${this.relayClient.currentRoomId})`,
        },
        {
          label: '$(arrow-up) Promote In-Memory Drafts to Workspace',
          description: `Promotes ${this.relayClient.drafts.size} draft(s) directly to disk files`,
        },
        {
          label: '$(close) Disconnect from Collaboration Session',
          description: 'Disconnect local client from relay room',
        },
        {
          label: '$(stop) Stop Local Relay Server',
          description: 'Shuts down the background hrnx-relay daemon',
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Multiplayer Session: Room "${this.relayClient.currentRoomId}"`,
      });

      if (!selected) return;

      if (selected.label.includes('Copy Invite')) {
        await vscode.env.clipboard.writeText(`ws://127.0.0.1:8765#${this.relayClient.currentRoomId}`);
        vscode.window.showInformationMessage('HRNX Session invite link copied to clipboard!');
      } else if (selected.label.includes('Promote In-Memory Drafts')) {
        for (const nodeId of Array.from(this.relayClient.drafts.keys())) {
          this.relayClient.promoteDraft(nodeId);
        }
        vscode.window.showInformationMessage('Promoted all collaborative drafts to disk workspace.');
      } else if (selected.label.includes('Disconnect')) {
        this.relayClient.disconnect();
        vscode.window.showInformationMessage('Disconnected from HRNX multiplayer session.');
      } else if (selected.label.includes('Stop Local Relay')) {
        this.relayClient.disconnect();
        await this.hrnxClient.stopRelay();
        vscode.window.showInformationMessage('HRNX Relay server stopped.');
      }
    } else {
      const items: vscode.QuickPickItem[] = [
        {
          label: '$(broadcast) Start & Join Local Relay Session (hrnx share)',
          description: 'Launches ephemeral WebSocket server at ws://127.0.0.1:8765 (Room: main)',
        },
        {
          label: '$(remote) Connect to Remote Team Relay...',
          description: 'Connect to an existing hrnx-relay container or host',
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Start or join a multiplayer harness engineering session',
      });

      if (!selected) return;

      if (selected.label.includes('Start & Join Local Relay')) {
        try {
          const res = await this.hrnxClient.startRelay('127.0.0.1', 8765, 'main');
          if (res.success) {
            await this.relayClient.connect('127.0.0.1', 8765, 'main', 'Lead Engineer');
            vscode.window.showInformationMessage('HRNX Multiplayer Session started and connected at ws://127.0.0.1:8765!');
          } else {
            vscode.window.showErrorMessage(`Failed to start relay: ${res.error}`);
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Error starting session: ${err.message}`);
        }
      } else if (selected.label.includes('Connect to Remote Team Relay')) {
        const address = await vscode.window.showInputBox({
          prompt: 'Enter WebSocket Relay URL',
          value: 'ws://127.0.0.1:8765',
        });
        if (!address) return;

        const name = await vscode.window.showInputBox({
          prompt: 'Enter your Display Name',
          value: 'Engineer',
        });

        try {
          const parsed = new URL(address);
          const host = parsed.hostname || '127.0.0.1';
          const port = parseInt(parsed.port || '8765', 10);
          await this.relayClient.connect(host, port, 'main', name || 'Engineer');
          vscode.window.showInformationMessage(`Connected to HRNX Multiplayer Relay at ${address}!`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to connect to relay: ${err.message}`);
        }
      }
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
