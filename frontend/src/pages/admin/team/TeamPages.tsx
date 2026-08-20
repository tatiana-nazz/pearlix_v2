import { CalendarDays, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clinicApi, clinicSettingsQueryKey } from "../../../api/endpoints/clinic";
import { teamApi, teamQueryKeys } from "../../../api/endpoints/team";
import { useAuthStore } from "../../../auth/authStore";
import { Button, ConfirmDialog, Field, FormSection, PageHeaderV2, Pagination, SelectField, StatePanel, StatusBadge, StickyActionBar, SurfaceCard } from "../../../components/v2";
import { LeaveExceptionsTable } from "../../../features/schedule/components/LeaveExceptionsTable";
import { ScheduleMatrix } from "../../../features/schedule/components/ScheduleMatrix";
import { scheduleSummaryText } from "../../../features/schedule/utils/scheduleMatrix";
import { localizedEnum, teamUsersCopy } from "../../../features/teamUsers/i18n";
import type { TeamMemberCreatePayload, TeamMemberDetail, TeamMemberUpdatePayload } from "../../../types/team";

type ApiProblem = { message?: string; details?: Record<string, string[] | string> };
const problem = (error: unknown): ApiProblem => typeof error === "object" && error !== null ? error as ApiProblem : {};
const errorText = (error: unknown, field?: string) => {
  const data = problem(error);
  const value = field ? data.details?.[field] : data.message;
  return Array.isArray(value) ? value.join(" ") : value;
};
const invalidate = (client: ReturnType<typeof useQueryClient>) => Promise.all([
  client.invalidateQueries({ queryKey: teamQueryKeys.all }),
  client.invalidateQueries({ queryKey: ["users"] }),
]);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "P";
}
function keyboardOpen(event: React.KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
}

export function TeamListPage() {
  const navigate = useNavigate();
  const currentRole = useAuthStore((state) => state.role);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const isAdmin = currentRole === "ADMIN";
  const basePath = isAdmin ? "/admin/team" : "/staff/team";
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [professionalStatus, setProfessionalStatus] = useState("");
  const [availability, setAvailability] = useState("");
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  const query = useQuery({
    queryKey: [...teamQueryKeys.all, { page, q, role, professionalStatus, availability }],
    queryFn: () => teamApi.list({ page, ...(q ? { q } : {}), ...(role ? { role } : {}), ...(professionalStatus ? { professional_status: professionalStatus } : {}), ...(availability ? { availability } : {}) }),
  });
  const clear = () => { setPage(1); setQ(""); setRole(""); setProfessionalStatus(""); setAvailability(""); };
  const loaded = query.data?.results ?? [];

  return <div className="admin-page team-directory-page">
    <PageHeaderV2 title={c.team} description={isAdmin ? c.teamDescription : c.readOnlyDirectory} action={isAdmin ? <Link className="v2-button" to="/admin/team/new">{c.addTeamMember}</Link> : undefined} />
    {query.data ? <section className="team-summary-strip" aria-label={c.teamSummary}>
      <div><span>{c.teamMembers}</span><strong>{query.data.count}</strong></div>
      <div><span>{c.doctorsOnPage}</span><strong>{loaded.filter((member) => member.role === "DOCTOR").length}</strong></div>
      <div><span>{c.availableOnPage}</span><strong>{loaded.filter((member) => member.availability.availability === "AVAILABLE").length}</strong></div>
    </section> : null}
    <SurfaceCard className="compact-toolbar-card team-filter-toolbar">
      <div className="v2-form-grid">
        <Field label={c.search} value={q} onChange={(event) => { setPage(1); setQ(event.target.value); }} placeholder={c.searchPlaceholder} />
        <SelectField label={c.role} value={role} onChange={(event) => { setPage(1); setRole(event.target.value); }}><option value="">{c.allRoles}</option><option value="DOCTOR">{c.doctor}</option><option value="STAFF">{c.staff}</option></SelectField>
        <SelectField label={c.professionalStatus} value={professionalStatus} onChange={(event) => { setPage(1); setProfessionalStatus(event.target.value); }}><option value="">{c.allStatuses}</option><option value="ACTIVE">{c.active}</option><option value="INACTIVE">{c.inactive}</option></SelectField>
        <SelectField label={c.availability} value={availability} onChange={(event) => { setPage(1); setAvailability(event.target.value); }}><option value="">{c.allAvailability}</option><option value="AVAILABLE">{c.available}</option><option value="ON_LEAVE">{c.onLeave}</option><option value="UNAVAILABLE">{c.unavailable}</option></SelectField>
      </div>
      <Button type="button" compact variant="secondary" onClick={clear}>{c.clearFilters}</Button>
    </SurfaceCard>
    {query.isLoading ? <StatePanel state="loading" title={c.loadingTeam} /> : null}
    {query.isError && !query.data ? <StatePanel state="error" title={c.teamUnavailable} action={<Button type="button" onClick={() => void query.refetch()}>{c.retry}</Button>} /> : null}
    {query.data ? loaded.length ? <section className="team-directory-grid" aria-label={c.teamMembers}>{loaded.map((member) => {
      const open = () => navigate(`${basePath}/${member.id}`);
      const professionalLabel = member.role === "DOCTOR" ? member.specialty || c.noSpecialty : member.position || c.noPosition;
      return <article key={member.id} className="team-directory-card" role="link" tabIndex={0} aria-label={`${member.full_name}, ${localizedEnum(language, member.role)}`} onClick={open} onKeyDown={(event) => keyboardOpen(event, open)}>
        <div className="team-card-avatar" aria-hidden="true">{initials(member.full_name)}</div>
        <div className="team-card-identity"><h3>{member.full_name}</h3><div><span className="team-role-chip">{localizedEnum(language, member.role)}</span><span className="team-specialty-chip">{professionalLabel}</span></div></div>
        <dl className="team-card-contact"><div><dt><Mail size={16} aria-hidden="true" /></dt><dd dir="ltr">{member.email}</dd></div><div><dt><Phone size={16} aria-hidden="true" /></dt><dd dir="ltr">{member.phone || "—"}</dd></div><div><dt><CalendarDays size={16} aria-hidden="true" /></dt><dd>{scheduleSummaryText(member.schedule_summary, language, clinicSettings.data?.weekly_closed_days)}</dd></div></dl>
        <footer className="team-card-footer"><div><span>{c.professionalStatus}</span><StatusBadge status={member.professional_status} label={localizedEnum(language, member.professional_status)} /></div><div><span>{c.availability}</span><StatusBadge status={member.availability.availability} label={localizedEnum(language, member.availability.availability)} /></div><div><span>{c.appointments}</span><strong>{member.today_workload.appointment_count}</strong></div>{member.role === "DOCTOR" ? <div><span>{c.activeVisits}</span><strong>{member.today_workload.active_visit_count}</strong></div> : null}</footer>
      </article>;
    })}</section> : <StatePanel state="empty" title={c.noTeamMembers} /> : null}
    {query.data ? <Pagination page={page} hasPrevious={Boolean(query.data.previous)} hasNext={Boolean(query.data.next)} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} labels={{ page: c.page, previous: c.previous, next: c.next }} /> : null}
  </div>;
}

