import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { teamApi, teamQueryKeys } from "../../api/endpoints/team";
import { Button, ClickableRow, ConfirmDialog, DataTableShell, Field, FormSection, Modal, PageHeaderV2, Pagination, SectionHeading, SelectField, StatePanel, StatusBadge, SurfaceCard, Tabs, useOverlayClose } from "../../components/v2";
import { getErrorMessage } from "../../utils/apiErrors";
import type { TeamMemberCreatePayload, TeamMemberDetail, TeamMemberUpdatePayload } from "../../types/team";
import { useFeatureT } from "../../layouts/i18n";

function useTeamList(query: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: [...teamQueryKeys.all, query], queryFn: () => teamApi.list(query) });
}

function TeamForm({ member, onClose, onDirtyChange }: { member?: TeamMemberDetail; onClose: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const client = useQueryClient(); const navigate = useNavigate();
  const t = useFeatureT();
  const [role, setRole] = useState<"DOCTOR" | "STAFF">(member?.role ?? "DOCTOR");
  const [fullName, setFullName] = useState(member?.full_name ?? ""); const [email, setEmail] = useState(member?.account.email ?? ""); const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState(member?.specialty ?? ""); const [position, setPosition] = useState(member?.position ?? ""); const [phone, setPhone] = useState(member?.phone ?? ""); const [bio, setBio] = useState(member?.role === "DOCTOR" && "bio" in member.profile ? member.profile.bio : "");
  const initial = useRef(""); const requestClose = useOverlayClose();
  useEffect(() => { initial.current = JSON.stringify({ role, fullName, email, password, specialty, position, phone, bio }); onDirtyChange(false); }, []);
  useEffect(() => { onDirtyChange(JSON.stringify({ role, fullName, email, password, specialty, position, phone, bio }) !== initial.current); }, [bio, email, fullName, onDirtyChange, password, phone, position, role, specialty]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (member) { const payload: TeamMemberUpdatePayload = role === "DOCTOR" ? { version: member.version, specialty, phone, bio } : { version: member.version, position, phone }; return teamApi.update(member.id, payload); }
      const payload: TeamMemberCreatePayload = role === "DOCTOR" ? { account: { full_name: fullName, email, temporary_password: password }, role, doctor_profile: { specialty, phone, bio } } : { account: { full_name: fullName, email, temporary_password: password }, role, staff_profile: { position, phone } };
      return teamApi.create(payload);
    },
    onSuccess: (result) => { onDirtyChange(false); void client.invalidateQueries({ queryKey: teamQueryKeys.all }); void client.invalidateQueries({ queryKey: ["users"] }); if (member) { void client.invalidateQueries({ queryKey: teamQueryKeys.detail(member.id) }); onClose(); } else navigate(`/admin/team/${result.id}`); },
  });
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
    {!member ? <FormSection title={t("accountAccess")}><Field label={t("fullName")} required value={fullName} onChange={(e) => setFullName(e.target.value)} /><Field label={t("email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /><Field label={t("temporaryPassword")} type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></FormSection> : null}
    {!member ? <FormSection title={t("professionalRole")}><SelectField label={t("role")} value={role} onChange={(e) => setRole(e.target.value as "DOCTOR" | "STAFF")}><option value="DOCTOR">{t("doctors")}</option><option value="STAFF">{t("staff")}</option></SelectField></FormSection> : null}
    <FormSection title={t("professionalProfile")}>{role === "DOCTOR" ? <><Field label={t("specialty")} value={specialty} onChange={(e) => setSpecialty(e.target.value)} /><Field label={t("phone")} value={phone} onChange={(e) => setPhone(e.target.value)} /><Field label={t("biography")} value={bio} onChange={(e) => setBio(e.target.value)} /></> : <><Field label={t("position")} value={position} onChange={(e) => setPosition(e.target.value)} /><Field label={t("phone")} value={phone} onChange={(e) => setPhone(e.target.value)} /></>}</FormSection>
    {mutation.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(mutation.error)} /> : null}
    <div className="v2-sticky-actions"><Button type="button" variant="secondary" onClick={requestClose} disabled={mutation.isPending}>{t("cancel")}</Button><Button type="submit" loading={mutation.isPending}>{member ? t("saveProfile") : t("createTeamMember")}</Button></div>
  </form>;
}

export function AdminTeamListPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate(); const [open, setOpen] = useState(false); const [formDirty, setFormDirty] = useState(false); const t = useFeatureT();
  const role = params.get("role") ?? ""; const page = Number(params.get("page") ?? "1"); const q = params.get("q") ?? ""; const status = params.get("professional_status") ?? ""; const availability = params.get("availability") ?? "";
  const list = useTeamList({ page, q: q || undefined, role: role || undefined, professional_status: status || undefined, availability: availability || undefined });
  const set = (key: string, value: string) => { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); if (key !== "page") next.set("page", "1"); setParams(next); };
  return <div className="admin-page"><PageHeaderV2 title={t("team")} description={t("professionalDirectory")} action={<Button onClick={() => setOpen(true)}><UserPlus size={18} />{t("addTeamMember")}</Button>} />
    <Tabs selected={role || "ALL"} onSelect={(value) => set("role", value === "ALL" ? "" : value)} tabs={[{ id: "ALL", label: t("all") }, { id: "DOCTOR", label: t("doctors") }, { id: "STAFF", label: t("staff") }]} />
    <DataTableShell title={t("teamMembers")} count={list.data?.count} toolbar={<div className="v2-table-toolbar"><input aria-label={t("searchTeam")} placeholder={t("searchNameOrEmail")} value={q} onChange={(e) => set("q", e.target.value)} /><select aria-label={t("professionalStatus")} value={status} onChange={(e) => set("professional_status", e.target.value)}><option value="">{t("allStatuses")}</option><option value="ACTIVE">{t("active")}</option><option value="INACTIVE">{t("inactive")}</option></select><select aria-label={t("available")} value={availability} onChange={(e) => set("availability", e.target.value)}><option value="">{t("allAvailability")}</option><option value="AVAILABLE">{t("available")}</option><option value="ON_LEAVE">{t("onLeave")}</option><option value="UNAVAILABLE">{t("unavailable")}</option></select></div>} state={list.isLoading ? <StatePanel state="loading" title={t("loading")} /> : list.isError ? <StatePanel state="error" title={t("error")} description={getErrorMessage(list.error)} action={<Button variant="secondary" onClick={() => void list.refetch()}>{t("retry")}</Button>} /> : undefined}>
      {list.data ? <table><thead><tr><th>{t("professional")}</th><th>{t("role")}</th><th>{t("specialtyOrPosition")}</th><th>{t("contactIdentifiers")}</th><th>{t("status")}</th><th>{t("available")}</th><th>{t("today")}</th><th /></tr></thead><tbody>{list.data.results.map((member) => <ClickableRow key={member.id} onOpen={() => navigate(`/admin/team/${member.id}`)}><td><strong className="bidi-isolate">{member.full_name}</strong><br /><small className="bidi-isolate">{member.account.email}</small></td><td>{member.role === "DOCTOR" ? t("doctors") : t("staff")}</td><td className="bidi-isolate">{member.specialty || member.position || t("notRecorded")}</td><td className="bidi-isolate">{member.phone || t("notRecorded")}</td><td><StatusBadge status={member.professional_status} /></td><td>{member.availability.on_leave ? t("onLeave") : member.availability.availability === "AVAILABLE" ? t("available") : t("unavailable")}</td><td><bdi>{member.today_workload.appointment_count}</bdi> {t("appointments")}</td></ClickableRow>)}</tbody></table> : null}
    </DataTableShell>{list.data ? <Pagination page={page} hasPrevious={Boolean(list.data.previous)} hasNext={Boolean(list.data.next)} onPrevious={() => set("page", String(page - 1))} onNext={() => set("page", String(page + 1))} /> : null}
    <Modal open={open} title={t("addTeamMember")} description={t("addProfessional")} onClose={() => { setFormDirty(false); setOpen(false); }} dirty={formDirty}><TeamForm onDirtyChange={setFormDirty} onClose={() => { setFormDirty(false); setOpen(false); }} /></Modal>
  </div>;
}

