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
import { DashboardSection } from "./DashboardShared";

const palette = {
  blue: "#5B8FF9",
  teal: "#5AD8A6",
  green: "#5FC27E",
  amber: "#F6BD16",
  orange: "#F6903D",
  red: "#E8684A",
  rose: "#E66A8E",
  violet: "#9270CA",
  grid: "rgba(148, 163, 184, 0.16)",
  axis: "rgba(203, 213, 225, 0.64)",
  muted: "rgba(203, 213, 225, 0.72)",
} as const;

const labels = {
  EN: {
    outcomes: "Appointments & outcomes", utilization: "Doctor utilization", patientMix: "New vs returning patients",
    problemRate: "No-show & cancellation rate", aging: "Outstanding receivables aging", billing: "Billed vs collected",
    last30: "Last 30 days", last8: "Last 8 weeks", completed: "Completed", cancelled: "Cancelled", noShow: "No show",
    reschedule: "Needs reschedule", other: "Other scheduled", newPatients: "New", returning: "Returning", booked: "booked",
    available: "available", age0: "0–7 days", age1: "8–30 days", age2: "31–60 days", age3: "60+ days",
    billed: "Billed", collected: "Collected", appointments: "appointments", ofCapacity: "of available clinical time",
  },
  AR: {
    outcomes: "المواعيد والنتائج", utilization: "استفادة وقت الأطباء", patientMix: "المرضى الجدد والعائدون",
    problemRate: "معدل عدم الحضور والإلغاء", aging: "أعمار الذمم المدينة", billing: "المفوتر مقابل المحصل",
    last30: "آخر 30 يوماً", last8: "آخر 8 أسابيع", completed: "مكتمل", cancelled: "ملغى", noShow: "لم يحضر",
    reschedule: "تحتاج إعادة جدولة", other: "مواعيد أخرى", newPatients: "جدد", returning: "عائدون", booked: "محجوز",
    available: "متاح", age0: "0–7 أيام", age1: "8–30 يوماً", age2: "31–60 يوماً", age3: "60+ يوماً",
    billed: "المفوتر", collected: "المحصل", appointments: "موعد", ofCapacity: "من وقت العيادة المتاح",
  },
} as const;

function shortDate(value: string, language: LanguagePreference) {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * power;
}

function ticks(max: number, count = 4) {
  return Array.from({ length: count + 1 }, (_, index) => (max * index) / count);
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return <div className="analytics-legend">{items.map((item) => (
    <span key={item.label}><i style={{ backgroundColor: item.color }} />{item.label}</span>
  ))}</div>;
}

function OutcomesChart({ language, days }: { language: LanguagePreference; days: DashboardAppointmentActivityDay[] }) {
  const c = labels[language];
  const width = 980;
  const height = 300;
  const margin = { top: 14, right: 20, bottom: 42, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totals = days.map((day) => Object.entries(day).reduce((sum, [key, value]) => key === "date" ? sum : sum + Number(value), 0));
  const yMax = niceMax(Math.max(1, ...totals));
  const band = plotWidth / Math.max(days.length, 1);
  const barWidth = Math.max(5, Math.min(22, band * 0.72));
  const series = [
    { key: "COMPLETED", label: c.completed, color: palette.green },
    { key: "CANCELLED", label: c.cancelled, color: palette.red },
    { key: "NO_SHOW", label: c.noShow, color: palette.rose },
    { key: "NEEDS_RESCHEDULE", label: c.reschedule, color: palette.amber },
    { key: "OTHER", label: c.other, color: palette.blue },
  ] as const;

  return <div className="analytics-chart-block">
    <Legend items={series.map(({ label, color }) => ({ label, color }))} />
    <svg className="analytics-svg analytics-svg-wide" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.outcomes}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 10} y={y + 4} textAnchor="end">{Math.round(tick)}</text>
        </g>;
      })}
      {days.map((day, index) => {
        const total = totals[index];
        const values = {
          COMPLETED: Number(day.COMPLETED),
          CANCELLED: Number(day.CANCELLED),
          NO_SHOW: Number(day.NO_SHOW),
          NEEDS_RESCHEDULE: Number(day.NEEDS_RESCHEDULE),
          OTHER: Math.max(0, total - Number(day.COMPLETED) - Number(day.CANCELLED) - Number(day.NO_SHOW) - Number(day.NEEDS_RESCHEDULE)),
        };
        let cumulative = 0;
        const x = margin.left + index * band + (band - barWidth) / 2;
        return <g key={day.date}>
          <title>{`${day.date}: ${total} ${c.appointments}`}</title>
          {series.map((item) => {
            const value = values[item.key];
            const rectHeight = (value / yMax) * plotHeight;
            cumulative += value;
            const y = margin.top + plotHeight - (cumulative / yMax) * plotHeight;
            return value > 0 ? <rect key={item.key} x={x} y={y} width={barWidth} height={rectHeight} rx="2" fill={item.color} /> : null;
          })}
          {(index % 5 === 0 || index === days.length - 1) ? (
            <text className="analytics-axis-label" x={x + barWidth / 2} y={height - 14} textAnchor="middle">{shortDate(day.date, language)}</text>
          ) : null}
        </g>;
      })}
    </svg>
  </div>;
}