export function TeamNewPage() {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const client = useQueryClient();
  const [role, setRole] = useState<"DOCTOR" | "STAFF">("DOCTOR");
  const [values, setValues] = useState({ full_name: "", email: "", temporary_password: "", specialty: "", position: "", phone: "", bio: "" });
  const mutation = useMutation({ mutationFn: teamApi.create, onSuccess: async (member) => { await invalidate(client); navigate(`/admin/team/${member.id}`); } });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const account = { full_name: values.full_name, email: values.email, temporary_password: values.temporary_password };
    const payload: TeamMemberCreatePayload = role === "DOCTOR"
      ? { account, role, doctor_profile: { specialty: values.specialty, phone: values.phone, bio: values.bio } }
      : { account, role, staff_profile: { position: values.position, phone: values.phone } };
    mutation.mutate(payload);
  };
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((current) => ({ ...current, [key]: event.target.value }));

  return <div className="admin-page">
    <PageHeaderV2 title={c.addTitle} description={c.addDescription} />
    <SurfaceCard major><form onSubmit={submit}>
      <FormSection title={c.accountSection}><Field label={c.fullName} required value={values.full_name} error={errorText(mutation.error, "account") || errorText(mutation.error, "full_name")} onChange={set("full_name")} /><Field label={c.email} type="email" required value={values.email} error={errorText(mutation.error, "email")} onChange={set("email")} /><Field label={c.temporaryPassword} type="password" required value={values.temporary_password} error={errorText(mutation.error, "temporary_password")} onChange={set("temporary_password")} /></FormSection>
      <FormSection title={c.professionalProfile}><SelectField label={c.role} value={role} onChange={(event) => setRole(event.target.value as "DOCTOR" | "STAFF")}><option value="DOCTOR">{c.doctor}</option><option value="STAFF">{c.staff}</option></SelectField>{role === "DOCTOR" ? <><Field label={c.specialty} value={values.specialty} error={errorText(mutation.error, "doctor_profile")} onChange={set("specialty")} /><Field label={c.phone} value={values.phone} onChange={set("phone")} /><label className="v2-field">{c.bio}<textarea value={values.bio} onChange={set("bio")} /></label></> : <><Field label={c.position} value={values.position} error={errorText(mutation.error, "staff_profile")} onChange={set("position")} /><Field label={c.phone} value={values.phone} onChange={set("phone")} /></>}</FormSection>
      {errorText(mutation.error) ? <StatePanel state="error" title={errorText(mutation.error) ?? c.unableCreateTeam} /> : null}
      <StickyActionBar><Button type="submit" loading={mutation.isPending}>{c.createTeamMember}</Button></StickyActionBar>
    </form></SurfaceCard>
  </div>;
}

