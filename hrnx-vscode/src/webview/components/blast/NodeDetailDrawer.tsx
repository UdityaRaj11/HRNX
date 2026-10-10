import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Shield,
  Crosshair,
  ArrowRight,
  CheckCircle2,
  MessageSquare,
  Send,
  Check,
  Sparkles,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import { CommentThread, DraftNode, HarnessNodeData } from '../../../types';
import { Badge } from '../common/Badge';

interface NodeDetailDrawerProps {
  node: HarnessNodeData | null;
  comments?: CommentThread[];
  draft?: DraftNode | null;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
  onFocusBlastRadius: (nodeId: string) => void;
  onAddComment?: (nodeId: string, text: string) => void;
  onAddReply?: (threadId: string, text: string) => void;
  onResolveComment?: (threadId: string, resolved: boolean) => void;
  onPromoteDraft?: (nodeId: string) => void;
  onDiscardDraft?: (nodeId: string) => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  comments = [],
  draft = null,
  onClose,
  onOpenFile,
  onFocusBlastRadius,
  onAddComment,
  onAddReply,
  onResolveComment,
  onPromoteDraft,
  onDiscardDraft,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  if (!node) return null;

  const nodeComments = comments.filter((c) => c.nodeId === node.id);

  const handlePostComment = () => {
    if (newCommentText.trim() && onAddComment) {
      onAddComment(node.id, newCommentText.trim());
      setNewCommentText('');
    }
  };

  const handlePostReply = (threadId: string) => {
    const text = replyTexts[threadId];
    if (text && text.trim() && onAddReply) {
      onAddReply(threadId, text.trim());
      setReplyTexts((prev) => ({ ...prev, [threadId]: '' }));
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 md:w-96 bg-[var(--vscode-sideBar-background)] border-l border-[var(--vscode-panel-border)] shadow-2xl z-30 flex flex-col text-xs text-[var(--vscode-editor-foreground)] select-text">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--vscode-panel-border)] bg-zinc-900/60">
        <div className="flex items-center gap-2 overflow-hidden">
          <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-sm truncate">{node.title}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Active Collaborative Draft Banner */}
        {draft && (
          <div className="p-3 rounded-lg border border-indigo-500/40 bg-indigo-500/10 space-y-2">
            <div className="flex items-center justify-between text-indigo-300 font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Collaborative Draft in Memory
              </span>
              <span className="text-[10px] text-indigo-400">by {draft.modifiedBy || 'peer'}</span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Uncommitted live draft with {Object.keys(draft.updatedFrontmatter || {}).length} modified field(s).
            </p>
            <div className="flex gap-2 pt-1">
              {onPromoteDraft && (
                <button
                  onClick={() => onPromoteDraft(node.id)}
                  className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition"
                >
                  <ArrowUpRight className="w-3 h-3" /> Promote to Disk
                </button>
              )}
              {onDiscardDraft && (
                <button
                  onClick={() => onDiscardDraft(node.id)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px] transition"
                  title="Discard in-memory draft"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Node ID & Badges */}
        <div className="space-y-1.5">
          <div className="font-mono text-zinc-400 text-[11px] select-all bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800">
            {node.id}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="purple">{node.type.toUpperCase()}</Badge>
            {node.severity && (
              <Badge
                variant={
                  node.severity === 'fatal_invariant'
                    ? 'danger'
                    : node.severity === 'warning'
                    ? 'warning'
                    : 'info'
                }
              >
                {node.severity}
              </Badge>
            )}
            {node.status && <Badge variant="default">{node.status}</Badge>}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onFocusBlastRadius(node.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition shadow-sm"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Focus Blast Radius</span>
          </button>
          {node.filePath && (
            <button
              onClick={() => onOpenFile(node.filePath)}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition"
              title="Open Source Markdown File"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Invariant Excerpt */}
        {node.body && (
          <div className="space-y-1">
            <span className="font-semibold text-zinc-300">Description / Excerpt:</span>
            <div className="p-2.5 bg-zinc-950/40 rounded border border-zinc-800/80 font-mono text-[11px] whitespace-pre-wrap text-zinc-300 max-h-40 overflow-auto">
              {node.body}
            </div>
          </div>
        )}

        {/* Dependencies */}
        <div className="space-y-2 border-t border-zinc-800/80 pt-3">
          <span className="font-semibold text-zinc-300">Dependencies (`depends_on`):</span>
          {node.dependsOn && node.dependsOn.length > 0 ? (
            <div className="space-y-1">
              {node.dependsOn.map((dep) => (
                <div
                  key={dep}
                  onClick={() => onFocusBlastRadius(dep)}
                  className="flex items-center justify-between p-1.5 bg-zinc-900 rounded border border-zinc-800 hover:border-indigo-500 cursor-pointer transition text-[11px] font-mono text-zinc-300"
                >
                  <span className="truncate">{dep}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-zinc-500 italic text-[11px]">No upstream dependencies.</div>
          )}
        </div>

        {/* Multiplayer Review Discussion & Comments */}
        <div className="space-y-3 border-t border-zinc-800/80 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              Live Peer Discussion ({nodeComments.length})
            </span>
          </div>

          {/* Comment Threads */}
          <div className="space-y-2.5">
            {nodeComments.map((thread) => (
              <div
                key={thread.id}
                className={`p-2.5 rounded-lg border text-[11px] space-y-2 ${
                  thread.resolved
                    ? 'bg-zinc-900/40 border-zinc-800/60 opacity-75'
                    : 'bg-zinc-900/90 border-indigo-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: thread.authorColor || '#6366f1' }}
                    ></span>
                    <span className="font-bold text-zinc-200">{thread.author}</span>
                  </div>
                  {onResolveComment && (
                    <button
                      onClick={() => onResolveComment(thread.id, !thread.resolved)}
                      className={`text-[10px] px-1.5 py-0.5 rounded transition flex items-center gap-1 ${
                        thread.resolved
                          ? 'text-emerald-400 bg-emerald-950/40'
                          : 'text-zinc-400 hover:text-white bg-zinc-800'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      {thread.resolved ? 'Resolved' : 'Resolve'}
                    </button>
                  )}
                </div>

                <p className="text-zinc-300 whitespace-pre-wrap">{thread.text}</p>

                {/* Replies */}
                {thread.replies && thread.replies.length > 0 && (
                  <div className="pl-3 border-l-2 border-indigo-500/30 space-y-1.5 pt-1">
                    {thread.replies.map((rep) => (
                      <div key={rep.id} className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <span className="font-semibold text-zinc-300">{rep.author}:</span>
                        </div>
                        <p className="text-zinc-300 text-[11px]">{rep.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input */}
                {!thread.resolved && onAddReply && (
                  <div className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Reply..."
                      value={replyTexts[thread.id] || ''}
                      onChange={(e) =>
                        setReplyTexts((prev) => ({ ...prev, [thread.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handlePostReply(thread.id)}
                      className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handlePostReply(thread.id)}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] transition"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New Comment Input */}
          {onAddComment && (
            <div className="pt-1 space-y-1.5">
              <textarea
                placeholder="Leave review comment or question..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                rows={2}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded p-2 text-[11px] text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handlePostComment}
                disabled={!newCommentText.trim()}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded font-medium text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Post Comment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
