import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { teamApi, teamQueryKeys } from "../../../api/endpoints/team";
import { usersApi } from "../../../api/endpoints/users";
import { useAuthStore } from "../../../auth/authStore";
import {
  Button,
  ClickableRow,
  ConfirmDialog,
  DataTableShell,
  Field,
  FormSection,
  PageHeaderV2,
  Pagination,
  SelectField,
  StatePanel,
  StatusBadge,
  StickyActionBar,
  SurfaceCard,
} from "../../../components/v2";
import { effectiveAccessForRole, type EffectiveAccessCategory, type EffectiveAccessLevel } from "../../../features/teamUsers/effectiveAccess";
import { localizedConsequence, localizedEnum, teamUsersCopy } from "../../../features/teamUsers/i18n";
import type { RoleTransitionPreview, TeamMemberDetail } from "../../../types/team";
import type { UserManagementRecord, UserUpdatePayload } from "../../../types/users";

type ApiProblem = { message?: string; details?: Record<string, string[] | string> };
type Copy = ReturnType<typeof teamUsersCopy>;

const problem = (error: unknown): ApiProblem => typeof error === "object" && error !== null ? error as ApiProblem : {};
const message = (error: unknown, field?: string) => {
  const data = problem(error);
  const value = field ? data.details?.[field] : data.message;
  return Array.isArray(value) ? value.join(" ") : value;
};
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const refresh = (client: ReturnType<typeof useQueryClient>, id?: number) => Promise.all([
  client.invalidateQueries({ queryKey: ["users"] }),
  client.invalidateQueries({ queryKey: teamQueryKeys.all }),
  ...(id ? [
    client.invalidateQueries({ queryKey: ["user", id] }),
    client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }),
  ] : []),
]);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

