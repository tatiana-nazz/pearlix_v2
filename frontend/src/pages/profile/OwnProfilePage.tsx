import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../api/endpoints/schedule";
import { useAuthStore } from "../../auth/authStore";
import { StatePanel, StatusBadge, SurfaceCard } from "../../components/v2";
import { formatClock, formatDateRange, formatWeekday } from "../../utils/dates";
import { displayText } from "../../utils/formatters";

const copy = {
  EN: {
    title: "Profile",
    description: "View your clinic account and schedule information.",
    profile: "Profile information",
    fullName: "Full name",
    email: "Email",
    role: "Role",
    status: "Status",
    active: "Active",
    password: "Password",
    passwordChange: "Password change required",
    passwordCurrent: "Password current",
    workingHours: "Working hours / shifts",
    leave: "Leave exceptions",
    noShifts: "No working shifts have been assigned.",
    noLeave: "No leave or unavailable periods were returned.",
    loadingShifts: "Loading working hours",
    loadingLeave: "Loading leave exceptions",
    unavailable: "Profile schedule information is unavailable",
    retry: "Retry",
    noReason: "No reason recorded",
  },
  AR: {
    title: "الملف الشخصي",
    description: "اعرض معلومات حساب العيادة وجدول العمل.",
    profile: "معلومات الملف الشخصي",
    fullName: "الاسم الكامل",
    email: "البريد الإلكتروني",
    role: "الدور",
    status: "الحالة",
    active: "نشط",
    password: "كلمة المرور",
    passwordChange: "يجب تغيير كلمة المرور",
    passwordCurrent: "كلمة المرور محدثة",
    workingHours: "ساعات العمل والمناوبات",
    leave: "استثناءات الإجازة",
    noShifts: "لم يتم تعيين ساعات عمل.",
    noLeave: "لا توجد إجازات أو فترات عدم توفر.",
    loadingShifts: "جارٍ تحميل ساعات العمل",
    loadingLeave: "جارٍ تحميل استثناءات الإجازة",
    unavailable: "معلومات جدول الملف الشخصي غير متاحة",
    retry: "إعادة المحاولة",
    noReason: "لا يوجد سبب مسجل",
  },
} as const;

export function OwnProfilePage() {
  const user = useAuthStore((state) => state.user);
  const language = user?.language_preference ?? "EN";
  const c = copy[language];
  const hasProfessionalProfile = user?.role === "STAFF" || user?.role === "DOCTOR";
  const shifts = useQuery({
    queryKey: ["my-working-shifts"],
    queryFn: () => scheduleApi.workingShifts(),
    enabled: hasProfessionalProfile,
  });
  const leave = useQuery({
    queryKey: ["my-availability-exceptions"],
    queryFn: () => scheduleApi.availabilityExceptions({ page: 1 }),
    enabled: hasProfessionalProfile,
  });

  if (!user) return null;
  const initials = user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className="profile-page-v3">
      <header className="profile-page-v3-header">
        <h1>{c.title}</h1>
        <p>{c.description}</p>
      </header>
      <div className="profile-page-v3-grid">
        <SurfaceCard className="profile-information-card">
          <span className="profile-initials" aria-hidden="true">{initials || "P"}</span>
          <h2>{c.profile}</h2>
          <dl className="detail-grid">
            <div><dt>{c.fullName}</dt><dd>{user.full_name}</dd></div>
            <div><dt>{c.email}</dt><dd dir="ltr">{user.email}</dd></div>
            <div><dt>{c.role}</dt><dd>{user.role}</dd></div>
            <div><dt>{c.status}</dt><dd><StatusBadge status={c.active} /></dd></div>
            <div className="detail-wide"><dt>{c.password}</dt><dd>{user.must_change_password ? c.passwordChange : c.passwordCurrent}</dd></div>
          </dl>
        </SurfaceCard>

        {hasProfessionalProfile ? (
          <SurfaceCard className="profile-schedule-card">
            <h2>{c.workingHours}</h2>
            {shifts.isLoading ? <StatePanel state="loading" title={c.loadingShifts} /> : null}
            {shifts.isError ? <StatePanel state="error" title={c.unavailable} action={<button className="v2-button secondary" type="button" onClick={() => void shifts.refetch()}>{c.retry}</button>} /> : null}
            {shifts.data ? (
              shifts.data.results.length ? (
                <div className="profile-shift-matrix">
                  {shifts.data.results.map((shift) => (
                    <div key={shift.id}>
                      <strong>{formatWeekday(shift.weekday)}</strong>
                      <span>{shift.name}</span>
                      <span dir="ltr">{formatClock(shift.start_time)} – {formatClock(shift.end_time)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="panel-note">{c.noShifts}</p>
            ) : null}
          </SurfaceCard>
        ) : null}

        {hasProfessionalProfile ? (
          <SurfaceCard className="profile-leave-card">
            <h2>{c.leave}</h2>
            {leave.isLoading ? <StatePanel state="loading" title={c.loadingLeave} /> : null}
            {leave.isError ? <StatePanel state="error" title={c.unavailable} action={<button className="v2-button secondary" type="button" onClick={() => void leave.refetch()}>{c.retry}</button>} /> : null}
            {leave.data ? (
              leave.data.results.length ? (
                <ul className="profile-leave-list">
                  {leave.data.results.map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{formatDateRange(item.start_datetime, item.end_datetime)}</strong>
                        <span>{displayText(item.reason, c.noReason)}</span>
                      </div>
                      <StatusBadge status={item.is_cancelled ? "CANCELLED" : item.type} />
                    </li>
                  ))}
                </ul>
              ) : <p className="panel-note">{c.noLeave}</p>
            ) : null}
          </SurfaceCard>
        ) : null}
      </div>
    </main>
  );
}