function UtilizationChart({ language, rows }: { language: LanguagePreference; rows: DashboardDoctorUtilization[] }) {
  const c = labels[language];
  const visible = rows.slice(0, 8);
  const width = 620;
  const rowHeight = 42;
  const height = 42 + Math.max(1, visible.length) * rowHeight;
  const margin = { top: 18, right: 38, bottom: 28, left: 168 };
  const plotWidth = width - margin.left - margin.right;

  return <div className="analytics-chart-block">
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.utilization}>
      {[0, 25, 50, 75, 100].map((tick) => {
        const x = margin.left + (tick / 100) * plotWidth;
        return <g key={tick}>
          <line className="analytics-gridline" x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} />
          <text className="analytics-axis-label" x={x} y={height - 8} textAnchor="middle">{tick}%</text>
        </g>;
      })}
      {visible.map((row, index) => {
        const y = margin.top + index * rowHeight + 8;
        const barHeight = 16;
        const value = Math.min(100, Math.max(0, row.utilization_percent));
        return <g key={row.doctor.id}>
          <title>{`${row.doctor.full_name}: ${row.booked_minutes} min ${c.booked}, ${row.available_minutes} min ${c.available}`}</title>
          <text className="analytics-doctor-label" x={margin.left - 12} y={y + 12} textAnchor="end">{row.doctor.full_name}</text>
          <rect className="analytics-track" x={margin.left} y={y} width={plotWidth} height={barHeight} rx="5" />
          <rect x={margin.left} y={y} width={(value / 100) * plotWidth} height={barHeight} rx="5" fill={palette.teal} />
          <text className="analytics-value-label" x={margin.left + plotWidth + 10} y={y + 12}>{row.utilization_percent.toFixed(1)}%</text>
        </g>;
      })}
    </svg>
    <p className="analytics-caption">{c.ofCapacity}</p>
  </div>;
}

