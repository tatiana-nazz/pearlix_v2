import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserRoundCog } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { auditApi } from "../../api/endpoints/audit";
import { clinicApi } from "../../api/endpoints/clinic";
import { teamApi, teamQueryKeys } from "../../api/endpoints/team";
import { usersApi } from "../../api/endpoints/users";
import { Button, ClickableRow, ConfirmDialog, DataTableShell, Field, FormSection, Modal, PageHeaderV2, Pagination, SectionHeading, SelectField, StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";
import type { UserCreatePayload, UserManagementRecord } from "../../types/users";
import { getErrorMessage } from "../../utils/apiErrors";
import { formatDateTime } from "../../utils/dates";

function useUsers(page = 1) { return useQuery({ queryKey: ["users", page], queryFn: () => usersApi.list({ page }) }); }
function useUser(id: number) { return useQuery({ queryKey: ["user", id], queryFn: () => usersApi.detail(id), enabled: id > 0 }); }

function profileState(user: UserManagementRecord, t: ReturnType<typeof useFeatureT>) {
  if (user.team_member_id) return t("linkedTeamProfile");
  if (user.linked_profile_state === "PROFILE_SETUP_REQUIRED") return t("profileSetupRequired");
  return t("notRecorded");
}

function roleLabel(role: UserRole, t: ReturnType<typeof useFeatureT>) {
  return role === "ADMIN" ? t("admin") : role === "DOCTOR" ? t("doctors") : t("staff");
}

function transitionCopy(value: string, t: ReturnType<typeof useFeatureT>) {
  if (value.includes("matching professional profile will be created")) return t("transitionCreateOrReactivate");
  if (value.includes("already has the requested role")) return t("transitionAlreadyRole");
  if (value.includes("Operational history")) return t("transitionHistory");
  if (value.includes("changed atomically")) return t("transitionAtomicChange");
  if (value.includes("last active Admin")) return t("transitionLastAdmin");
  return value.trim() ? value : t("blockedTransition");
}

function blockerCopy(code: string, t: ReturnType<typeof useFeatureT>) {
  if (code === "NO_ROLE_CHANGE") return t("blockerNoRoleChange");
  if (code === "ROLE_TRANSITION_BLOCKED_BY_HISTORY") return t("blockerHistory");
  if (code === "LAST_ACTIVE_ADMIN") return t("blockerLastActiveAdmin");
  return t("blockerUnknown");
}

function countCopy(key: string, t: ReturnType<typeof useFeatureT>) {
  if (key === "working_shifts") return t("workingShifts");
  if (key === "doctor_availability_exceptions") return t("doctorAvailabilityExceptions");
  if (key === "staff_availability_exceptions") return t("staffAvailabilityExceptions");
  if (key === "appointments") return t("appointmentCount");
  if (key === "visits") return t("visitCount");
  return t("transitionCounts");
}

function invalidateRoleData(client: ReturnType<typeof useQueryClient>, id: number) {
  void client.invalidateQueries({ queryKey: ["users"] });
  void client.invalidateQueries({ queryKey: ["user", id] });
  void client.invalidateQueries({ queryKey: teamQueryKeys.all });
  void client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) });
  void client.invalidateQueries({ queryKey: ["dashboard"] });
  void client.invalidateQueries({ queryKey: ["appointments"] });
  void client.invalidateQueries({ queryKey: ["working-shifts"] });
}

export function AdminUserListPage() {
  const [page, setPage] = useState(1);
  const users = useUsers(page);
  const navigate = useNavigate();
  const t = useFeatureT();

  return <div className="admin-page"><PageHeaderV2 title={t("usersAccess")} description={t("usersDescription")} action={<Link className="v2-button" to="/admin/users/new">{t("newUser")}</Link>} />
    <DataTableShell title={t("accounts")} count={users.data?.count} state={users.isLoading ? <StatePanel state="loading" title={t("loadingAccounts")} /> : users.isError ? <StatePanel state="error" title={t("unableLoadAccounts")} description={getErrorMessage(users.error)} action={<Button variant="secondary" onClick={() => void users.refetch()}>{t("retry")}</Button>} /> : undefined}>
      {users.data ? <table><thead><tr><th>{t("user")}</th><th>{t("role")}</th><th>{t("loginStatus")}</th><th>{t("passwordState")}</th><th>{t("profileState")}</th><th>{t("created")}</th><th>{t("updated")}</th><th /></tr></thead><tbody>{users.data.results.map((user) => <ClickableRow key={user.id} onOpen={() => navigate(`/admin/users/${user.id}`)}><td><strong className="bidi-isolate">{user.full_name}</strong><br /><small className="bidi-isolate">{user.email}</small></td><td>{roleLabel(user.role, t)}</td><td><StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} /></td><td>{user.must_change_password ? t("mustChangePassword") : t("passwordCurrent")}</td><td>{user.team_member_id ? <Link data-row-action to={`/admin/team/${user.team_member_id}`}>{profileState(user, t)}</Link> : profileState(user, t)}</td><td className="bidi-isolate">{formatDateTime(user.created_at)}</td><td className="bidi-isolate">{formatDateTime(user.updated_at)}</td></ClickableRow>)}</tbody></table> : null}
    </DataTableShell>{users.data ? <Pagination page={page} hasPrevious={Boolean(users.data.previous)} hasNext={Boolean(users.data.next)} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} /> : null}</div>;
}

