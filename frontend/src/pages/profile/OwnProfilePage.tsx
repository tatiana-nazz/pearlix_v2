import { useQuery } from "@tanstack/react-query";

import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import { scheduleApi } from "../../api/endpoints/schedule";
import { useAuthStore } from "../../auth/authStore";
import { StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { LeaveExceptionsTable } from "../../features/schedule/components/LeaveExceptionsTable";
import { ScheduleMatrix } from "../../features/schedule/components/ScheduleMatrix";

const copy = {
  EN: {
    title: "Profile", description: "View your clinic account and schedule information.", profile: "Profile information", fullName: "Full name", email: "Email", role: "Role", status: "Status", active: "Active", password: "Password", passwordChange: "Password change required", passwordCurrent: "Password current", workingHours: "Working hours / shifts", leave: "Leave exceptions", noShifts: "No working shifts have been assigned.", noLeave: "No leave or unavailable periods were returned.", loadingShifts: "Loading working hours", loadingLeave: "Loading leave exceptions", unavailable: "Profile schedule information is unavailable", retry: "Retry", noReason: "No reason recorded",
  },
  AR: {
    title: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a", description: "\u0627\u0639\u0631\u0636 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u064a\u0627\u062f\u0629 \u0648\u062c\u062f\u0648\u0644 \u0627\u0644\u0639\u0645\u0644.", profile: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a", fullName: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644", email: "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a", role: "\u0627\u0644\u062f\u0648\u0631", status: "\u0627\u0644\u062d\u0627\u0644\u0629", active: "\u0646\u0634\u0637", password: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", passwordChange: "\u064a\u062c\u0628 \u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", passwordCurrent: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u062d\u062f\u062b\u0629", workingHours: "\u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062a", leave: "\u0627\u0633\u062a\u062b\u0646\u0627\u0621\u0627\u062a \u0627\u0644\u0625\u062c\u0627\u0632\u0629", noShifts: "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0639\u064a\u064a\u0646 \u0633\u0627\u0639\u0627\u062a \u0639\u0645\u0644.", noLeave: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u062c\u0627\u0632\u0627\u062a \u0623\u0648 \u0641\u062a\u0631\u0627\u062a \u0639\u062f\u0645 \u062a\u0648\u0641\u0631.", loadingShifts: "\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644", loadingLeave: "\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0633\u062a\u062b\u0646\u0627\u0621\u0627\u062a \u0627\u0644\u0625\u062c\u0627\u0632\u0629", unavailable: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u062c\u062f\u0648\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062e\u0635\u064a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629", retry: "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629", noReason: "\u0644\u0627 \u064a\u0648\u062c\u062f \u0633\u0628\u0628 \u0645\u0633\u062c\u0644",
  },
} as const;

export function OwnProfilePage() {
  const user = useAuthStore((state) => state.user);
  const language = user?.language_preference ?? "EN";
  const c = copy[language];
  const hasProfessionalProfile = user?.role === "STAFF" || user?.role === "DOCTOR";
  const clinicSettings = useQuery({ queryKey: clinicSettingsQueryKey, queryFn: clinicApi.getSettings, enabled: hasProfessionalProfile, staleTime: 300_000 });
  const shifts = useQuery({ queryKey: ["my-working-shifts"], queryFn: () => scheduleApi.workingShifts(), enabled: hasProfessionalProfile });
  const leave = useQuery({
    queryKey: ["my-availability-exceptions"],
    queryFn: () => scheduleApi.availabilityExceptions({ page: 1, ...(user?.role === "STAFF" ? { staff_id: user.id } : { doctor_id: user?.id }) }),
    enabled: hasProfessionalProfile,
  });

  if (!user) return null;
  const initials = user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="profile-page-v3">
    <header className="profile-page-v3-header"><h1>{c.title}</h1><p>{c.description}</p></header>
    <div className="profile-page-v3-grid">
      <SurfaceCard className="profile-information-card">
        <span className="profile-initials" aria-hidden="true">{initials || "P"}</span>
        <h2>{c.profile}</h2>
        <dl className="detail-grid"><div><dt>{c.fullName}</dt><dd>{user.full_name}</dd></div><div><dt>{c.email}</dt><dd dir="ltr">{user.email}</dd></div><div><dt>{c.role}</dt><dd>{user.role}</dd></div><div><dt>{c.status}</dt><dd><StatusBadge status="ACTIVE" label={c.active} /></dd></div><div className="detail-wide"><dt>{c.password}</dt><dd>{user.must_change_password ? c.passwordChange : c.passwordCurrent}</dd></div></dl>
      </SurfaceCard>
      {hasProfessionalProfile ? <div className="profile-professional-column">
        <SurfaceCard className="profile-schedule-card">
          <h2>{c.workingHours}</h2>
          {shifts.isLoading ? <StatePanel state="loading" title={c.loadingShifts} /> : null}
          {shifts.isError ? <StatePanel state="error" title={c.unavailable} action={<button className="v2-button secondary" type="button" onClick={() => void shifts.refetch()}>{c.retry}</button>} /> : null}
          {shifts.data ? <ScheduleMatrix shifts={shifts.data.results} language={language} emptyText={c.noShifts} weeklyClosedDays={clinicSettings.data?.weekly_closed_days} /> : null}
        </SurfaceCard>
        <SurfaceCard className="profile-leave-card">
          <h2>{c.leave}</h2>
          {leave.isLoading ? <StatePanel state="loading" title={c.loadingLeave} /> : null}
          {leave.isError ? <StatePanel state="error" title={c.unavailable} action={<button className="v2-button secondary" type="button" onClick={() => void leave.refetch()}>{c.retry}</button>} /> : null}
          {leave.data ? <LeaveExceptionsTable items={leave.data.results} language={language} emptyText={c.noLeave} noReason={c.noReason} /> : null}
        </SurfaceCard>
      </div> : null}
    </div>
  </div>;
}