function TeamProfileForm({ member, onCancel, onSaved }: { member: TeamMemberDetail; onCancel: () => void; onSaved: () => void }) {
  const client = useQueryClient();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const id = member.id;
  const [values, setValues] = useState({ specialty: "specialty" in member.profile ? member.profile.specialty : "", position: "position" in member.profile ? member.profile.position : "", phone: member.profile.phone, bio: "bio" in member.profile ? member.profile.bio : "" });
  const [conflict, setConflict] = useState(false);
  const mutation = useMutation({
    mutationFn: (payload: TeamMemberUpdatePayload) => teamApi.update(id, payload),
    onSuccess: async () => {
      setConflict(false);
      await Promise.all([client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }), invalidate(client)]);
      onSaved();
    },
    onError: (error) => { if (problem(error).message?.toLowerCase().includes("changed")) setConflict(true); },
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const version = member.version ?? 0;
    mutation.mutate(member.role === "DOCTOR" ? { specialty: values.specialty, phone: values.phone, bio: values.bio, version } : { position: values.position, phone: values.phone, version });
  };

  return <SurfaceCard className="professional-edit-card">
    <form onSubmit={submit}>
      <FormSection title={c.editProfessionalProfile}>
        <p className="section-support">{c.editProfessionalDescription}</p>
        {member.role === "DOCTOR" ? <><Field label={c.specialty} value={values.specialty} error={errorText(mutation.error, "specialty")} onChange={(event) => setValues((current) => ({ ...current, specialty: event.target.value }))} /><Field label={c.phone} value={values.phone} error={errorText(mutation.error, "phone")} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} /><label className="v2-field">{c.bio}<textarea value={values.bio} aria-invalid={Boolean(errorText(mutation.error, "bio"))} onChange={(event) => setValues((current) => ({ ...current, bio: event.target.value }))} />{errorText(mutation.error, "bio") ? <span className="v2-field-error" role="alert">{errorText(mutation.error, "bio")}</span> : null}</label></> : <><Field label={c.position} value={values.position} error={errorText(mutation.error, "position")} onChange={(event) => setValues((current) => ({ ...current, position: event.target.value }))} /><Field label={c.phone} value={values.phone} error={errorText(mutation.error, "phone")} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} /></>}
      </FormSection>
      {conflict ? <StatePanel state="locked" title={c.profileChanged} action={<Button type="button" variant="secondary" onClick={() => { setConflict(false); void client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }); }}>{c.reloadLatest}</Button>} /> : null}
      {errorText(mutation.error) && !conflict ? <StatePanel state="error" title={errorText(mutation.error) ?? c.unableUpdateProfile} /> : null}
      <StickyActionBar><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={onCancel}>{c.cancel}</Button><Button type="submit" loading={mutation.isPending}>{c.saveChanges}</Button></StickyActionBar>
    </form>
  </SurfaceCard>;
}

