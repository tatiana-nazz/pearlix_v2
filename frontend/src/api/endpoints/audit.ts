import type { Page, QueryParams } from "../../types/api";
import type { AuditLog } from "../../types/audit";
import { api } from "../http";

export const auditApi = {
  list: (query?: QueryParams) => api.get<Page<AuditLog>>("/audit-logs/", query),
  detail: (id: number) => api.get<AuditLog>(`/audit-logs/${id}/`),
};
