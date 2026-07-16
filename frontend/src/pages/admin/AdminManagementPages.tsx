import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck, UserRoundCog } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { auditApi } from "../../api/endpoints/audit";
import { clinicApi } from "../../api/endpoints/clinic";
import { teamApi, teamQueryKeys } from "../../api/endpoints/team";
import { usersApi } from "../../api/endpoints/users";
import { Button, ClickableRow, Combobox, ConfirmDialog, DataTableShell, Field, FormSection, Modal, PageHeaderV2, Pagination, SectionHeading, SelectField, StatePanel, StatusBadge, StickyActionBar, SurfaceCard } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import type { UserRole } from "../../types/auth";
import type { AuditLog } from "../../types/audit";
import type { AiMode, ClinicSettings, Currency, Language } from "../../types/clinic";
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

const durations = [15, 30, 45, 60] as const; const currencies: Currency[] = ["SYP", "USD"]; const secretKey = /password|temporary_password|token|access|refresh|authorization|secret|api_key/i;
function fullSettings(value: unknown): value is ClinicSettings { return Boolean(value && typeof value === "object" && "ai_mode" in value); }
function cloneSettings(value: ClinicSettings): ClinicSettings { return { ...value, allowed_durations_minutes: [...value.allowed_durations_minutes], supported_currencies: [...value.supported_currencies] }; }
function human(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()); }
function Meta({ value, depth = 0 }: { value: unknown; depth?: number }) { const t = useFeatureT(); if (depth > 4) return <span>{t("unknown")}</span>; if (value === null || ["string", "number", "boolean"].includes(typeof value)) return <bdi className="metadata-value">{String(value).slice(0, 500)}</bdi>; if (Array.isArray(value)) return <ul className="metadata-tree">{value.slice(0, 20).map((v, i) => <li key={i}><Meta value={v} depth={depth + 1} /></li>)}</ul>; if (typeof value === "object") return <dl className="metadata-tree">{Object.entries(value).slice(0, 30).map(([key, v]) => <div key={key}><dt>{human(key)}</dt><dd>{secretKey.test(key) ? t("redacted") : <Meta value={v} depth={depth + 1} />}</dd></div>)}</dl>; return <span>{t("unknown")}</span>; }
function ClinicForm() {
  const t = useFeatureT(); const client = useQueryClient(); const query = useQuery({ queryKey: ["clinic-settings"], queryFn: clinicApi.getSettings }); const [base, setBase] = useState<ClinicSettings | null>(null); const [value, setValue] = useState<ClinicSettings | null>(null); const [confirm, setConfirm] = useState(false); const ref = useRef({ base: null as ClinicSettings | null, value: null as ClinicSettings | null }); useEffect(() => { if (query.data && fullSettings(query.data) && !base) { const next = cloneSettings(query.data); setBase(next); setValue(cloneSettings(next)); } }, [base, query.data]); const changed = Boolean(base && value && ["clinic_name","address","phone","email","timezone","capacity_per_slot","default_appointment_duration_minutes","default_currency","default_language","ai_mode","ai_service_url"].some((key) => value[key as keyof ClinicSettings] !== base[key as keyof ClinicSettings]) || value?.allowed_durations_minutes.join("|") !== base?.allowed_durations_minutes.join("|") || value?.supported_currencies.join("|") !== base?.supported_currencies.join("|")); ref.current = { base, value }; const mutation = useMutation({ mutationFn: clinicApi.updateSettings, onSuccess: (next) => { if (fullSettings(next)) { const clean = cloneSettings(next); setBase(clean); setValue(cloneSettings(clean)); for (const key of ["clinic-settings","dashboard","appointments","billing-handoffs","invoices","invoice-print-data","xrays","ai-results"]) void client.invalidateQueries({ queryKey: [key] }); } } }); const blocker = useBlocker(() => changed || mutation.isPending); useEffect(() => { const onUnload = (e: BeforeUnloadEvent) => { if (ref.current.base && ref.current.value && changed) { e.preventDefault(); e.returnValue = ""; } }; addEventListener("beforeunload", onUnload); return () => removeEventListener("beforeunload", onUnload); }, [changed]); useEffect(() => { if (blocker.state === "blocked") setConfirm(true); }, [blocker.state]);
  if (query.isError || !fullSettings(query.data) && !query.isLoading) return <StatePanel state="error" title={t("settingsUnavailable")} action={<Button onClick={() => void query.refetch()}>{t("retry")}</Button>} />; if (query.isLoading || !base || !value) return <StatePanel state="loading" title={t("clinicSettings")} />; const error = { capacity: value.capacity_per_slot < 1, duration: !value.allowed_durations_minutes.length || !value.allowed_durations_minutes.includes(value.default_appointment_duration_minutes), currency: !value.supported_currencies.length || !value.supported_currencies.includes(value.default_currency), email: Boolean(value.email) && !/^\S+@\S+\.\S+$/.test(value.email), zone: !/^[A-Za-z_]+\/[A-Za-z_]+/.test(value.timezone), url: Boolean(value.ai_service_url) && !/^https?:\/\//.test(value.ai_service_url) }; const invalid = Object.values(error).some(Boolean); const set = <K extends keyof ClinicSettings>(key: K, next: ClinicSettings[K]) => setValue({ ...value, [key]: next }); const toggled = (key: "allowed_durations_minutes" | "supported_currencies", next: number | Currency) => { const items = value[key] as (number | Currency)[]; set(key, (items.includes(next) ? items.filter((item) => item !== next) : [...items, next]) as ClinicSettings[typeof key]); }; const save = () => { const payload: Partial<ClinicSettings> = {}; (["clinic_name","address","phone","email","timezone","capacity_per_slot","default_appointment_duration_minutes","allowed_durations_minutes","default_currency","supported_currencies","default_language","ai_mode","ai_service_url"] as const).forEach((key) => { const a = value[key]; const b = base[key]; if (Array.isArray(a) ? a.join("|") !== (b as typeof a).join("|") : a !== b) payload[key] = a as never; }); mutation.mutate(payload); };
  return <><form onSubmit={(e) => { e.preventDefault(); if (changed && !invalid) save(); }}><FormSection title={t("clinicIdentity")}><Field label={t("clinicName")} value={value.clinic_name} onChange={(e) => set("clinic_name", e.target.value)} /><Field label={t("address")} value={value.address} onChange={(e) => set("address", e.target.value)} /><Field label={t("phone")} value={value.phone} onChange={(e) => set("phone", e.target.value)} /><Field label={t("email")} type="email" error={error.email ? t("emailInvalid") : undefined} value={value.email} onChange={(e) => set("email", e.target.value)} /></FormSection><FormSection title={t("scheduling")}><Field label={t("timezone")} error={error.zone ? t("timezoneRequired") : undefined} value={value.timezone} onChange={(e) => set("timezone", e.target.value)} /><Field label={t("capacity")} type="number" min={1} error={error.capacity ? t("capacityInvalid") : undefined} value={value.capacity_per_slot} onChange={(e) => set("capacity_per_slot", Number(e.target.value))} /><fieldset><legend>{t("allowedDurations")}</legend>{durations.map((d) => <label key={d}><input type="checkbox" checked={value.allowed_durations_minutes.includes(d)} onChange={() => toggled("allowed_durations_minutes", d)} />{d}</label>)}</fieldset><SelectField label={t("defaultDuration")} error={error.duration ? t("durationRelationship") : undefined} value={value.default_appointment_duration_minutes} onChange={(e) => set("default_appointment_duration_minutes", Number(e.target.value))}>{durations.map((d) => <option key={d} value={d}>{d}</option>)}</SelectField></FormSection><FormSection title={t("localizationBilling")}><fieldset><legend>{t("supportedCurrencies")}</legend>{currencies.map((c) => <label key={c}><input type="checkbox" checked={value.supported_currencies.includes(c)} onChange={() => toggled("supported_currencies", c)} />{c}</label>)}</fieldset><SelectField label={t("defaultCurrency")} error={error.currency ? t("currencyRelationship") : undefined} value={value.default_currency} onChange={(e) => set("default_currency", e.target.value as Currency)}>{currencies.map((c) => <option key={c} value={c}>{c}</option>)}</SelectField><SelectField label={t("defaultLanguage")} value={value.default_language} onChange={(e) => set("default_language", e.target.value as Language)}><option value="EN">English</option><option value="AR">العربية</option></SelectField></FormSection><FormSection title={t("aiWorkspace")}><p>{t("clinicSettingsHelp")}</p><SelectField label={t("aiMode")} value={value.ai_mode} onChange={(e) => set("ai_mode", e.target.value as AiMode)}><option value="DJANGO_INTERNAL">Django internal</option><option value="SEPARATE_SERVICE">Separate service</option><option value="MOCK_ADAPTER">Mock adapter</option></SelectField><Field label={t("aiServiceUrl")} type="url" error={error.url ? t("aiUrlInvalid") : undefined} value={value.ai_service_url} onChange={(e) => set("ai_service_url", e.target.value)} /></FormSection><StickyActionBar><Button type="submit" loading={mutation.isPending} disabled={!changed || invalid}>{t("saveSettings")}</Button><Button type="button" variant="secondary" disabled={!changed || mutation.isPending} onClick={() => setValue(cloneSettings(base))}>{t("discard")}</Button></StickyActionBar>{mutation.error ? <StatePanel state="error" title={t("saveFailed")} description={getErrorMessage(mutation.error)} /> : null}</form><ConfirmDialog open={confirm} title={t("discardChanges")} pending={mutation.isPending} onClose={() => { blocker.reset?.(); setConfirm(false); }}><Button variant="secondary" onClick={() => { blocker.reset?.(); setConfirm(false); }}>{t("keepEditing")}</Button><Button variant="danger" onClick={() => { setConfirm(false); blocker.proceed?.(); }}>{t("discard")}</Button></ConfirmDialog></>;
}
function LegacyAdminClinicSettingsPage() { const t = useFeatureT(); return <div className="admin-page"><PageHeaderV2 title={t("clinicSettings")} description={t("clinicSettingsHelp")} /><SurfaceCard major><ClinicForm /></SurfaceCard></div>; }
export { AdminClinicSettingsPage } from "./ClinicSettingsPage";
function queries(params: URLSearchParams) { return { page: Number(params.get("page") || "1"), actor_id: params.get("actor_id") || undefined, actor_role: params.get("actor_role") || undefined, action: params.get("action") || undefined, entity_type: params.get("entity_type") || undefined, entity_id: params.get("entity_id") || undefined, created_from: params.get("created_from") || undefined, created_to: params.get("created_to") || undefined }; }
export { AdminAuditLogDetailPage, AdminAuditLogListPage } from "./AuditPages";
