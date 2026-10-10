export interface HarnessNodeData {
  id: string;
  title: string;
  type: 'directive' | 'skill' | 'tool' | 'eval' | 'adr' | 'context';
  severity?: 'fatal_invariant' | 'warning' | 'advisory' | null;
  status?: string | null;
  filePath: string;
  dependsOn: string[];
  implements: string[];
  validatedBy: string[];
  usesTools: string[];
  tags: string[];
  body: string;
  riskLevel?: 'origin' | 'required_eval' | 'fatal_broken' | 'direct_impact' | 'transitive_impact';
}

export interface GraphEdgeData {
  source: string;
  target: string;
  type: 'depends_on' | 'implements' | 'validates' | 'uses_tool' | 'overrides' | string;
}

export interface WorkspaceHealthData {
  total_nodes: number;
  node_counts_by_type: Record<string, number>;
  severity_counts: Record<string, number>;
  parse_errors: string[];
  cycles: string[][];
  dangling_references: Array<{ source: string; target: string; edge_type: string }>;
  unimplemented_adrs: string[];
  is_healthy: boolean;
}

export interface AgentTargetInfo {
  id: string;
  name: string;
  file?: string;
  supportedPrimitives?: string[];
}

export interface CompatibilityDiagnosticData {
  node_id: string;
  target: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
  feature?: string;
  lossy?: boolean;
}

export interface GraphResponse {
  nodes: HarnessNodeData[];
  edges: GraphEdgeData[];
  health: WorkspaceHealthData;
  availableTargets: AgentTargetInfo[];
}

export interface BlastRadiusReportData {
  origin_nodes: string[];
  direct_dependents: string[];
  transitive_dependents: string[];
  impacted_evals: string[];
  impacted_fatal_invariants: string[];
  impacted_skills: string[];
  affected_targets: string[];
  total_blast_radius: number;
  is_fatal_risk: boolean;
}

export interface BlastRadiusResponse {
  report: BlastRadiusReportData;
  subgraphNodes: HarnessNodeData[];
  subgraphEdges: GraphEdgeData[];
}

export interface TranspilePreviewData {
  target: string;
  filename: string;
  content: string;
  diskContent?: string;
  hasDiff: boolean;
  diff?: string;
  error?: string;
  diagnostics?: CompatibilityDiagnosticData[];
}

export interface DriftItemData {
  target: string;
  relative_path: string;
  absolute_path: string;
  status: 'in_sync' | 'drifted' | 'missing';
  diff?: string | null;
  expected_content: string;
  disk_content: string;
}

export interface DriftReportData {
  driftCount: number;
  missingCount: number;
  inSyncCount: number;
  items: DriftItemData[];
}

export interface EvalAssertionResult {
  assertion_index: number;
  check: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export interface EvalResultData {
  evalId: string;
  target?: string;
  title: string;
  status: 'passed' | 'failed';
  message: string;
  durationMs: number;
  assertions?: EvalAssertionResult[];
  transcript?: Record<string, any>;
}

export interface AgentScoreData {
  target: string;
  total: number;
  passed: number;
  failed: number;
  pass_rate: number;
  avg_duration_ms: number;
}

export interface DivergenceData {
  eval_id: string;
  title: string;
  passing_agents: string[];
  failing_agents: string[];
  description: string;
}

export interface ConformanceMatrixData {
  eval_ids: string[];
  targets: string[];
  agent_scores: Record<string, AgentScoreData>;
  matrix: Record<string, Record<string, {
    passed: boolean;
    message: string;
    duration_ms: number;
    title?: string;
    assertions?: EvalAssertionResult[];
    transcript?: Record<string, any>;
    backend?: string;
  }>>;
  overall_agreement_index: number;
  divergences: DivergenceData[];
  total_evaluations: number;
  timestamp: string;
}

export interface EvaluationSpec {
  id: string;
  title: string;
  type: string;
  validates: string[];
  targetAgents: string[];
  prompt: string;
  assertionsCount: number;
  filePath?: string | null;
}

export interface EvalRunResponse {
  total: number;
  totalRuns?: number;
  passed: number;
  failed: number;
  runsPassed?: number;
  runsFailed?: number;
  agreementIndex?: number;
  results: EvalResultData[];
  matrix?: ConformanceMatrixData;
}

// =========================================================================
// Stream 5: Multiplayer Collaboration, Semantic Merge & Git Synchronization
// =========================================================================

export interface PeerInfo {
  id: string;
  name: string;
  color: string;
  activeNodeId?: string | null;
  cursorPosition?: { line: number; col: number } | null;
  joinedAt: number;
}

export interface DraftNode {
  nodeId: string;
  title?: string | null;
  updatedFrontmatter: Record<string, any>;
  body?: string | null;
  modifiedBy: string;
  modifiedAt: number;
}

export interface CommentReply {
  id: string;
  author: string;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  nodeId: string;
  author: string;
  authorColor: string;
  text: string;
  resolved: boolean;
  createdAt: number;
  replies: CommentReply[];
}

export interface FieldConflictData {
  field: string;
  base_value: any;
  ours_value: any;
  theirs_value: any;
  resolved_value?: any;
}

export interface NodeAstSlice {
  frontmatter: Record<string, any>;
  body: string;
}

export interface MergeConflictData {
  isClean: boolean;
  nodeId?: string | null;
  filePath?: string | null;
  autoMergedFields: string[];
  fieldConflicts: FieldConflictData[];
  hasBodyConflict: boolean;
  mergedContent: string;
  base: NodeAstSlice;
  ours: NodeAstSlice;
  theirs: NodeAstSlice;
  mergedFrontmatter: Record<string, any>;
  mergedBody: string;
}

export interface StagedSyncStatusData {
  has_staged_hrnx: boolean;
  targets_in_sync: boolean;
  staged_hrnx_files: string[];
  drifted_targets: string[];
  staged_target_files: string[];
}

export interface AtomicCommitResultData {
  success: boolean;
  message: string;
  commit_hash?: string | null;
  staged_files: string[];
  error?: string | null;
}

export interface RelayStatusData {
  isRunning: boolean;
  host: string;
  port: number;
  roomId: string;
  peerCount: number;
  session?: {
    roomId: string;
    peerCount: number;
    peers: PeerInfo[];
    draftCount: number;
    drafts: DraftNode[];
  } | null;
}