function BillingMiniChart({ language, currency, days }: { language: LanguagePreference; currency: "USD" | "SYP"; days: DashboardBillingActivityDay[] }) {
  const c = labels[language];
  const width = 500;
  const height = 250;
  const margin = { top: 18, right: 18, bottom: 36, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const billed = days.map((day) => Number(day[currency].billed));
  const collected = days.map((day) => Number(day[currency].collected));
  const yMax = niceMax(Math.max(1, ...billed, ...collected));
  const point = (value: number, index: number) => {
    const x = margin.left + (index / Math.max(1, days.length - 1)) * plotWidth;
    const y = margin.top + plotHeight - (value / yMax) * plotHeight;
    return [x, y] as const;
  };
  const billedPoints = billed.map((value, index) => point(value, index).join(",")).join(" ");
  const collectedPoints = collected.map((value, index) => point(value, index).join(",")).join(" ");
  const billedTotal = billed.reduce((sum, value) => sum + value, 0);
  const collectedTotal = collected.reduce((sum, value) => sum + value, 0);

  return <div className="analytics-billing-panel">
    <header><strong>{currency}</strong><span>{formatMoney(billedTotal, currency)} / {formatMoney(collectedTotal, currency)}</span></header>
    <Legend items={[{ label: c.billed, color: palette.blue }, { label: c.collected, color: palette.teal }]} />
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${currency} ${c.billing}`}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 10} y={y + 4} textAnchor="end">{compactNumber(tick)}</text>
        </g>;
      })}
      <polyline className="analytics-line analytics-line-blue" points={billedPoints} />
      <polyline className="analytics-line analytics-line-teal" points={collectedPoints} />
      {days.map((day, index) => {
        if (index % 6 !== 0 && index !== days.length - 1) return null;
        const [x] = point(0, index);
        return <text key={day.date} className="analytics-axis-label" x={x} y={height - 10} textAnchor="middle">{shortDate(day.date, language)}</text>;
      })}
    </svg>
  </div>;
}

function BillingChart({ language, days }: { language: LanguagePreference; days: DashboardBillingActivityDay[] }) {
  return <div className="analytics-billing-grid">
    <BillingMiniChart language={language} currency="USD" days={days} />
    <BillingMiniChart language={language} currency="SYP" days={days} />
  </div>;
}

function PatientMixChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardPatientMixWeek[] }) {
  const c = labels[language];
  const width = 620;
  const height = 280;
  const margin = { top: 18, right: 18, bottom: 44, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totals = weeks.map((week) => week.new + week.returning);
  const yMax = niceMax(Math.max(1, ...totals));
  const band = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.min(42, band * 0.54);

  return <div className="analytics-chart-block">
    <Legend items={[{ label: c.newPatients, color: palette.teal }, { label: c.returning, color: palette.violet }]} />
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.patientMix}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 9} y={y + 4} textAnchor="end">{Math.round(tick)}</text>
        </g>;
      })}
      {weeks.map((week, index) => {
        const x = margin.left + index * band + (band - barWidth) / 2;
        const returningHeight = (week.returning / yMax) * plotHeight;
        const newHeight = (week.new / yMax) * plotHeight;
        const bottom = margin.top + plotHeight;
        return <g key={week.week_start}>
          <title>{`${week.week_start}: ${c.newPatients} ${week.new}, ${c.returning} ${week.returning}`}</title>
          <rect x={x} y={bottom - returningHeight} width={barWidth} height={returningHeight} fill={palette.violet} rx="3" />
          <rect x={x} y={bottom - returningHeight - newHeight} width={barWidth} height={newHeight} fill={palette.teal} rx="3" />
          <text className="analytics-axis-label" x={x + barWidth / 2} y={height - 13} textAnchor="middle">{shortDate(week.week_start, language)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function ProblemRateChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardProblemRateWeek[] }) {
  const c = labels[language];
  const width = 620;
  const height = 280;
  const margin = { top: 18, right: 18, bottom: 44, left: 46 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMax = Math.max(20, niceMax(Math.max(1, ...weeks.map((week) => week.rate_percent))));
  const coords = weeks.map((week, index) => {
    const x = margin.left + (index / Math.max(1, weeks.length - 1)) * plotWidth;
    const y = margin.top + plotHeight - (week.rate_percent / yMax) * plotHeight;
    return { x, y, week };
  });
  const linePoints = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = coords.length ? `${margin.left},${margin.top + plotHeight} ${linePoints} ${margin.left + plotWidth},${margin.top + plotHeight}` : "";

  return <div className="analytics-chart-block">
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.problemRate}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 9} y={y + 4} textAnchor="end">{Math.round(tick)}%</text>
        </g>;
      })}
      <polygon className="analytics-area" points={areaPoints} />
      <polyline className="analytics-line analytics-line-violet" points={linePoints} />
      {coords.map(({ x, y, week }) => <g key={week.week_start}>
        <circle className="analytics-point" cx={x} cy={y} r="4.5"><title>{`${week.week_start}: ${week.rate_percent}% · ${week.cancelled} ${c.cancelled}, ${week.no_show} ${c.noShow}`}</title></circle>
        <text className="analytics-value-label" x={x} y={Math.max(14, y - 10)} textAnchor="middle">{week.rate_percent.toFixed(1)}%</text>
        <text className="analytics-axis-label" x={x} y={height - 13} textAnchor="middle">{shortDate(week.week_start, language)}</text>
      </g>)}
    </svg>
  </div>;
}

function AgingCurrencyChart({ currency, rows, bucketName }: {
  currency: "USD" | "SYP";
  rows: DashboardReceivablesAgingBucket[];
  bucketName: Record<DashboardReceivablesAgingBucket["bucket"], string>;
}) {
  const width = 500;
  const height = 210;
  const margin = { top: 12, right: 94, bottom: 18, left: 92 };
  const plotWidth = width - margin.left - margin.right;
  const rowHeight = 42;
  const values = rows.map((row) => Number(row[currency]));
  const max = niceMax(Math.max(1, ...values));

  return <div className="analytics-aging-panel">
    <strong>{currency}</strong>
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${currency} receivables aging`}>
      {rows.map((row, index) => {
        const y = margin.top + index * rowHeight + 7;
        const value = Number(row[currency]);
        return <g key={row.bucket}>
          <title>{`${bucketName[row.bucket]}: ${formatMoney(value, currency)}`}</title>
          <text className="analytics-axis-label analytics-axis-label-strong" x={margin.left - 10} y={y + 13} textAnchor="end">{bucketName[row.bucket]}</text>
          <rect className="analytics-track" x={margin.left} y={y} width={plotWidth} height="17" rx="5" />
          <rect x={margin.left} y={y} width={(value / max) * plotWidth} height="17" rx="5" fill={currency === "USD" ? palette.blue : palette.teal} />
          <text className="analytics-value-label" x={margin.left + plotWidth + 10} y={y + 13}>{formatMoney(value, currency)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function AgingChart({ language, rows }: { language: LanguagePreference; rows: DashboardReceivablesAgingBucket[] }) {
  const c = labels[language];
  const bucketName = { "0_7": c.age0, "8_30": c.age1, "31_60": c.age2, "60_plus": c.age3 } as const;
  return <div className="analytics-aging-grid">
    <AgingCurrencyChart currency="USD" rows={rows} bucketName={bucketName} />
    <AgingCurrencyChart currency="SYP" rows={rows} bucketName={bucketName} />
  </div>;
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
    <DashboardSection title={c.billing} eyebrow={c.last30}><BillingChart language={language} days={billing} /></DashboardSection>
    <DashboardSection title={c.patientMix} eyebrow={c.last8}><PatientMixChart language={language} weeks={patientMix} /></DashboardSection>
    <DashboardSection title={c.problemRate} eyebrow={c.last8}><ProblemRateChart language={language} weeks={problemRate} /></DashboardSection>
    <DashboardSection title={c.aging} className="admin-analytics-wide"><AgingChart language={language} rows={aging} /></DashboardSection>
  </div>;
}
