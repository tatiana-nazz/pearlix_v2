import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { teamApi, teamQueryKeys } from "../../api/endpoints/team";
import { Button, ClickableRow, ConfirmDialog, DataTableShell, Field, FormSection, Modal, PageHeaderV2, Pagination, SectionHeading, SelectField, StatePanel, StatusBadge, SurfaceCard, Tabs, useOverlayClose } from "../../components/v2";
import { useFeatureT } from "../../layouts/i18n";
import type { TeamMemberCreatePayload, TeamMemberDetail, TeamMemberUpdatePayload } from "../../types/team";
import { getErrorMessage } from "../../utils/apiErrors";

function useTeamList(query: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: [...teamQueryKeys.all, query], queryFn: () => teamApi.list(query) });
}

interface TeamFormProps {
  member?: TeamMemberDetail;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
}

function TeamForm({ member, onClose, onDirtyChange, onPendingChange }: TeamFormProps) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const t = useFeatureT();
  const [role, setRole] = useState<"DOCTOR" | "STAFF">(member?.role ?? "DOCTOR");
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [email, setEmail] = useState(member?.account.email ?? "");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState(member?.specialty ?? "");
  const [position, setPosition] = useState(member?.position ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [bio, setBio] = useState(member?.role === "DOCTOR" && "bio" in member.profile ? member.profile.bio : "");
  const initial = useRef("");
  const requestClose = useOverlayClose();
  const values = { role, fullName, email, password, specialty, position, phone, bio };

  useEffect(() => {
    initial.current = JSON.stringify(values);
    onDirtyChange(false);
  }, []);

  useEffect(() => {
    onDirtyChange(JSON.stringify(values) !== initial.current);
  }, [bio, email, fullName, onDirtyChange, password, phone, position, role, specialty]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (member) {
        const payload: TeamMemberUpdatePayload = role === "DOCTOR"
          ? { version: member.version, specialty, phone, bio }
          : { version: member.version, position, phone };
        return teamApi.update(member.id, payload);
      }

      const payload: TeamMemberCreatePayload = role === "DOCTOR"
        ? { account: { full_name: fullName, email, temporary_password: password }, role, doctor_profile: { specialty, phone, bio } }
        : { account: { full_name: fullName, email, temporary_password: password }, role, staff_profile: { position, phone } };
      return teamApi.create(payload);
    },
    onSuccess: (result) => {
      onDirtyChange(false);
      void client.invalidateQueries({ queryKey: teamQueryKeys.all });
      void client.invalidateQueries({ queryKey: ["users"] });
      if (member) {
        void client.invalidateQueries({ queryKey: teamQueryKeys.detail(member.id) });
        onClose();
      } else {
        navigate(`/admin/team/${result.id}`);
      }
    },
  });

  useEffect(() => onPendingChange(mutation.isPending), [mutation.isPending, onPendingChange]);

  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
    {!member ? <FormSection title={t("accountAccess")}>
      <Field label={t("fullName")} required value={fullName} onChange={(event) => setFullName(event.target.value)} />
      <Field label={t("email")} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <Field label={t("temporaryPassword")} type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
    </FormSection> : null}
    {!member ? <FormSection title={t("professionalRole")}>
      <SelectField label={t("role")} value={role} onChange={(event) => setRole(event.target.value as "DOCTOR" | "STAFF")}>
        <option value="DOCTOR">{t("doctors")}</option><option value="STAFF">{t("staff")}</option>
      </SelectField>
    </FormSection> : null}
    <FormSection title={t("professionalProfile")}>
      {role === "DOCTOR" ? <>
        <Field label={t("specialty")} value={specialty} onChange={(event) => setSpecialty(event.target.value)} />
        <Field label={t("phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Field label={t("biography")} value={bio} onChange={(event) => setBio(event.target.value)} />
      </> : <>
        <Field label={t("position")} value={position} onChange={(event) => setPosition(event.target.value)} />
        <Field label={t("phone")} value={phone} onChange={(event) => setPhone(event.target.value)} />
      </>}
    </FormSection>
    {mutation.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(mutation.error)} /> : null}
    <div className="v2-sticky-actions"><Button type="button" variant="secondary" onClick={requestClose} disabled={mutation.isPending}>{t("cancel")}</Button><Button type="submit" loading={mutation.isPending}>{member ? t("saveProfile") : t("createTeamMember")}</Button></div>
  </form>;
}

