import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { auditApi } from "../../api/endpoints/audit";
import { usersApi } from "../../api/endpoints/users";
import { Button, ClickableRow, Combobox, DataTableShell, Field, PageHeaderV2, Pagination, SectionHeading, SelectField, StatePanel, SurfaceCard } from "../../components/v2";
import { useFeatureT, type FeatureMessageKey } from "../../layouts/i18n";
import type { AuditLog } from "../../types/audit";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatDateTime } from "../../utils/dates";

type AuditFilters = { page: number; actor_id?: string; actor_role?: string; action?: string; entity_type?: string; entity_id?: string; created_from?: string; created_to?: string };
const knownActions: Record<string, FeatureMessageKey> = {
  clinic_settings_updated: "auditActionClinicSettingsUpdated", patient_created: "auditActionPatientCreated", patient_updated: "auditActionPatientUpdated", appointment_created: "auditActionAppointmentCreated", appointment_updated: "auditActionAppointmentUpdated", appointment_status_changed: "auditActionAppointmentStatusChanged", appointment_checked_in: "auditActionAppointmentStatusChanged", appointment_cancelled: "auditActionAppointmentStatusChanged", appointment_marked_no_show: "auditActionAppointmentStatusChanged", visit_started: "auditActionVisitStarted", clinical_notes_updated: "auditActionVisitUpdated", visit_completed: "auditActionVisitCompleted", billing_handoff_created: "auditActionBillingHandoffCreated", billing_handoff_converted_to_invoice: "auditActionBillingHandoffConverted", billing_handoff_dismissed: "auditActionBillingHandoffDismissed", invoice_created: "auditActionInvoiceCreated", invoice_updated: "auditActionInvoiceUpdated", invoice_cancelled: "auditActionInvoiceCancelled", payment_recorded: "auditActionPaymentRecorded", xray_uploaded: "auditActionXrayUploaded", xray_ai_run: "auditActionXrayAiRun", external_xray_uploaded: "auditActionExternalXrayUploaded", external_xray_ai_run: "auditActionExternalXrayAiRun", external_xray_attached_to_patient: "auditActionExternalXrayAttached", external_xray_discarded: "auditActionExternalXrayDiscarded", user_created: "auditActionUserCreated", user_deactivated: "auditActionUserDeactivated", user_reactivated: "auditActionUserReactivated", user_password_reset: "auditActionUserPasswordReset", user_role_transitioned: "auditActionUserRoleChanged", user_updated: "auditActionUserUpdated", schedule_updated: "auditActionScheduleUpdated", leave_created: "auditActionLeaveCreated", leave_updated: "auditActionLeaveUpdated", leave_cancelled: "auditActionLeaveCancelled",
};
const knownEntities: Record<string, FeatureMessageKey> = { clinic_settings: "auditEntityClinicSettings", patient: "auditEntityPatient", appointment: "auditEntityAppointment", visit: "auditEntityVisit", billing_handoff: "auditEntityBillingHandoff", invoice: "auditEntityInvoice", payment: "auditEntityPayment", xray: "auditEntityXray", external_xray: "auditEntityExternalXray", user: "auditEntityUser", team_member: "auditEntityTeamMember", schedule: "auditEntitySchedule", leave: "auditEntityLeave" };
const secretKey = /password|temporary_password|token|access|refresh|authorization|secret|api_key/i;

