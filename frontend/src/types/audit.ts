import type { UserSummary } from "./auth";

export interface AuditLog {
  id: number;
  actor: UserSummary | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata_json: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