export function AdminTeamListPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [formPending, setFormPending] = useState(false);
  const t = useFeatureT();
  const role = params.get("role") ?? "";
  const page = Number(params.get("page") ?? "1");
  const q = params.get("q") ?? "";
  const status = params.get("professional_status") ?? "";
  const availability = params.get("availability") ?? "";
  const list = useTeamList({ page, q: q || undefined, role: role || undefined, professional_status: status || undefined, availability: availability || undefined });
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== "page") next.set("page", "1");
    setParams(next);
  };
  const closeForm = () => { setFormDirty(false); setFormPending(false); setOpen(false); };

  return <div className="admin-page">
    <PageHeaderV2 title={t("team")} description={t("professionalDirectory")} action={<Button onClick={() => setOpen(true)}><UserPlus size={18} />{t("addTeamMember")}</Button>} />
    <Tabs selected={role || "ALL"} onSelect={(value) => set("role", value === "ALL" ? "" : value)} tabs={[{ id: "ALL", label: t("all") }, { id: "DOCTOR", label: t("doctors") }, { id: "STAFF", label: t("staff") }]} />
    <DataTableShell title={t("teamMembers")} count={list.data?.count} toolbar={<div className="v2-table-toolbar">
      <input aria-label={t("searchTeam")} placeholder={t("searchNameOrEmail")} value={q} onChange={(event) => set("q", event.target.value)} />
      <select aria-label={t("professionalStatus")} value={status} onChange={(event) => set("professional_status", event.target.value)}><option value="">{t("allStatuses")}</option><option value="ACTIVE">{t("active")}</option><option value="INACTIVE">{t("inactive")}</option></select>
      <select aria-label={t("available")} value={availability} onChange={(event) => set("availability", event.target.value)}><option value="">{t("allAvailability")}</option><option value="AVAILABLE">{t("available")}</option><option value="ON_LEAVE">{t("onLeave")}</option><option value="UNAVAILABLE">{t("unavailable")}</option></select>
    </div>} state={list.isLoading ? <StatePanel state="loading" title={t("loading")} /> : list.isError ? <StatePanel state="error" title={t("error")} description={getErrorMessage(list.error)} action={<Button variant="secondary" onClick={() => void list.refetch()}>{t("retry")}</Button>} /> : undefined}>
      {list.data ? <table><thead><tr><th>{t("professional")}</th><th>{t("role")}</th><th>{t("specialtyOrPosition")}</th><th>{t("contactIdentifiers")}</th><th>{t("status")}</th><th>{t("available")}</th><th>{t("today")}</th><th /></tr></thead><tbody>{list.data.results.map((member) => <ClickableRow key={member.id} onOpen={() => navigate(`/admin/team/${member.id}`)}><td><strong className="bidi-isolate">{member.full_name}</strong><br /><small className="bidi-isolate">{member.account.email}</small></td><td>{member.role === "DOCTOR" ? t("doctors") : t("staff")}</td><td className="bidi-isolate">{member.specialty || member.position || t("notRecorded")}</td><td className="bidi-isolate">{member.phone || t("notRecorded")}</td><td><StatusBadge status={member.professional_status} /></td><td>{member.availability.on_leave ? t("onLeave") : member.availability.availability === "AVAILABLE" ? t("available") : t("unavailable")}</td><td><bdi>{member.today_workload.appointment_count}</bdi></td></ClickableRow>)}</tbody></table> : null}
    </DataTableShell>
    {list.data ? <Pagination page={page} hasPrevious={Boolean(list.data.previous)} hasNext={Boolean(list.data.next)} onPrevious={() => set("page", String(page - 1))} onNext={() => set("page", String(page + 1))} /> : null}
    <Modal open={open} title={t("addTeamMember")} description={t("addProfessional")} onClose={closeForm} dirty={formDirty} pending={formPending}><TeamForm onDirtyChange={setFormDirty} onPendingChange={setFormPending} onClose={closeForm} /></Modal>
  </div>;
}