function readFilters(params: URLSearchParams): AuditFilters { return { page: Number(params.get("page") || "1"), actor_id: params.get("actor_id") || undefined, actor_role: params.get("actor_role") || undefined, action: params.get("action") || undefined, entity_type: params.get("entity_type") || undefined, entity_id: params.get("entity_id") || undefined, created_from: params.get("created_from") || undefined, created_to: params.get("created_to") || undefined }; }
function humanize(value: string) { return value.split(/[_-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function actionLabel(value: string, t: ReturnType<typeof useFeatureT>) { return knownActions[value] ? t(knownActions[value]) : humanize(value); }
function entityLabel(value: string, t: ReturnType<typeof useFeatureT>) { return knownEntities[value] ? t(knownEntities[value]) : humanize(value); }
function roleLabel(value: string, t: ReturnType<typeof useFeatureT>) { const key: Record<string, FeatureMessageKey> = { ADMIN: "auditRoleAdmin", STAFF: "auditRoleStaff", DOCTOR: "auditRoleDoctor" }; return key[value] ? t(key[value]) : humanize(value); }
function actorLabel(actor: { full_name: string; email: string }) { return `${actor.full_name} (${actor.email})`; }

function MetadataValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const t = useFeatureT();
  if (depth >= 4) return <span className="metadata-value">{t("auditMetadataTruncated")}</span>;
  if (value === null) return <bdi className="metadata-value">{t("auditNull")}</bdi>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <bdi className="metadata-value">{String(value).slice(0, 500)}</bdi>;
  if (Array.isArray(value)) return <ul className="metadata-tree">{value.slice(0, 20).map((item, index) => <li key={index}><MetadataValue value={item} depth={depth + 1} /></li>)}</ul>;
  if (typeof value === "object") return <dl className="metadata-tree">{Object.entries(value).slice(0, 30).map(([key, item]) => <div key={key}><dt>{humanize(key)}</dt><dd>{secretKey.test(key) ? <span>{t("redacted")}</span> : <MetadataValue value={item} depth={depth + 1} />}</dd></div>)}</dl>;
  return <span className="metadata-value">{t("unknown")}</span>;
}

function AuditFiltersPanel({ filters, setFilter }: { filters: AuditFilters; setFilter: (key: Exclude<keyof AuditFilters, "page">, value: string) => void }) {
  const t = useFeatureT();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search), 300); return () => window.clearTimeout(timer); }, [search]);
  const actors = useQuery({ queryKey: ["audit-actors", debouncedSearch], queryFn: () => usersApi.list({ search: debouncedSearch, page: 1 }), enabled: Boolean(debouncedSearch) });
  const selectedActor = useQuery({ queryKey: ["audit-actor", filters.actor_id], queryFn: () => usersApi.detail(Number(filters.actor_id)), enabled: Boolean(filters.actor_id) });
  const options = useMemo(() => {
    const rows = actors.data?.results ?? [];
    const selected = selectedActor.data;
    const items = selected && !rows.some((row) => row.id === selected.id) ? [selected, ...rows] : rows;
    return items.map((actor) => ({ value: String(actor.id), label: actorLabel(actor) }));
  }, [actors.data?.results, selectedActor.data]);
  return <section className="audit-filter-rail" aria-label={t("auditFilters")}>
    <div className="audit-filter-heading"><h3>{t("auditFilters")}</h3><p>{t("readOnly")}</p></div>
    <Combobox label={t("actor")} value={filters.actor_id ?? ""} onChange={(value) => setFilter("actor_id", value)} onQueryChange={setSearch} options={options} placeholder={t("auditActorSearchPlaceholder")} />
    <SelectField label={t("actorRole")} value={filters.actor_role ?? ""} onChange={(event) => setFilter("actor_role", event.target.value)}><option value="">{t("allRoles")}</option><option value="ADMIN">{roleLabel("ADMIN", t)}</option><option value="STAFF">{roleLabel("STAFF", t)}</option><option value="DOCTOR">{roleLabel("DOCTOR", t)}</option></SelectField>
    <Field label={t("action")} value={filters.action ?? ""} onChange={(event) => setFilter("action", event.target.value)} />
    <Field label={t("entityType")} value={filters.entity_type ?? ""} onChange={(event) => setFilter("entity_type", event.target.value)} />
    <Field label={t("entityId")} help={t("auditExactIdentifier")} value={filters.entity_id ?? ""} onChange={(event) => setFilter("entity_id", event.target.value)} />
    <Field label={t("createdFrom")} type="datetime-local" value={filters.created_from ?? ""} onChange={(event) => setFilter("created_from", event.target.value)} />
    <Field label={t("createdTo")} type="datetime-local" value={filters.created_to ?? ""} onChange={(event) => setFilter("created_to", event.target.value)} />
  </section>;
}

