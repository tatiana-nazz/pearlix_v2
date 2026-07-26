import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "../../api/endpoints/audit";
import { clinicApi } from "../../api/endpoints/clinic";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { PageHeader } from "../../components/PageHeader";
import { StatusPill } from "../../components/StatusPill";
import type { AiMode, ClinicSettings, Currency, Language } from "../../types/clinic";

const durationOptions = [15, 30, 45, 60, 90];
const timezoneOptions = ["Asia/Damascus", "UTC", "Europe/London", "America/New_York"];

export function AdminClinicSettingsPage() {
  const settings = useQuery({ queryKey: ["clinic-settings"], queryFn: clinicApi.getSettings });
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: clinicApi.updateSettings, onSuccess: () => void client.invalidateQueries({ queryKey: ["clinic-settings"] }) });
  const [values, setValues] = useState<ClinicSettings | null>(null);
  if (settings.isLoading) return <LoadingState title="Loading clinic settings..." />;
  if (settings.isError || !settings.data || !("ai_mode" in settings.data)) return <ErrorState error={settings.error} title="Settings unavailable" />;
  const data: ClinicSettings = values ?? settings.data;
  const update = <K extends keyof ClinicSettings>(key: K, value: ClinicSettings[K]) => setValues({ ...data, [key]: value });
  const toggleDuration = (duration: number) => {
    const allowed = data.allowed_durations_minutes.includes(duration)
      ? data.allowed_durations_minutes.filter((item) => item !== duration)
      : [...data.allowed_durations_minutes, duration].sort((a, b) => a - b);
    if (allowed.length) update("allowed_durations_minutes", allowed);
  };
  const toggleCurrency = (currency: Currency) => {
    const supported = data.supported_currencies.includes(currency)
      ? data.supported_currencies.filter((item) => item !== currency)
      : [...data.supported_currencies, currency];
    if (supported.length && supported.includes(data.default_currency)) update("supported_currencies", supported);
  };

  return (
    <div className="admin-page">
      <PageHeader eyebrow="admin workspace" title="Clinic Settings" description="Manage clinic identity, scheduling defaults, locale, and operational integrations." />
      <form className="clinic-settings-form" onSubmit={(event) => { event.preventDefault(); mutation.mutate(data); }}>
        <div className="clinic-settings-grid">
          <Card className="clinic-settings-card">
            <h2>Clinic identity</h2><p>Patient-facing name and contact information.</p>
            <div className="settings-field-grid">
              <label>Clinic name<input value={data.clinic_name} onChange={(event) => update("clinic_name", event.target.value)} /></label>
              <label>Phone<input dir="ltr" value={data.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label>Email<input dir="ltr" type="email" value={data.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label className="settings-field-wide">Address<textarea rows={3} value={data.address} onChange={(event) => update("address", event.target.value)} /></label>
            </div>
          </Card>
          <Card className="clinic-settings-card">
            <h2>Scheduling defaults</h2><p>Slot capacity and appointment duration choices.</p>
            <div className="settings-field-grid">
              <label>Capacity per slot<input type="number" min={1} value={data.capacity_per_slot} onChange={(event) => update("capacity_per_slot", Number(event.target.value))} /></label>
              <label>Default duration<select value={data.default_appointment_duration_minutes} onChange={(event) => update("default_appointment_duration_minutes", Number(event.target.value))}>{data.allowed_durations_minutes.map((duration) => <option key={duration} value={duration}>{duration} minutes</option>)}</select></label>
              <fieldset className="settings-field-wide settings-options"><legend>Allowed durations</legend>{durationOptions.map((duration) => <label key={duration}><input type="checkbox" checked={data.allowed_durations_minutes.includes(duration)} disabled={duration === data.default_appointment_duration_minutes} onChange={() => toggleDuration(duration)} />{duration} min</label>)}</fieldset>
            </div>
          </Card>
          <Card className="clinic-settings-card">
            <h2>Locale and currency</h2><p>Defaults used throughout the clinic workspace.</p>
            <div className="settings-field-grid">
              <label>Timezone<select value={data.timezone} onChange={(event) => update("timezone", event.target.value)}>{[...new Set([data.timezone, ...timezoneOptions])].map((timezone) => <option key={timezone}>{timezone}</option>)}</select></label>
              <label>Default language<select value={data.default_language} onChange={(event) => update("default_language", event.target.value as Language)}><option value="EN">English</option><option value="AR">Arabic</option></select></label>
              <label>Default currency<select value={data.default_currency} onChange={(event) => update("default_currency", event.target.value as Currency)}>{data.supported_currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></label>
              <fieldset className="settings-options"><legend>Supported currencies</legend>{(["SYP", "USD"] as Currency[]).map((currency) => <label key={currency}><input type="checkbox" checked={data.supported_currencies.includes(currency)} onChange={() => toggleCurrency(currency)} />{currency}</label>)}</fieldset>
            </div>
          </Card>
          <Card className="clinic-settings-card">
            <h2>AI operations</h2><p>Admin-only service mode and integration endpoint.</p>
            <div className="settings-field-grid">
              <label>AI mode<select value={data.ai_mode} onChange={(event) => update("ai_mode", event.target.value as AiMode)}><option value="MOCK_ADAPTER">Mock adapter</option><option value="DJANGO_INTERNAL">Django internal</option><option value="SEPARATE_SERVICE">Separate service</option></select></label>
              <label className="settings-field-wide">Service URL<input dir="ltr" type="url" value={data.ai_service_url} onChange={(event) => update("ai_service_url", event.target.value)} /></label>
            </div>
          </Card>
        </div>
        {mutation.error ? <ErrorState error={mutation.error} title="Unable to update settings" /> : null}
        <div className="clinic-settings-actions"><span>{mutation.isSuccess ? "Settings saved." : "Changes apply across the clinic workspace."}</span><button className="button primary" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save settings"}</button></div>
      </form>
    </div>
  );
}

function safeMetadata(value: unknown): string { if (!value || typeof value !== "object") return "No metadata"; return JSON.stringify(value, (key, current) => /password|token|secret|authorization|refresh|access/i.test(key) ? "[redacted]" : current, 2); }
export function AdminAuditLogListPage() { const [page, setPage] = useState(1); const navigate = useNavigate(); const audit = useQuery({ queryKey: ["audit-logs", page], queryFn: () => auditApi.list({ page }) }); return <div className="admin-page"><PageHeader eyebrow="admin workspace" title="Audit Logs" description="Read-only, backend-sanitized operational history." />{audit.isLoading ? <LoadingState title="Loading audit logs..." /> : null}{audit.isError ? <ErrorState error={audit.error} title="Audit logs unavailable" onRetry={() => void audit.refetch()} /> : null}{audit.data ? <><Card><div className="table-scroll"><table className="billing-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>{audit.data.results.map((log) => <tr key={log.id} className="clickable-row" tabIndex={0} onClick={() => navigate(`/admin/audit-logs/${log.id}`)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/admin/audit-logs/${log.id}`); } }}><td>{log.created_at}</td><td>{log.actor?.full_name ?? "System"}</td><td>{log.action}</td><td>{log.entity_type} #{log.entity_id}</td></tr>)}</tbody></table></div></Card><div className="pagination-bar"><button className="button secondary" disabled={!audit.data.previous} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button className="button secondary" disabled={!audit.data.next} onClick={() => setPage(page + 1)}>Next</button></div></> : null}</div>; }
export function AdminAuditLogDetailPage() { const log = useQuery({ queryKey: ["audit-log", Number(useParams().auditLogId)], queryFn: () => auditApi.detail(Number(useParams().auditLogId)) }); if (log.isLoading) return <LoadingState title="Loading audit record..." />; if (log.isError || !log.data) return <ErrorState error={log.error} title="Audit record unavailable" />; return <div className="admin-page"><PageHeader eyebrow="admin workspace" title="Audit Record" description="Read-only sanitized metadata." /><Card><dl className="detail-grid"><div><dt>Time</dt><dd>{log.data.created_at}</dd></div><div><dt>Actor</dt><dd>{log.data.actor?.full_name ?? "System"}</dd></div><div><dt>Action</dt><dd>{log.data.action}</dd></div><div><dt>Entity</dt><dd>{log.data.entity_type} #{log.data.entity_id}</dd></div><div className="detail-wide"><dt>Metadata</dt><dd><pre className="print-data">{safeMetadata(log.data.metadata_json)}</pre></dd></div></dl></Card></div>; }