export function TeamDetailPage() {
  const navigate = useNavigate();
  const currentRole = useAuthStore((state) => state.role);
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const isAdmin = currentRole === "ADMIN";
  const basePath = isAdmin ? "/admin/team" : "/staff/team";
  const id = Number(useParams().teamMemberId);
  const client = useQueryClient();
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const query = useQuery({ queryKey: teamQueryKeys.detail(id), queryFn: () => teamApi.detail(id), enabled: id > 0 });
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, staleTime: 300_000 });
  const status = useMutation({ mutationFn: (active: boolean) => teamApi.setProfessionalStatus(id, { is_active: active, version: query.data?.version ?? 0 }), onSuccess: async () => { setConfirmStatus(false); await Promise.all([client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }), invalidate(client)]); } });

  if (query.isLoading) return <StatePanel state="loading" title={c.loadingTeam} />;
  if (query.isError || !query.data) return <StatePanel state="notFound" title={c.teamUnavailable} action={<Button type="button" onClick={() => navigate(basePath)}>{c.backToTeam}</Button>} />;
  const member = query.data;
  const professionalLabel = member.role === "DOCTOR" ? member.specialty || c.noSpecialty : member.position || c.noPosition;

  return <div className="admin-page team-detail-page">
    <header className="team-profile-header">
      <div><h2>{member.full_name}</h2><p>{localizedEnum(language, member.role)} · {professionalLabel}</p></div>
      <div className="team-profile-header-actions"><div><StatusBadge status={member.professional_status} label={localizedEnum(language, member.professional_status)} /><StatusBadge status={member.availability.availability} label={localizedEnum(language, member.availability.availability)} /></div>{isAdmin && member.account ? <Link className="v2-button secondary" to={`/admin/users/${member.account.id}`}>{c.openUsers}</Link> : null}{isAdmin && !editing ? <Button type="button" onClick={() => { setSaved(false); setEditing(true); }}>{c.editProfessionalProfile}</Button> : null}</div>
    </header>
    {saved ? <p className="inline-success profile-save-success" role="status">{c.professionalChangesSaved}</p> : null}
    <div className="team-detail-upper-grid">
      {editing ? <TeamProfileForm key={`${member.id}-${member.version}`} member={member} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); setSaved(true); }} /> : <SurfaceCard className="professional-read-card"><h3>{c.professionalInformation}</h3><dl className="detail-list"><div><dt>{member.role === "DOCTOR" ? c.specialty : c.position}</dt><dd>{professionalLabel}</dd></div>{member.role === "DOCTOR" ? <div><dt>{c.biography}</dt><dd>{"bio" in member.profile && member.profile.bio ? member.profile.bio : c.notProvided}</dd></div> : null}</dl></SurfaceCard>}
      <SurfaceCard className="team-contact-card"><h3>{c.contact}</h3><dl className="detail-list"><div><dt>{c.email}</dt><dd dir="ltr">{member.email}</dd></div><div><dt>{c.phone}</dt><dd dir="ltr">{member.phone || c.notProvided}</dd></div></dl></SurfaceCard>
      <SurfaceCard className="team-workload-card"><h3>{c.todayWorkload}</h3><dl className="workload-grid"><div><dt>{c.appointments}</dt><dd>{member.today_workload.appointment_count}</dd></div>{member.role === "DOCTOR" ? <div><dt>{c.activeVisits}</dt><dd>{member.today_workload.active_visit_count}</dd></div> : null}<div><dt>{c.availability}</dt><dd><StatusBadge status={member.availability.availability} label={localizedEnum(language, member.availability.availability)} /></dd></div></dl></SurfaceCard>
      <SurfaceCard className="professional-status-card"><h3>{c.professionalStatus}</h3><StatusBadge status={member.professional_status} label={localizedEnum(language, member.professional_status)} /><p>{c.professionalStatusDescription}</p>{isAdmin ? <Button type="button" variant={member.professional_status === "ACTIVE" ? "danger" : "secondary"} onClick={() => setConfirmStatus(true)}>{member.professional_status === "ACTIVE" ? c.deactivateProfessional : c.reactivateProfessional}</Button> : null}</SurfaceCard>
    </div>
    <div className="team-schedule-grid">
      <SurfaceCard className="team-schedule-card"><h3>{c.schedule}</h3><ScheduleMatrix shifts={member.active_shifts} language={language} emptyText={c.noWorkingHours} weeklyClosedDays={clinicSettings.data?.weekly_closed_days} /></SurfaceCard>
      <SurfaceCard className="team-leave-card"><h3>{c.leaveAvailability}</h3><LeaveExceptionsTable items={member.current_future_leave} language={language} emptyText={c.noLeave} noReason={c.noReasonRecorded} /></SurfaceCard>
    </div>
    {isAdmin ? <ConfirmDialog open={confirmStatus} title={c.confirmProfessionalStatus} description={c.professionalStatusDescription} pending={status.isPending} onClose={() => { setConfirmStatus(false); status.reset(); }}>
      <p>{member.professional_status === "ACTIVE" ? c.deactivateProfessionalQuestion : c.reactivateProfessionalQuestion}</p>
      {status.error ? <StatePanel state="error" title={errorText(status.error) ?? c.teamUnavailable} /> : null}
      <div className="dialog-actions"><Button variant={member.professional_status === "ACTIVE" ? "danger" : "primary"} loading={status.isPending} onClick={() => status.mutate(member.professional_status !== "ACTIVE")}>{c.confirm}</Button><Button variant="secondary" disabled={status.isPending} onClick={() => { setConfirmStatus(false); status.reset(); }}>{c.cancel}</Button></div>
    </ConfirmDialog> : null}
  </div>;
}