export function AdminAuditLogListPage() {
  const t = useFeatureT(); const navigate = useNavigate(); const [params, setParams] = useSearchParams(); const filters = readFilters(params);
  const audit = useQuery({ queryKey: ["audit-logs", filters], queryFn: () => auditApi.list(filters) });
  const setFilter = (key: Exclude<keyof AuditFilters, "page">, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); next.set("page", "1"); setParams(next); };
  const clear = () => setParams({});
  const open = (item: AuditLog) => navigate(`/admin/audit-logs/${item.id}${params.toString() ? `?${params.toString()}` : ""}`);
  return <div className="admin-page audit-log-page"><PageHeaderV2 title={t("auditLogs")} /><SurfaceCard major className="audit-register-shell"><AuditFiltersPanel filters={filters} setFilter={setFilter} /><div className="audit-register-actions"><span className="audit-readonly-label">{t("readOnly")}</span><Button type="button" variant="secondary" onClick={clear}>{t("clearFilters")}</Button></div>{audit.isLoading ? <StatePanel state="loading" title={t("auditLogs")} /> : null}{audit.isError ? <StatePanel state="error" title={t("auditUnavailable")} description={getErrorMessage(audit.error)} action={<Button type="button" onClick={() => void audit.refetch()}>{t("retry")}</Button>} /> : null}{audit.isFetching && audit.data ? <p role="status">{t("auditRefreshing")}</p> : null}{audit.data ? <DataTableShell title={t("auditRecords")} count={audit.data.count} state={!audit.data.results.length ? <StatePanel state="empty" title={t("noAuditLogs")} /> : undefined}><table className="audit-register-table"><thead><tr><th>{t("occurred")}</th><th>{t("actor")}</th><th>{t("actorRole")}</th><th>{t("action")}</th><th>{t("entityType")}</th><th>{t("entityId")}</th></tr></thead><tbody>{audit.data.results.map((item) => <ClickableRow key={item.id} ariaLabel={`${actionLabel(item.action, t)} ${entityLabel(item.entity_type, t)}`} onOpen={() => open(item)}><td className="bidi-isolate audit-occurred">{formatDateTime(item.created_at)}</td><td>{item.actor ? <bdi>{actorLabel(item.actor)}</bdi> : t("system")}</td><td>{item.actor_role ? roleLabel(item.actor_role, t) : t("system")}</td><td><strong className="audit-action">{actionLabel(item.action, t)}</strong></td><td><span className="audit-entity">{entityLabel(item.entity_type, t)}</span></td><td><bdi>{item.entity_id}</bdi></td></ClickableRow>)}</tbody></table></DataTableShell> : null}{audit.data ? <Pagination page={filters.page} hasPrevious={Boolean(audit.data.previous)} hasNext={Boolean(audit.data.next)} onPrevious={() => setParams({ ...Object.fromEntries(params), page: String(filters.page - 1) })} onNext={() => setParams({ ...Object.fromEntries(params), page: String(filters.page + 1) })} /> : null}</SurfaceCard></div>;
}

export function AdminAuditLogDetailPage() {
  const t = useFeatureT(); const id = Number(useParams().auditLogId); const [params] = useSearchParams(); const log = useQuery({ queryKey: ["audit-log", id], queryFn: () => auditApi.detail(id), enabled: id > 0 });
  if (log.isLoading) return <StatePanel state="loading" title={t("auditRecord")} />;
  if (log.isError) return <StatePanel state="error" title={t("auditRecordUnavailable")} description={getErrorMessage(log.error)} action={<Button type="button" onClick={() => void log.refetch()}>{t("retry")}</Button>} />;
  if (!log.data) return <StatePanel state="notFound" title={t("notFound")} />;
  const item = log.data;
  return <div className="admin-page audit-detail-page"><Link className="inline-back-link" to={`/admin/audit-logs${params.toString() ? `?${params.toString()}` : ""}`}>{t("backToAudit")}</Link><PageHeaderV2 title={t("auditRecord")} /><SurfaceCard major><div className="audit-detail-readonly">{t("readOnly")}</div><dl className="detail-grid"><div><dt>{t("occurred")}</dt><dd className="bidi-isolate">{formatDateTime(item.created_at)}</dd></div><div><dt>{t("actor")}</dt><dd>{item.actor ? <bdi>{actorLabel(item.actor)}</bdi> : t("system")}</dd></div><div><dt>{t("actorRole")}</dt><dd>{item.actor_role ? roleLabel(item.actor_role, t) : t("system")}</dd></div><div><dt>{t("action")}</dt><dd>{actionLabel(item.action, t)}</dd></div><div><dt>{t("entityType")}</dt><dd>{entityLabel(item.entity_type, t)}</dd></div><div><dt>{t("entityId")}</dt><dd className="bidi-isolate">{item.entity_id}</dd></div>{item.ip_address ? <div><dt>{t("auditIpAddress")}</dt><dd className="bidi-isolate">{item.ip_address}</dd></div> : null}</dl><SectionHeading title={t("metadata")} />{Object.keys(item.metadata_json).length ? <MetadataValue value={item.metadata_json} /> : <p>{t("metadataEmpty")}</p>}</SurfaceCard></div>;
}
