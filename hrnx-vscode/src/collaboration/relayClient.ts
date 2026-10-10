import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { CommentReply, CommentThread, DraftNode, PeerInfo } from '../types';

export class RelayClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  public isConnected = false;
  public localPeerId: string | null = null;
  public localName: string = 'Engineer';
  public localColor: string = '#6366f1';
  public currentRoomId: string = 'main';

  public peers: Map<string, PeerInfo> = new Map();
  public drafts: Map<string, DraftNode> = new Map();
  public comments: Map<string, CommentThread> = new Map();

  constructor() {
    super();
  }

  public connect(
    host = '127.0.0.1',
    port = 8765,
    roomId = 'main',
    name = 'Engineer',
    color = '#6366f1'
  ): Promise<void> {
    if (this.isConnected) {
      return Promise.resolve();
    }
    this.isConnecting = true;
    this.localName = name;
    this.localColor = color;
    this.currentRoomId = roomId;

    const url = `ws://${host}:${port}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          this.isConnected = true;
          this.isConnecting = false;
          // Send join message
          this.send({
            type: 'join',
            name: this.localName,
            color: this.localColor,
          });
          this.emit('connected', { roomId, url });
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          try {
            const msg = JSON.parse(data.toString());
            this.handleMessage(msg);
          } catch (err) {
            console.error('[RelayClient] Parse error:', err);
          }
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.peers.clear();
          this.emit('disconnected');
        });

        this.ws.on('error', (err) => {
          this.isConnected = false;
          this.isConnecting = false;
          this.emit('error', err);
          reject(err);
        });
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.peers.clear();
    this.emit('disconnected');
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public updatePresence(activeNodeId?: string | null, cursorPosition?: { line: number; col: number }): void {
    this.send({
      type: 'presence',
      activeNodeId,
      cursorPosition,
    });
  }

  public updateDraft(nodeId: string, frontmatter: any, body?: string, title?: string): void {
    this.send({
      type: 'draft_update',
      nodeId,
      frontmatter,
      body,
      title,
    });
  }

  public discardDraft(nodeId: string): void {
    this.send({
      type: 'draft_discard',
      nodeId,
    });
  }

  public promoteDraft(nodeId: string): void {
    this.send({
      type: 'draft_promote',
      nodeId,
    });
  }

  public addComment(nodeId: string, text: string): void {
    this.send({
      type: 'comment_add',
      nodeId,
      text,
      author: this.localName,
      authorColor: this.localColor,
    });
  }

  public addReply(threadId: string, text: string): void {
    this.send({
      type: 'comment_reply',
      threadId,
      text,
      author: this.localName,
      authorColor: this.localColor,
    });
  }

  public resolveComment(threadId: string, resolved = true): void {
    this.send({
      type: 'comment_resolve',
      threadId,
      resolved,
    });
  }

  private handleMessage(msg: any): void {
    switch (msg.type) {
      case 'init_state': {
        this.localPeerId = msg.yourPeerId;
        this.peers.clear();
        for (const p of msg.session.peers || []) {
          this.peers.set(p.id, p);
        }
        this.drafts.clear();
        for (const d of msg.session.drafts || []) {
          this.drafts.set(d.nodeId || d.node_id, d);
        }
        this.comments.clear();
        for (const c of msg.comments || []) {
          this.comments.set(c.id, c);
        }
        this.emit('stateSync', {
          peers: Array.from(this.peers.values()),
          drafts: Array.from(this.drafts.values()),
          comments: Array.from(this.comments.values()),
        });
        break;
      }

      case 'peer_joined': {
        const peer: PeerInfo = msg.peer;
        this.peers.set(peer.id, peer);
        this.emit('peerJoined', peer);
        break;
      }

      case 'peer_left': {
        const peerId: string = msg.peerId;
        this.peers.delete(peerId);
        this.emit('peerLeft', peerId);
        break;
      }

      case 'peer_presence': {
        const peer: PeerInfo = msg.peer;
        this.peers.set(peer.id, peer);
        this.emit('peerPresence', peer);
        break;
      }

      case 'draft_updated': {
        const draft: DraftNode = msg.draft;
        const nId = draft.nodeId || (draft as any).node_id;
        this.drafts.set(nId, draft);
        this.emit('draftUpdated', draft);
        break;
      }

      case 'draft_discarded': {
        const nId: string = msg.nodeId;
        this.drafts.delete(nId);
        this.emit('draftDiscarded', nId);
        break;
      }

      case 'draft_promoted': {
        const nId: string = msg.nodeId;
        this.drafts.delete(nId);
        this.emit('draftPromoted', { nodeId: nId, promotedBy: msg.promotedBy });
        break;
      }

      case 'comment_added': {
        const thread: CommentThread = msg.thread;
        this.comments.set(thread.id, thread);
        this.emit('commentAdded', thread);
        break;
      }

      case 'comment_replied': {
        const threadId: string = msg.threadId;
        const reply: CommentReply = msg.reply;
        const thread = this.comments.get(threadId);
        if (thread) {
          thread.replies.push(reply);
          this.emit('commentReplied', { threadId, reply });
        }
        break;
      }

      case 'comment_resolved': {
        const thread: CommentThread = msg.thread;
        this.comments.set(thread.id, thread);
        this.emit('commentResolved', thread);
        break;
      }
    }
  }
}