export function AdminTeamDetailPage() {
  const t = useFeatureT();
  const id = Number(useParams().memberId);
  const detail = useQuery({ queryKey: teamQueryKeys.detail(id), queryFn: () => teamApi.detail(id), enabled: id > 0 });
  const client = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [editDirty, setEditDirty] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusMutation = useMutation({ mutationFn: () => teamApi.setProfessionalStatus(id, { is_active: !(detail.data?.professional_status === "ACTIVE"), version: detail.data?.version ?? 0 }), onSuccess: () => { void client.invalidateQueries({ queryKey: teamQueryKeys.detail(id) }); void client.invalidateQueries({ queryKey: teamQueryKeys.all }); setStatusOpen(false); } });
  const closeEdit = () => { setEditDirty(false); setEditPending(false); setEdit(false); };

  if (detail.isLoading) return <StatePanel state="loading" title={t("loading")} />;
  if (detail.isError || !detail.data) return <StatePanel state="error" title={t("error")} description={detail.error ? getErrorMessage(detail.error) : undefined} />;
  const member = detail.data;
  const roleLabel = member.role === "DOCTOR" ? t("doctors") : t("staff");

  return <div className="admin-page">
    <Link className="inline-back-link" to="/admin/team">{t("backToTeam")}</Link>
    <PageHeaderV2 title={member.full_name} description={`${roleLabel} ${t("professionalRecord")}`} action={<><Button variant="secondary" onClick={() => setStatusOpen(true)}>{member.professional_status === "ACTIVE" ? t("setProfessionalInactive") : t("setProfessionalActive")}</Button><Button onClick={() => setEdit(true)}>{t("editProfile")}</Button></>} />
    <SurfaceCard major><SectionHeading title={t("generalInfo")} /><dl className="detail-grid"><div><dt>{t("role")}</dt><dd>{roleLabel}</dd></div><div><dt>{t("professionalStatus")}</dt><dd><StatusBadge status={member.professional_status} /></dd></div><div><dt>{member.role === "DOCTOR" ? t("specialty") : t("position")}</dt><dd className="bidi-isolate">{member.specialty || member.position || t("notRecorded")}</dd></div><div><dt>{t("phone")}</dt><dd className="bidi-isolate">{member.phone || t("notRecorded")}</dd></div>{member.role === "DOCTOR" && "bio" in member.profile ? <div className="detail-wide"><dt>{t("biography")}</dt><dd className="bidi-isolate">{member.profile.bio || t("notRecorded")}</dd></div> : null}</dl></SurfaceCard>
    <SurfaceCard><SectionHeading title={t("workingHours")} />{member.active_shifts.length ? <ul>{member.active_shifts.map((shift) => <li key={shift.id}><bdi>{shift.name}</bdi>: <bdi>{shift.start_time}–{shift.end_time}</bdi></li>)}</ul> : <StatePanel state="empty" title={t("noActiveShifts")} />}</SurfaceCard>
    <SurfaceCard><SectionHeading title={t("leaveExceptions")} />{member.current_future_leave.length ? <ul>{member.current_future_leave.map((leave) => <li key={leave.id}><bdi>{leave.start_datetime} – {leave.end_datetime}</bdi>: <bdi>{leave.reason || t("noReason")}</bdi></li>)}</ul> : <StatePanel state="empty" title={t("noCurrentLeave")} />}</SurfaceCard>
    <SurfaceCard><SectionHeading title={t("todayAppointments")} />{member.today_appointments.length ? <ul>{member.today_appointments.map((appointment) => <li key={appointment.id}><bdi>{appointment.patient_name}</bdi> · <bdi>{appointment.start_datetime}</bdi> · <StatusBadge status={appointment.status} /></li>)}</ul> : <StatePanel state="empty" title={t("noAppointmentsToday")} />}</SurfaceCard>
    <SurfaceCard><SectionHeading title={t("linkedAccount")} /><p><bdi>{member.account.email}</bdi> · {member.account.is_active ? t("loginActive") : t("loginInactive")}</p><Link className="v2-button secondary" to={`/admin/users/${member.account.id}`}>{t("openUsersAccess")}</Link></SurfaceCard>
    <Modal open={edit} title={`${t("editProfile")}: ${roleLabel}`} onClose={closeEdit} dirty={editDirty} pending={editPending}><TeamForm member={member} onDirtyChange={setEditDirty} onPendingChange={setEditPending} onClose={closeEdit} /></Modal>
    <ConfirmDialog open={statusOpen} title={t("changeProfessionalStatus")} description={t("professionalStatusHelp")} onClose={() => setStatusOpen(false)} pending={statusMutation.isPending}><p>{t("confirmProfessionalStatus")}</p>{statusMutation.error ? <StatePanel state="error" title={t("error")} description={getErrorMessage(statusMutation.error)} /> : null}<Button variant="danger" loading={statusMutation.isPending} onClick={() => statusMutation.mutate()}>{t("confirm")}</Button></ConfirmDialog>
  </div>;
}
