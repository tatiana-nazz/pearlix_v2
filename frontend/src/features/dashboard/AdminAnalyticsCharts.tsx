import type { LanguagePreference } from "../../types/auth";
import type {
  DashboardAppointmentActivityDay,
  DashboardBillingActivityDay,
  DashboardDoctorUtilization,
  DashboardPatientMixWeek,
  DashboardProblemRateWeek,
  DashboardReceivablesAgingBucket,
} from "../../types/dashboard";
import { formatMoney } from "../billing/utils/billing";
import { DashboardSection, SimpleBillingActivityChart } from "./DashboardShared";

const labels = {
  EN: {
    outcomes: "Appointments & outcomes", utilization: "Doctor utilization", patientMix: "New vs returning patients",
    problemRate: "No-show & cancellation rate", aging: "Outstanding receivables aging", billing: "Billed vs collected",
    last30: "Last 30 days", last8: "Last 8 weeks", completed: "Completed", cancelled: "Cancelled", noShow: "No show",
    reschedule: "Needs reschedule", other: "Other scheduled", newPatients: "New", returning: "Returning", booked: "booked",
    available: "available", rate: "problem rate", age0: "0–7 days", age1: "8–30 days", age2: "31–60 days", age3: "60+ days",
  },
  AR: {
    outcomes: "المواعيد والنتائج", utilization: "استفادة وقت الأطباء", patientMix: "المرضى الجدد والعائدون",
    problemRate: "معدل عدم الحضور والإلغاء", aging: "أعمار الذمم المدينة", billing: "المفوتر مقابل المحصل",
    last30: "آخر 30 يوماً", last8: "آخر 8 أسابيع", completed: "مكتمل", cancelled: "ملغى", noShow: "لم يحضر",
    reschedule: "تحتاج إعادة جدولة", other: "مواعيد أخرى", newPatients: "جدد", returning: "عائدون", booked: "محجوز",
    available: "متاح", rate: "معدل المشكلة", age0: "0–7 أيام", age1: "8–30 يوماً", age2: "31–60 يوماً", age3: "60+ يوماً",
  },
} as const;

function shortDate(value: string, language: LanguagePreference) {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function OutcomesChart({ language, days }: { language: LanguagePreference; days: DashboardAppointmentActivityDay[] }) {
  const c = labels[language];
  const totals = days.map((day) => Object.entries(day).reduce((sum, [key, value]) => key === "date" ? sum : sum + Number(value), 0));
  const max = Math.max(1, ...totals);
  return <div className="admin-analytics-outcomes" role="img" aria-label={c.outcomes}>
    <div className="admin-analytics-legend">
      <span className="completed">{c.completed}</span><span className="cancelled">{c.cancelled}</span><span className="no-show">{c.noShow}</span><span className="reschedule">{c.reschedule}</span><span className="other">{c.other}</span>
    </div>
    <div className="admin-analytics-daily-bars">{days.map((day, index) => {
      const completed = day.COMPLETED;
      const cancelled = day.CANCELLED;
      const noShow = day.NO_SHOW;
      const reschedule = day.NEEDS_RESCHEDULE;
      const total = totals[index];
      const other = Math.max(0, total - completed - cancelled - noShow - reschedule);
      const scale = (value: number) => `${(value / max) * 100}%`;
      return <span className="admin-analytics-day" key={day.date} title={`${day.date}: ${total}`}>
        <span className="admin-analytics-stack" aria-hidden="true">
          <i className="other" style={{ blockSize: scale(other) }} /><i className="reschedule" style={{ blockSize: scale(reschedule) }} /><i className="no-show" style={{ blockSize: scale(noShow) }} /><i className="cancelled" style={{ blockSize: scale(cancelled) }} /><i className="completed" style={{ blockSize: scale(completed) }} />
        </span>
        {(index % 5 === 0 || index === days.length - 1) ? <small>{shortDate(day.date, language)}</small> : null}
      </span>;
    })}</div>
  </div>;
}

function UtilizationChart({ language, rows }: { language: LanguagePreference; rows: DashboardDoctorUtilization[] }) {
  const c = labels[language];
  return <div className="admin-analytics-utilization">{rows.map((row) => <div key={row.doctor.id}>
    <header><strong>{row.doctor.full_name}</strong><b>{row.utilization_percent.toFixed(1)}%</b></header>
    <span className="admin-analytics-progress"><i style={{ inlineSize: `${Math.min(100, row.utilization_percent)}%` }} /></span>
    <small>{row.booked_minutes} min {c.booked} · {row.available_minutes} min {c.available}</small>
  </div>)}</div>;
}

function PatientMixChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardPatientMixWeek[] }) {
  const c = labels[language];
  const max = Math.max(1, ...weeks.map((week) => week.new + week.returning));
  return <div className="admin-analytics-weekly">
    <div className="admin-analytics-legend"><span className="new">{c.newPatients}</span><span className="returning">{c.returning}</span></div>
    <div className="admin-analytics-week-bars">{weeks.map((week) => <span key={week.week_start} title={`${week.week_start}: ${c.newPatients} ${week.new}, ${c.returning} ${week.returning}`}>
      <span className="admin-analytics-stack"><i className="returning" style={{ blockSize: `${(week.returning / max) * 100}%` }} /><i className="new" style={{ blockSize: `${(week.new / max) * 100}%` }} /></span>
      <small>{shortDate(week.week_start, language)}</small>
    </span>)}</div>
  </div>;
}

function ProblemRateChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardProblemRateWeek[] }) {
  const c = labels[language];
  const width = 700; const height = 150; const pad = 14;
  const max = Math.max(10, ...weeks.map((week) => week.rate_percent));
  const points = weeks.map((week, index) => {
    const x = weeks.length <= 1 ? width / 2 : pad + (index * (width - pad * 2)) / (weeks.length - 1);
    const y = height - pad - (week.rate_percent / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return <div className="admin-analytics-rate">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.problemRate} preserveAspectRatio="none"><line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} /><polyline points={points} />{weeks.map((week, index) => {
      const x = weeks.length <= 1 ? width / 2 : pad + (index * (width - pad * 2)) / (weeks.length - 1);
      const y = height - pad - (week.rate_percent / max) * (height - pad * 2);
      return <circle key={week.week_start} cx={x} cy={y} r="5"><title>{`${week.week_start}: ${week.rate_percent}% (${week.cancelled} ${c.cancelled}, ${week.no_show} ${c.noShow})`}</title></circle>;
    })}</svg>
    <div className="admin-analytics-rate-labels">{weeks.map((week) => <span key={week.week_start}><b>{week.rate_percent.toFixed(1)}%</b><small>{shortDate(week.week_start, language)}</small></span>)}</div>
  </div>;
}

function AgingChart({ language, rows }: { language: LanguagePreference; rows: DashboardReceivablesAgingBucket[] }) {
  const c = labels[language];
  const bucketName = { "0_7": c.age0, "8_30": c.age1, "31_60": c.age2, "60_plus": c.age3 } as const;
  const values = rows.flatMap((row) => [Number(row.USD), Number(row.SYP)]);
  const max = Math.max(1, ...values);
  return <div className="admin-analytics-aging">{rows.map((row) => <div key={row.bucket}>
    <strong>{bucketName[row.bucket]}</strong>
    <span><small>USD</small><i><b style={{ inlineSize: `${(Number(row.USD) / max) * 100}%` }} /></i><em>{formatMoney(row.USD, "USD")}</em></span>
    <span><small>SYP</small><i><b style={{ inlineSize: `${(Number(row.SYP) / max) * 100}%` }} /></i><em>{formatMoney(row.SYP, "SYP")}</em></span>
  </div>)}</div>;
}

export function AdminAnalyticsCharts({ language, outcomes, utilization, billing, patientMix, problemRate, aging }: {
  language: LanguagePreference;
  outcomes: DashboardAppointmentActivityDay[];
  utilization: DashboardDoctorUtilization[];
  billing: DashboardBillingActivityDay[];
  patientMix: DashboardPatientMixWeek[];
  problemRate: DashboardProblemRateWeek[];
  aging: DashboardReceivablesAgingBucket[];
}) {
  const c = labels[language];
  return <div className="admin-analytics-grid">
    <DashboardSection title={c.outcomes} eyebrow={c.last30} className="admin-analytics-wide"><OutcomesChart language={language} days={outcomes} /></DashboardSection>
    <DashboardSection title={c.utilization} eyebrow={c.last30}><UtilizationChart language={language} rows={utilization} /></DashboardSection>
    <DashboardSection title={c.billing} eyebrow={c.last30}><SimpleBillingActivityChart language={language} days={billing} /></DashboardSection>
    <DashboardSection title={c.patientMix} eyebrow={c.last8}><PatientMixChart language={language} weeks={patientMix} /></DashboardSection>
    <DashboardSection title={c.problemRate} eyebrow={c.last8}><ProblemRateChart language={language} weeks={problemRate} /></DashboardSection>
    <DashboardSection title={c.aging}><AgingChart language={language} rows={aging} /></DashboardSection>
  </div>;
}
