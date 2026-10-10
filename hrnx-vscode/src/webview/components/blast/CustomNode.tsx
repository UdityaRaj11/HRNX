import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Shield, Zap, Wrench, ListChecks, Bookmark, AlertCircle, CheckCircle2 } from 'lucide-react';
import { HarnessNodeData } from '../../../types';
import { Badge } from '../common/Badge';

export const CustomHarnessNode: React.FC<NodeProps<HarnessNodeData>> = memo(({ data, selected }) => {
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
        return <Shield className="w-3.5 h-3.5 text-sky-400" />;
      case 'skill':
        return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-blue-400" />;
      case 'eval':
        return <ListChecks className="w-3.5 h-3.5 text-emerald-400" />;
      case 'adr':
        return <Bookmark className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Bookmark className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div
      className={`relative min-w-[220px] max-w-[280px] rounded-lg border-2 bg-zinc-900/95 p-3 text-zinc-100 backdrop-blur transition-all duration-150 ${getRiskStyles()} ${
        selected ? 'ring-2 ring-white/60' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-zinc-900"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {getTypeIcon()}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 truncate">
            {data.type}
          </span>
        </div>

        {/* Severity or Risk Badge */}
        {risk === 'origin' && <Badge variant="purple">ORIGIN</Badge>}
        {risk === 'required_eval' && <Badge variant="success">EVAL REQUIRED</Badge>}
        {risk === 'fatal_broken' && <Badge variant="danger">FATAL RISK</Badge>}
        {risk !== 'origin' && risk !== 'required_eval' && risk !== 'fatal_broken' && data.severity && (
          <Badge
            variant={
              data.severity === 'fatal_invariant'
                ? 'danger'
                : data.severity === 'warning'
                ? 'warning'
                : 'info'
            }
          >
            {data.severity === 'fatal_invariant' ? 'FATAL' : data.severity.toUpperCase()}
          </Badge>
        )}
      </div>

      {/* Title & ID */}
      <div className="pt-2">
        <div className="font-medium text-xs text-zinc-100 leading-tight line-clamp-2">
          {data.title}
        </div>
        <div className="mt-1 font-mono text-[10px] text-zinc-400 truncate">
          {data.id}
        </div>
      </div>

      {/* Quick stats footer */}
      <div className="mt-2.5 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400">
        <span>Deps: {data.dependsOn?.length || 0}</span>
        {data.validatedBy?.length ? (
          <span className="text-emerald-400">Validated</span>
        ) : (
          <span className="text-zinc-500">Unvalidated</span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-zinc-400 !border-2 !border-zinc-900"
      />
    </div>
  );
});
