export interface IncidentLog {
  id: number;
  sanitized_log: string;
  captured_at: string;
}

export interface RemediationAction {
  id: number;
  action_type: string;
  status: string;
  execution_output?: string;
  duration_ms: number;
  executed_at: string;
}

export interface Incident {
  id: string;
  container_id: string;
  container_name: string;
  image: string;
  exit_code: number;
  termination_reason: string;
  status: "DETECTED" | "DIAGNOSING" | "REMEDIATING" | "RESOLVED" | "FAILED" | "ESCALATED_MANUAL_INTERVENTION";
  failure_classification?: string;
  root_cause?: string;
  confidence_score: number;
  operational_reasoning?: string;
  remediation_proposal?: string;
  action_taken?: string;
  remediation_status: string;
  is_flapping: boolean;
  restart_count: number;
  created_at: string;
  updated_at?: string;
  logs?: IncidentLog[];
  remediations?: RemediationAction[];
}

export interface ContainerWorkload {
  container_id: string;
  container_name: string;
  image: string;
  status: string;
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  restart_count: number;
}

export interface SystemStats {
  active_agents: number;
  monitored_workloads: number;
  total_incidents: number;
  auto_healed_count: number;
  escalated_count: number;
  mean_time_to_recovery_sec: number;
  uptime_seconds: number;
  system_status: "OPTIMAL" | "WARNING" | "CRITICAL";
}

export interface TelemetryEvent {
  event_type: string;
  incident_id?: string;
  timestamp: string;
  data: Record<string, any>;
}