function NewUserForm() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("ADMIN");
  const t = useFeatureT();
  const mutation = useMutation({ mutationFn: (payload: UserCreatePayload) => usersApi.create(payload), onSuccess: (user) => { void client.invalidateQueries({ queryKey: ["users"] }); navigate(`/admin/users/${user.id}`); } });
  const requiresTeam = role !== "ADMIN";

  return <form onSubmit={(event) => { event.preventDefault(); if (!requiresTeam) mutation.mutate({ full_name: fullName, email, role: "ADMIN", temporary_password: password }); }}>
    <FormSection title={t("accountIdentity")}><Field label={t("fullName")} required value={fullName} onChange={(event) => setFullName(event.target.value)} /><Field label={t("loginEmail")} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></FormSection>
    <FormSection title={t("role")}><SelectField label={t("systemRole")} value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="ADMIN">{t("admin")}</option><option value="DOCTOR">{t("doctors")}</option><option value="STAFF">{t("staff")}</option></SelectField></FormSection>
    {requiresTeam ? <StatePanel state="locked" title={t("professionalProfileRequired")} description={t("teamOnboardingHelp")} action={<Link className="v2-button" to="/admin/team">{t("addTeamMember")}</Link>} /> : <FormSection title={t("temporaryPassword")}><Field label={t("temporaryPassword")} required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></FormSection>}
    {mutation.error ? <StatePanel state="error" title={t("unableCreateAccount")} description={getErrorMessage(mutation.error)} /> : null}
    <div className="v2-sticky-actions"><Link className="v2-button secondary" to="/admin/users">{t("cancel")}</Link><Button type="submit" loading={mutation.isPending} disabled={requiresTeam}>{t("createAdminAccount")}</Button></div>
  </form>;
}

export function AdminNewUserPage() { const t = useFeatureT(); return <div className="admin-page"><PageHeaderV2 title={t("newUser")} description={t("newUserDescription")} /><SurfaceCard major><NewUserForm /></SurfaceCard></div>; }