export function AdminTeamDetailPage() {
  const id = Number(useParams().memberId); const detail = useQuery({ queryKey: teamQueryKeys.detail(id), queryFn: () => teamApi.detail(id), enabled: id > 0 }); const client = useQueryClient(); const [edit, setEdit] = useState(false); const [editDirty, setEditDirty] = useState(false); const [statusOpen, setStatusOpen] = useState(false);
  const statusMutation = useMutation({ mutationFn: () => teamApi.setProfessionalStatus(id, { is_active: !(detail.data?.professional_status === "ACTIVE"), version: detail.data?.version ?? 0 }), onSuccess: () => { void client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }); void client.invalidateQueries({ queryKey: teamQueryKeys.all }); setStatusOpen(false); } });
  if (detail.isLoading) return <StatePanel state="loading" title="Loading team member" />; if (detail.isError || !detail.data) return <StatePanel state="error" title="Team member unavailable" description={detail.error ? getErrorMessage(detail.error) : undefined} />;
  const member = detail.data; return <div className="admin-page"><Link className="inline-back-link" to="/admin/team">Back to Team</Link><PageHeaderV2 title={member.full_name} description={`${member.role === "DOCTOR" ? "Doctor" : "Staff"} professional record`} action={<><Button variant="secondary" onClick={() => setStatusOpen(true)}>{member.professional_status === "ACTIVE" ? "Set professional inactive" : "Set professional active"}</Button><Button onClick={() => setEdit(true)}>Edit profile</Button></>} />
    <SurfaceCard major><SectionHeading title="General Info" /><dl className="detail-grid"><div><dt>Role</dt><dd>{member.role}</dd></div><div><dt>Professional status</dt><dd><StatusBadge status={member.professional_status} /></dd></div><div><dt>{member.role === "DOCTOR" ? "Specialty" : "Position"}</dt><dd>{member.specialty || member.position || "Not recorded"}</dd></div><div><dt>Phone</dt><dd>{member.phone || "Not recorded"}</dd></div>{member.role === "DOCTOR" && "bio" in member.profile ? <div className="detail-wide"><dt>Biography</dt><dd>{member.profile.bio || "Not recorded"}</dd></div> : null}</dl></SurfaceCard>
    <SurfaceCard><SectionHeading title="Working Hours / Shifts" />{member.active_shifts.length ? <ul>{member.active_shifts.map((shift) => <li key={shift.id}>{shift.name}: {shift.start_time}–{shift.end_time}</li>)}</ul> : <StatePanel state="empty" title="No active shifts" />}</SurfaceCard>
    <SurfaceCard><SectionHeading title="Leave Exceptions" />{member.current_future_leave.length ? <ul>{member.current_future_leave.map((leave) => <li key={leave.id}>{leave.start_datetime} – {leave.end_datetime}: {leave.reason || "No reason"}</li>)}</ul> : <StatePanel state="empty" title="No current or future leave" />}</SurfaceCard>
    <SurfaceCard><SectionHeading title="Today's appointments" />{member.today_appointments.length ? <ul>{member.today_appointments.map((appointment) => <li key={appointment.id}>{appointment.patient_name} · {appointment.start_datetime} · <StatusBadge status={appointment.status} /></li>)}</ul> : <StatePanel state="empty" title="No appointments today" />}</SurfaceCard>
    <SurfaceCard><SectionHeading title="Linked Website Account" /><p>{member.account.email} · {member.account.is_active ? "Login active" : "Login inactive"}</p><Link className="v2-button secondary" to={`/admin/users/${member.id}`}>Open Users & Access</Link></SurfaceCard>
    <Modal open={edit} title={`Edit ${member.role === "DOCTOR" ? "Doctor" : "Staff"} Profile`} onClose={() => { setEditDirty(false); setEdit(false); }} dirty={editDirty}><TeamForm member={member} onDirtyChange={setEditDirty} onClose={() => { setEditDirty(false); setEdit(false); }} /></Modal>
    <ConfirmDialog open={statusOpen} title="Change professional status" description="This changes professional availability only; login access remains unchanged." onClose={() => setStatusOpen(false)} pending={statusMutation.isPending}><p>Confirm this professional-status change.</p>{statusMutation.error ? <StatePanel state="error" title="Unable to change status" description={getErrorMessage(statusMutation.error)} /> : null}<Button variant="danger" loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>Confirm status change</Button></ConfirmDialog>
  </div>;
}