export function AdminUserListPage() {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const users = useQuery({ queryKey: ["users", page], queryFn: () => usersApi.list({ page }) });
  const filtered = (users.data?.results ?? []).filter((user) => {
    const matchesSearch = !search || `${user.full_name} ${user.email}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!role || user.role === role) && (!status || (status === "ACTIVE") === user.is_active);
  });
  const clear = () => { setSearch(""); setRole(""); setStatus(""); };

  return <div className="admin-page users-access-page">
    <PageHeaderV2 title={c.usersAccess} description={c.usersDescription} action={<Link className="v2-button" to="/admin/users/new">{c.newAdmin}</Link>} />
    <SurfaceCard className="compact-toolbar-card users-filter-toolbar">
      <div className="v2-form-grid">
        <Field label={c.search} value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField label={c.role} value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">{c.allRoles}</option><option value="ADMIN">{c.admin}</option><option value="DOCTOR">{c.doctor}</option><option value="STAFF">{c.staff}</option>
        </SelectField>
        <SelectField label={c.loginStatus} value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">{c.allStatuses}</option><option value="ACTIVE">{c.active}</option><option value="INACTIVE">{c.inactive}</option>
        </SelectField>
      </div>
      <Button type="button" compact variant="secondary" onClick={clear}>{c.clearFilters}</Button>
      <small>{c.filtersLoadedPage}</small>
    </SurfaceCard>
    {users.isLoading ? <StatePanel state="loading" title={c.loadingAccounts} /> : null}
    {users.isError && !users.data ? <StatePanel state="error" title={c.accountsUnavailable} action={<Button type="button" onClick={() => void users.refetch()}>{c.retry}</Button>} /> : null}
    {users.data ? <>
      <DataTableShell title={c.accounts} count={users.data.count} toolbar={users.isFetching ? <span aria-live="polite">{c.refreshing}</span> : undefined}>
        {filtered.length ? <table className="users-identity-table">
          <thead><tr><th>{c.name}</th><th>{c.email}</th><th>{c.role}</th><th>{c.loginStatus}</th><th>{c.password}</th><th>{c.profile}</th><th>{c.created}</th><th /></tr></thead>
          <tbody>{filtered.map((user) => <ClickableRow key={user.id} onOpen={() => navigate(`/admin/users/${user.id}`)}>
            <td><div className="user-identity-cell"><span aria-hidden="true">{initials(user.full_name)}</span><strong>{user.full_name}</strong></div></td>
            <td dir="ltr">{user.email}</td>
            <td>{localizedEnum(language, user.role)}</td>
            <td><StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} label={user.is_active ? c.active : c.inactive} /></td>
            <td>{user.must_change_password ? c.mustChangePassword : c.passwordCurrent}</td>
            <td>{localizedEnum(language, user.linked_profile_state)}</td>
            <td>{formatDate(user.created_at)}</td>
          </ClickableRow>)}</tbody>
        </table> : <StatePanel state="empty" title={c.noAccounts} />}
      </DataTableShell>
      <Pagination page={page} hasPrevious={Boolean(users.data.previous)} hasNext={Boolean(users.data.next)} onPrevious={() => setPage((value) => value - 1)} onNext={() => setPage((value) => value + 1)} labels={{ page: c.page, previous: c.previous, next: c.next }} />
    </> : null}
  </div>;
}

export function AdminNewUserPage() {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const client = useQueryClient();
  const [values, setValues] = useState({ full_name: "", email: "", temporary_password: "" });
  const mutation = useMutation({ mutationFn: usersApi.create, onSuccess: async (user) => { await refresh(client); navigate(`/admin/users/${user.id}`); } });
  const submit = (event: React.FormEvent) => { event.preventDefault(); mutation.mutate({ ...values, role: "ADMIN" }); };

  return <div className="admin-page">
    <PageHeaderV2 title={c.newAdminTitle} description={c.newAdminDescription} />
    <SurfaceCard major><form onSubmit={submit}>
      <FormSection title={c.accountSection}>
        <Field label={c.fullName} required value={values.full_name} error={message(mutation.error, "full_name")} onChange={(event) => setValues((current) => ({ ...current, full_name: event.target.value }))} />
        <Field label={c.email} type="email" required value={values.email} error={message(mutation.error, "email")} onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))} />
        <Field label={c.temporaryPassword} type="password" required value={values.temporary_password} error={message(mutation.error, "password") || message(mutation.error, "temporary_password")} onChange={(event) => setValues((current) => ({ ...current, temporary_password: event.target.value }))} />
      </FormSection>
      {message(mutation.error) ? <StatePanel state="error" title={message(mutation.error) ?? c.unableCreateAccount} /> : null}
      <StickyActionBar><Button type="submit" loading={mutation.isPending}>{c.createAdmin}</Button></StickyActionBar>
    </form></SurfaceCard>
    <p>{c.doctorStaffTeam} <Link to="/admin/team/new">{c.addTeamMember}</Link>.</p>
  </div>;
}

function IdentityForm({ user }: { user: UserManagementRecord }) {
  const client = useQueryClient();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const [values, setValues] = useState<UserUpdatePayload>({ full_name: user.full_name, email: user.email });
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (payload: UserUpdatePayload) => usersApi.update(user.id, payload),
    onSuccess: async (changed) => {
      setValues({ full_name: changed.full_name, email: changed.email });
      setSaved(true);
      await refresh(client, user.id);
    },
  });
  const change = (field: keyof UserUpdatePayload, value: string) => {
    setSaved(false);
    mutation.reset();
    setValues((current) => ({ ...current, [field]: value }));
  };

  return <SurfaceCard className="user-identity-card">
    <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(values); }}>
      <FormSection title={c.accountIdentity}>
        <p className="section-support">{c.accountIdentityDescription}</p>
        <Field label={c.fullName} required value={values.full_name ?? ""} error={message(mutation.error, "full_name")} onChange={(event) => change("full_name", event.target.value)} />
        <Field label={c.email} type="email" required value={values.email ?? ""} error={message(mutation.error, "email")} onChange={(event) => change("email", event.target.value)} />
      </FormSection>
      {message(mutation.error) ? <StatePanel state="error" title={message(mutation.error) ?? c.unableUpdateAccount} /> : null}
      {saved ? <p className="inline-success" role="status">{c.identitySaveSuccess}</p> : null}
      <StickyActionBar><Button type="submit" loading={mutation.isPending}>{c.saveAccount}</Button></StickyActionBar>
    </form>
  </SurfaceCard>;
}

const categoryLabels: Record<EffectiveAccessCategory, keyof Pick<Copy, "patients" | "appointments" | "clinicalVisits" | "xraysAi" | "billingInvoices" | "payments" | "team" | "usersAccessCategory" | "schedulesLeave" | "clinicSettings" | "auditLogs">> = {
  PATIENTS: "patients",
  APPOINTMENTS: "appointments",
  CLINICAL_VISITS: "clinicalVisits",
  XRAYS_AI: "xraysAi",
  BILLING_INVOICES: "billingInvoices",
  PAYMENTS: "payments",
  TEAM: "team",
  USERS_ACCESS: "usersAccessCategory",
  SCHEDULES_LEAVE: "schedulesLeave",
  CLINIC_SETTINGS: "clinicSettings",
  AUDIT_LOGS: "auditLogs",
};
const levelLabels: Record<EffectiveAccessLevel, keyof Pick<Copy, "manage" | "readOnly" | "ownRecords" | "operational" | "noAccess">> = {
  MANAGE: "manage",
  READ_ONLY: "readOnly",
  OWN_RECORDS: "ownRecords",
  OPERATIONAL: "operational",
  NO_ACCESS: "noAccess",
};

function EffectiveAccess({ user }: { user: UserManagementRecord }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  return <SurfaceCard className="effective-access-card">
    <div className="section-header compact"><div><h3>{c.effectiveAccess}</h3><p>{c.effectiveAccessDescription}</p></div><span className="role-chip">{localizedEnum(language, user.role)}</span></div>
    <dl className="effective-access-list" data-saved-role={user.role}>
      {effectiveAccessForRole(user.role).map((item) => <div key={item.category}>
        <dt>{c[categoryLabels[item.category]]}</dt>
        <dd className={`access-level ${item.level.toLowerCase()}`}>{c[levelLabels[item.level]]}</dd>
      </div>)}
    </dl>
  </SurfaceCard>;
}

function RoleTransition({ user }: { user: UserManagementRecord }) {
  const client = useQueryClient();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const [target, setTarget] = useState(user.role);
  const [review, setReview] = useState<{ target: UserManagementRecord["role"]; preview: RoleTransitionPreview } | null>(null);
  const [profile, setProfile] = useState({ specialty: "", position: "", phone: "", bio: "" });
  const preview = review?.target === target ? review.preview : null;
  const previewMutation = useMutation({
    mutationFn: (requestedTarget: UserManagementRecord["role"]) => teamApi.previewRoleTransition(user.id, requestedTarget),
    onSuccess: (data, requestedTarget) => setReview({ target: requestedTarget, preview: data }),
  });
  const confirmMutation = useMutation({
    mutationFn: () => teamApi.confirmRoleTransition(user.id, {
      target_role: target,
      mode: "CONFIRM",
      confirmation_token: preview!.confirmation_token!,
      version: user.version,
      profile: target === "DOCTOR"
        ? { specialty: profile.specialty, phone: profile.phone, bio: profile.bio }
        : target === "STAFF" ? { position: profile.position, phone: profile.phone } : {},
    }),
    onSuccess: async () => {
      setReview(null);
      await refresh(client, user.id);
    },
  });
  const changeTarget = (value: UserManagementRecord["role"]) => {
    setTarget(value);
    setReview(null);
    setProfile({ specialty: "", position: "", phone: "", bio: "" });
    previewMutation.reset();
    confirmMutation.reset();
  };
  const closeReview = () => {
    setReview(null);
    confirmMutation.reset();
  };

  return <SurfaceCard className="role-transition-card">
    <div className="section-header compact"><div><h3>{c.roleAccessChange}</h3><p>{c.roleDescription}</p></div></div>
    <div className="role-transition-controls">
      <div className="current-role-summary"><span>{c.currentRole}</span><strong>{localizedEnum(language, user.role)}</strong></div>
      <span className="role-transition-arrow" aria-hidden="true">→</span>
      <SelectField label={c.newRole} value={target} onChange={(event) => changeTarget(event.target.value as UserManagementRecord["role"])}>
        <option value="ADMIN">{c.admin}</option><option value="DOCTOR">{c.doctor}</option><option value="STAFF">{c.staff}</option>
      </SelectField>
      <Button type="button" loading={previewMutation.isPending} disabled={target === user.role} onClick={() => previewMutation.mutate(target)}>{c.saveRoleChange}</Button>
    </div>
    {message(previewMutation.error) ? <StatePanel state="error" title={message(previewMutation.error) ?? c.transitionUnavailable} /> : null}
    <ConfirmDialog open={Boolean(preview)} title={c.reviewRoleChange} description={c.reviewRoleDescription} pending={confirmMutation.isPending} wide onClose={closeReview}>
      {preview ? <div className="role-review">
        <p className="role-review-route"><strong>{localizedEnum(language, preview.current_role)}</strong><span aria-hidden="true">→</span><strong>{localizedEnum(language, preview.target_role)}</strong></p>
        <section><h3>{c.consequences}</h3><ul>{preview.consequences.map((item) => <li key={item}>{localizedConsequence(language, item)}</li>)}</ul></section>
        <section><h3>{c.operationalHistory}</h3><dl className="operational-history">{Object.entries(preview.operational_history).map(([key, value]) => <div key={key}><dt>{localizedEnum(language, key)}</dt><dd>{value}</dd></div>)}</dl></section>
        <section><h3>{c.blockers}</h3>{preview.blockers.length ? <ul className="role-blockers">{preview.blockers.map((blocker) => <li key={blocker.code} role="alert">{localizedEnum(language, blocker.code)}</li>)}</ul> : <p>{c.noBlockers}</p>}</section>
        {preview.allowed && preview.required_target_profile === "doctor_profile" ? <section><h3>{c.requiredProfile} · {c.profileForDoctor}</h3><div className="v2-form-grid role-profile-fields"><Field label={c.specialty} required value={profile.specialty} onChange={(event) => setProfile((current) => ({ ...current, specialty: event.target.value }))} /><Field label={c.phone} required value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /><label className="v2-field">{c.bio}<textarea value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} /></label></div></section> : null}
        {preview.allowed && preview.required_target_profile === "staff_profile" ? <section><h3>{c.requiredProfile} · {c.profileForStaff}</h3><div className="v2-form-grid role-profile-fields"><Field label={c.position} required value={profile.position} onChange={(event) => setProfile((current) => ({ ...current, position: event.target.value }))} /><Field label={c.phone} required value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></div></section> : null}
        {message(confirmMutation.error) ? <StatePanel state="error" title={message(confirmMutation.error) ?? c.transitionConfirmUnavailable} /> : null}
        <div className="role-review-actions">
          <Button type="button" variant="secondary" disabled={confirmMutation.isPending} onClick={closeReview}>{c.cancel}</Button>
          {preview.allowed ? <Button type="button" loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>{c.confirmRoleChange}</Button> : null}
        </div>
      </div> : null}
    </ConfirmDialog>
  </SurfaceCard>;
}

function LinkedTeamProfile({ user, member, loading }: { user: UserManagementRecord; member?: TeamMemberDetail; loading: boolean }) {
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const professionalLabel = member ? member.role === "DOCTOR" ? member.specialty || c.noSpecialty : member.position || c.noPosition : null;
  return <SurfaceCard className="linked-team-card">
    <h3>{c.linkedTeamProfile}</h3>
    {loading ? <StatePanel state="loading" title={c.linkedTeamLoading} /> : member ? <>
      <div className="linked-team-identity"><span aria-hidden="true">{initials(member.full_name)}</span><div><strong>{member.full_name}</strong><p>{localizedEnum(language, member.role)} · {professionalLabel}</p></div></div>
      <div className="linked-team-status"><StatusBadge status={member.professional_status} label={localizedEnum(language, member.professional_status)} /><StatusBadge status={member.availability.availability} label={localizedEnum(language, member.availability.availability)} /></div>
      <Link className="v2-button secondary" to={`/admin/team/${member.id}`}>{c.openTeam}</Link>
    </> : <p>{c.noProfessionalTeamProfile}</p>}
    {["PROFILE_SETUP_REQUIRED", "INCONSISTENT"].includes(user.linked_profile_state) ? <StatePanel state="locked" title={c.integrityWarning} description={c.integrityDescription} /> : null}
  </SurfaceCard>;
}

export function AdminUserDetailPage() {
  const navigate = useNavigate();
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = teamUsersCopy(language);
  const client = useQueryClient();
  const id = Number(useParams().userId);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [activationOpen, setActivationOpen] = useState(false);
  const query = useQuery({ queryKey: ["user", id], queryFn: () => usersApi.detail(id), enabled: id > 0 });
  const teamMemberId = query.data?.team_member_id ?? 0;
  const linkedTeam = useQuery({ queryKey: teamQueryKeys.detail(teamMemberId), queryFn: () => teamApi.detail(teamMemberId), enabled: teamMemberId > 0 });
  const reset = useMutation({ mutationFn: () => usersApi.resetPassword(id, { temporary_password: password }), onSuccess: async () => { setPassword(""); setPasswordOpen(false); await refresh(client, id); } });
  const activation = useMutation({ mutationFn: () => query.data!.is_active ? usersApi.deactivate(id) : usersApi.reactivate(id), onSuccess: async () => { setActivationOpen(false); await refresh(client, id); } });

  if (query.isLoading) return <StatePanel state="loading" title={c.loadingAccount} />;
  if (query.isError || !query.data) return <StatePanel state="notFound" title={c.accountUnavailable} action={<Button type="button" onClick={() => navigate("/admin/users")}>{c.backToUsers}</Button>} />;
  const user = query.data;

  return <div className="admin-page user-management-page">
    <header className="user-management-header">
      <div><h2>{user.full_name}</h2><p dir="ltr">{user.email}</p></div>
      <div className="user-header-status"><span className="role-chip">{localizedEnum(language, user.role)}</span><StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} label={user.is_active ? c.active : c.inactive} /></div>
    </header>
    <div className="user-management-grid">
      <IdentityForm user={user} />
      <EffectiveAccess user={user} />
      <SurfaceCard className="security-login-card">
        <h3>{c.securityLogin}</h3>
        <dl className="security-login-summary">
          <div><dt>{c.passwordLabel}</dt><dd>{user.must_change_password ? c.mustChangePassword : c.current}</dd></div>
          <div><dt>{c.loginLabel}</dt><dd><StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} label={user.is_active ? c.active : c.inactive} /></dd></div>
        </dl>
        <div className="security-actions">
          <Button type="button" variant="secondary" onClick={() => setPasswordOpen(true)}>{c.resetPassword}</Button>
          <Button type="button" variant={user.is_active ? "danger" : "secondary"} onClick={() => setActivationOpen(true)}>{user.is_active ? c.deactivateAccount : c.reactivateAccount}</Button>
        </div>
      </SurfaceCard>
      <LinkedTeamProfile user={user} member={linkedTeam.data} loading={linkedTeam.isLoading} />
    </div>
    <RoleTransition key={`${user.id}-${user.version}`} user={user} />
    <SurfaceCard className="account-metadata-card">
      <h3>{c.accountMetadata}</h3>
      <dl><div><dt>{c.created}</dt><dd>{formatDate(user.created_at)}</dd></div><div><dt>{c.updated}</dt><dd>{formatDate(user.updated_at)}</dd></div><div><dt>{c.accountVersion}</dt><dd>{user.version}</dd></div></dl>
    </SurfaceCard>
    <ConfirmDialog open={passwordOpen} title={c.resetPassword} description={c.resetDescription} pending={reset.isPending} onClose={() => { setPassword(""); setPasswordOpen(false); reset.reset(); }}>
      <Field label={c.temporaryPassword} type="password" value={password} error={message(reset.error, "temporary_password")} onChange={(event) => setPassword(event.target.value)} />
      {message(reset.error) ? <StatePanel state="error" title={message(reset.error) ?? c.resetUnavailable} /> : null}
      <div className="dialog-actions"><Button disabled={!password} loading={reset.isPending} onClick={() => reset.mutate()}>{c.resetPassword}</Button><Button variant="secondary" disabled={reset.isPending} onClick={() => { setPassword(""); setPasswordOpen(false); reset.reset(); }}>{c.cancel}</Button></div>
    </ConfirmDialog>
    <ConfirmDialog open={activationOpen} title={user.is_active ? c.deactivateAccount : c.reactivateAccount} description={c.accountAccessDescription} pending={activation.isPending} onClose={() => { setActivationOpen(false); activation.reset(); }}>
      <p>{user.is_active ? c.deactivateQuestion : c.reactivateQuestion}</p>
      {message(activation.error) ? <StatePanel state="error" title={message(activation.error) ?? c.accountAccessUnavailable} /> : null}
      <div className="dialog-actions"><Button variant={user.is_active ? "danger" : "primary"} loading={activation.isPending} onClick={() => activation.mutate()}>{c.confirm}</Button><Button variant="secondary" disabled={activation.isPending} onClick={() => { setActivationOpen(false); activation.reset(); }}>{c.cancel}</Button></div>
    </ConfirmDialog>
  </div>;
}