function RoleTransition({ user, onClose }: { user: UserManagementRecord; onClose: () => void }) {
  const t = useFeatureT();
  const client = useQueryClient();
  const initialTarget = user.role === "ADMIN" ? "DOCTOR" : "ADMIN";
  const [target, setTarget] = useState<UserRole>(initialTarget);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof teamApi.previewRoleTransition>> | null>(null);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const previewMutation = useMutation({ mutationFn: () => teamApi.previewRoleTransition(user.id, target), onSuccess: setPreview });
  const confirmMutation = useMutation({ mutationFn: () => teamApi.confirmRoleTransition(user.id, { target_role: target, mode: "CONFIRM", confirmation_token: preview?.confirmation_token ?? "", profile, version: user.version }), onSuccess: () => { invalidateRoleData(client, user.id); onClose(); } });
  const dirty = target !== initialTarget || Boolean(preview) || Object.values(profile).some(Boolean);
  const pending = previewMutation.isPending || confirmMutation.isPending;
  const profileShape = preview?.required_target_profile;

  return <Modal open title={t("changeRole")} description={t("roleTransitionHelp")} onClose={onClose} pending={pending} dirty={dirty}>
    <SelectField label={t("targetRole")} value={target} onChange={(event) => { setTarget(event.target.value as UserRole); setPreview(null); setProfile({}); }}><option value="ADMIN">{t("admin")}</option><option value="DOCTOR">{t("doctors")}</option><option value="STAFF">{t("staff")}</option></SelectField>
    {!preview ? <Button onClick={() => previewMutation.mutate()} loading={previewMutation.isPending}>{t("previewTransition")}</Button> : <>
      <SurfaceCard><SectionHeading title={t("transitionConsequences")} />{preview.allowed ? <ul>{preview.consequences.map((item) => <li key={item}>{transitionCopy(item, t)}</li>)}</ul> : <><p>{t("blockedTransition")}</p>{preview.blockers.map((blocker) => <div key={blocker.code}><p>{blockerCopy(blocker.code, t)}</p>{Object.entries(blocker.counts).filter(([, count]) => count > 0).length ? <ul aria-label={t("transitionCounts")}>{Object.entries(blocker.counts).filter(([, count]) => count > 0).map(([key, count]) => <li key={key}>{countCopy(key, t)}: <bdi>{count}</bdi></li>)}</ul> : null}</div>)}</>}</SurfaceCard>
      {profileShape === "doctor_profile" ? <><Field label={t("specialty")} value={profile.specialty ?? ""} onChange={(event) => setProfile({ ...profile, specialty: event.target.value })} /><Field label={t("phone")} value={profile.phone ?? ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /><Field label={t("biography")} value={profile.bio ?? ""} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></> : null}
      {profileShape === "staff_profile" ? <><Field label={t("position")} value={profile.position ?? ""} onChange={(event) => setProfile({ ...profile, position: event.target.value })} /><Field label={t("phone")} value={profile.phone ?? ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></> : null}
      {confirmMutation.error ? <StatePanel state="error" title={t("roleTransitionFailed")} description={getErrorMessage(confirmMutation.error)} /> : null}
      <Button variant="danger" disabled={!preview.allowed || !preview.confirmation_token} loading={confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>{t("confirmTransition")}</Button>
    </>}
  </Modal>;
}

export function AdminUserDetailPage() {
  const id = Number(useParams().userId);
  const user = useUser(id);
  const client = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [password, setPassword] = useState("");
  const t = useFeatureT();
  const reset = useMutation({ mutationFn: () => usersApi.resetPassword(id, { temporary_password: password }), onSuccess: () => { invalidateRoleData(client, id); setPassword(""); setResetOpen(false); } });
  const deactivate = useMutation({ mutationFn: () => usersApi.deactivate(id), onSuccess: () => { invalidateRoleData(client, id); setDeactivateOpen(false); } });
  const reactivate = useMutation({ mutationFn: () => usersApi.reactivate(id), onSuccess: () => invalidateRoleData(client, id) });
  if (user.isLoading) return <StatePanel state="loading" title={t("loadingAccount")} />;
  if (user.isError || !user.data) return <StatePanel state="error" title={t("accountUnavailable")} description={user.error ? getErrorMessage(user.error) : undefined} />;
  const item = user.data;

  return <div className="admin-page"><Link className="inline-back-link" to="/admin/users">{t("usersAccess")}</Link><PageHeaderV2 title={item.full_name} description={t("authenticationAuthority")} /><div className="dashboard-columns">
    <SurfaceCard><SectionHeading title={t("accountIdentity")} /><dl className="detail-grid"><div><dt>{t("loginEmail")}</dt><dd className="bidi-isolate">{item.email}</dd></div><div><dt>{t("created")}</dt><dd className="bidi-isolate">{formatDateTime(item.created_at)}</dd></div><div><dt>{t("updated")}</dt><dd className="bidi-isolate">{formatDateTime(item.updated_at)}</dd></div></dl></SurfaceCard>
    <SurfaceCard><SectionHeading title={t("securityPassword")} /><p><StatusBadge status={item.is_active ? "ACTIVE" : "INACTIVE"} /> · {item.must_change_password ? t("mustChangePassword") : t("passwordCurrent")}</p><Button variant="secondary" onClick={() => setResetOpen(true)}><KeyRound size={16} />{t("resetPassword")}</Button></SurfaceCard>
    <SurfaceCard><SectionHeading title={t("roleAccess")} /><p>{roleLabel(item.role, t)}</p><Button variant="secondary" onClick={() => setTransitionOpen(true)}><UserRoundCog size={16} />{t("changeRole")}</Button></SurfaceCard>
    <SurfaceCard><SectionHeading title={t("linkedTeamProfile")} />{item.team_member_id ? <Link className="v2-button secondary" to={`/admin/team/${item.team_member_id}`}>{t("openTeamProfile")}</Link> : <p>{profileState(item, t)}</p>}</SurfaceCard>
  </div><SurfaceCard><SectionHeading title={t("accountAccess")} />{item.is_active ? <Button variant="danger" onClick={() => setDeactivateOpen(true)}><ShieldCheck size={16} />{t("deactivate")}</Button> : <Button onClick={() => reactivate.mutate()} loading={reactivate.isPending}>{t("reactivate")}</Button>}{reactivate.error ? <StatePanel state="error" title={t("unableReactivate")} description={getErrorMessage(reactivate.error)} /> : null}</SurfaceCard>
    <ConfirmDialog open={resetOpen} title={t("resetPassword")} description={t("resetPasswordHelp")} onClose={() => { setPassword(""); setResetOpen(false); }} pending={reset.isPending} dirty={Boolean(password)}><Field label={t("temporaryPassword")} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><Button loading={reset.isPending} disabled={!password} onClick={() => reset.mutate()}>{t("resetPasswordAction")}</Button>{reset.error ? <StatePanel state="error" title={t("unableResetPassword")} description={getErrorMessage(reset.error)} /> : null}</ConfirmDialog>
    <ConfirmDialog open={deactivateOpen} title={t("deactivate")} description={t("deactivateHelp")} onClose={() => setDeactivateOpen(false)} pending={deactivate.isPending}><Button variant="danger" loading={deactivate.isPending} onClick={() => deactivate.mutate()}>{t("deactivate")}</Button>{deactivate.error ? <StatePanel state="error" title={t("unableDeactivate")} description={getErrorMessage(deactivate.error)} /> : null}</ConfirmDialog>
    {transitionOpen ? <RoleTransition user={item} onClose={() => setTransitionOpen(false)} /> : null}
  </div>;
}

export function AdminClinicSettingsPage() { const settings = useQuery({ queryKey: ["clinic-settings"], queryFn: clinicApi.getSettings }); const client = useQueryClient(); const mutation = useMutation({ mutationFn: clinicApi.updateSettings, onSuccess: () => void client.invalidateQueries({ queryKey: ["clinic-settings"] }) }); const [values, setValues] = useState<Record<string, unknown> | null>(null); if (settings.isLoading) return <StatePanel state="loading" title="Loading clinic settings" />; if (settings.isError || !settings.data) return <StatePanel state="error" title="Settings unavailable" />; const data = values ?? settings.data; return <div className="admin-page"><PageHeaderV2 title="Clinic settings" /><SurfaceCard><form onSubmit={(e) => { e.preventDefault(); mutation.mutate(data); }}>{Object.entries(data).map(([key, value]) => <Field key={key} label={key.replace(/_/g, " ")} value={Array.isArray(value) ? value.join(", ") : String(value ?? "")} onChange={(e) => setValues({ ...data, [key]: e.target.value })} />)}<Button loading={mutation.isPending}>Save settings</Button></form></SurfaceCard></div>; }
export function AdminAuditLogListPage() { const [page, setPage] = useState(1); const audit = useQuery({ queryKey: ["audit-logs", page], queryFn: () => auditApi.list({ page }) }); if (audit.isLoading) return <StatePanel state="loading" title="Loading audit logs" />; if (audit.isError || !audit.data) return <StatePanel state="error" title="Audit logs unavailable" />; return <div className="admin-page"><PageHeaderV2 title="Audit logs" /><DataTableShell title="Audit records"><table><tbody>{audit.data.results.map((log) => <ClickableRow key={log.id} onOpen={() => {}}><td>{log.created_at}</td><td>{log.actor?.full_name ?? "System"}</td><td>{log.action}</td></ClickableRow>)}</tbody></table></DataTableShell><Pagination page={page} hasPrevious={Boolean(audit.data.previous)} hasNext={Boolean(audit.data.next)} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} /></div>; }
export function AdminAuditLogDetailPage() { const id = Number(useParams().auditLogId); const log = useQuery({ queryKey: ["audit-log", id], queryFn: () => auditApi.detail(id) }); if (log.isLoading) return <StatePanel state="loading" title="Loading audit record" />; if (log.isError || !log.data) return <StatePanel state="error" title="Audit record unavailable" />; return <div className="admin-page"><PageHeaderV2 title="Audit record" /><SurfaceCard><pre>{JSON.stringify(log.data.metadata_json, null, 2)}</pre></SurfaceCard></div>; }
