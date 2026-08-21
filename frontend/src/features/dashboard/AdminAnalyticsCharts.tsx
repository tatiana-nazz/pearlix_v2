import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

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
  red: "#E8684A",
  rose: "#E66A8E",
  violet: "#9270CA",
} as const;

const finiteNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const safePercent = (value: unknown) => Math.min(100, Math.max(0, finiteNumber(value)));

const labels = {
  EN: {
    outcomes: "Appointments & outcomes",
    utilization: "Doctor utilization",
    patientMix: "New vs returning patients",
    problemRate: "No-show & cancellation rate",
    aging: "Outstanding receivables aging",
    billing: "Billed vs collected",
    last30: "Last 30 days",
    last8: "Last 8 weeks",
    completed: "Completed",
    cancelled: "Cancelled",
    noShow: "No show",
    reschedule: "Needs reschedule",
    other: "Other scheduled",
    newPatients: "New",
    returning: "Returning",
    booked: "booked",
    available: "available",
    age0: "0–7 days",
    age1: "8–30 days",
    age2: "31–60 days",
    age3: "60+ days",
    billed: "Billed",
    collected: "Collected",
    appointments: "appointments",
    ofCapacity: "of available clinical time",
    hoverHint: "Hover or focus the chart for exact values.",
    clickDay: "Click a day to open its schedule.",
    collectionRate: "Collection rate",
    difference: "Gap",
    scheduled: "Scheduled",
  },
  AR: {
    outcomes: "المواعيد والنتائج",
    utilization: "استفادة وقت الأطباء",
    patientMix: "المرضى الجدد والعائدون",
    problemRate: "معدل عدم الحضور والإلغاء",
    aging: "أعمار الذمم المدينة",
    billing: "المفوتر مقابل المحصل",
    last30: "آخر 30 يوماً",
    last8: "آخر 8 أسابيع",
    completed: "مكتمل",
    cancelled: "ملغى",
    noShow: "لم يحضر",
    reschedule: "تحتاج إعادة جدولة",
    other: "مواعيد أخرى",
    newPatients: "جدد",
    returning: "عائدون",
    booked: "محجوز",
    available: "متاح",
    age0: "0–7 أيام",
    age1: "8–30 يوماً",
    age2: "31–60 يوماً",
    age3: "60+ يوماً",
    billed: "المفوتر",
    collected: "المحصل",
    appointments: "موعد",
    ofCapacity: "من وقت العيادة المتاح",
    hoverHint: "مرر المؤشر أو ركّز على الرسم لعرض القيم الدقيقة.",
    clickDay: "انقر على يوم لفتح جدوله.",
    collectionRate: "معدل التحصيل",
    difference: "الفجوة",
    scheduled: "المجدول",
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

function InteractiveLegend({ items, active, onToggle }: {
  items: Array<{ key: string; label: string; color: string }>;
  active: Partial<Record<string, boolean>>;
  onToggle: (key: string) => void;
}) {
  return <div className="analytics-legend analytics-legend-interactive" aria-label="Chart series controls">
    {items.map((item) => (
      <button type="button" key={item.key} className={active[item.key] ? "active" : "muted"} aria-pressed={active[item.key]} onClick={() => onToggle(item.key)}>
        <i style={{ backgroundColor: item.color }} />{item.label}
      </button>
    ))}
  </div>;
}

function ChartReadout({ children }: { children: ReactNode }) {
  return <div className="analytics-readout" aria-live="polite">{children}</div>;
}

function OutcomesChart({ language, days }: { language: LanguagePreference; days: DashboardAppointmentActivityDay[] }) {
  const c = labels[language];
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 1120;
  const height = 370;
  const margin = { top: 18, right: 22, bottom: 48, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totals = days.map((day) => Object.entries(day).reduce((sum, [key, value]) => key === "date" ? sum : sum + Number(value), 0));
  const yMax = niceMax(Math.max(1, ...totals));
  const band = plotWidth / Math.max(days.length, 1);
  const barWidth = Math.max(8, Math.min(28, band * 0.72));
  const series = [
    { key: "COMPLETED", label: c.completed, color: palette.green },
    { key: "CANCELLED", label: c.cancelled, color: palette.red },
    { key: "NO_SHOW", label: c.noShow, color: palette.rose },
    { key: "NEEDS_RESCHEDULE", label: c.reschedule, color: palette.amber },
    { key: "OTHER", label: c.other, color: palette.blue },
  ] as const;
  const activeDay = activeIndex === null ? null : days[activeIndex];
  const activeTotal = activeIndex === null ? 0 : totals[activeIndex];
  const activeOther = activeDay ? Math.max(0, activeTotal - Number(activeDay.COMPLETED) - Number(activeDay.CANCELLED) - Number(activeDay.NO_SHOW) - Number(activeDay.NEEDS_RESCHEDULE)) : 0;

  function openDay(index: number) {
    navigate(`/admin/appointments/day?date=${days[index].date}`);
  }

  return <div className="analytics-chart-block analytics-interactive-chart">
    <Legend items={series.map(({ label, color }) => ({ label, color }))} />
    <ChartReadout>
      {activeDay ? <>
        <strong>{shortDate(activeDay.date, language)}</strong>
        <span>{activeTotal} {c.appointments}</span>
        <span>{c.completed}: {activeDay.COMPLETED}</span>
        <span>{c.cancelled}: {activeDay.CANCELLED}</span>
        <span>{c.noShow}: {activeDay.NO_SHOW}</span>
        <span>{c.reschedule}: {activeDay.NEEDS_RESCHEDULE}</span>
        <span>{c.other}: {activeOther}</span>
      </> : <><span>{c.hoverHint}</span><span>{c.clickDay}</span></>}
    </ChartReadout>
    <svg className="analytics-svg analytics-svg-wide" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.outcomes}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 11} y={y + 5} textAnchor="end">{Math.round(tick)}</text>
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
        return <g
          key={day.date}
          className={`analytics-outcome-day${activeIndex === index ? " active" : ""}`}
          tabIndex={0}
          role="button"
          aria-label={`${day.date}: ${total} ${c.appointments}`}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(index)}
          onBlur={() => setActiveIndex(null)}
          onClick={() => openDay(index)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDay(index);
            }
          }}
        >
          <rect className="analytics-hit-target" x={margin.left + index * band} y={margin.top} width={band} height={plotHeight} />
          {series.map((item) => {
            const value = values[item.key];
            const rectHeight = (value / yMax) * plotHeight;
            cumulative += value;
            const y = margin.top + plotHeight - (cumulative / yMax) * plotHeight;
            return value > 0 ? <rect key={item.key} x={x} y={y} width={barWidth} height={rectHeight} rx="2.5" fill={item.color} /> : null;
          })}
          {(index % 4 === 0 || index === days.length - 1) ? <text className="analytics-axis-label" x={x + barWidth / 2} y={height - 15} textAnchor="middle">{shortDate(day.date, language)}</text> : null}
        </g>;
      })}
    </svg>
  </div>;
}

function UtilizationChart({ language, rows }: { language: LanguagePreference; rows: DashboardDoctorUtilization[] }) {
  const c = labels[language];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visible = rows.slice(0, 8);
  const width = 820;
  const rowHeight = 50;
  const height = 46 + Math.max(1, visible.length) * rowHeight;
  const margin = { top: 20, right: 58, bottom: 34, left: 210 };
  const plotWidth = width - margin.left - margin.right;
  const active = activeIndex === null ? null : visible[activeIndex];

  return <div className="analytics-chart-block analytics-interactive-chart">
    <ChartReadout>
      {active ? <>
        <strong>{active.doctor.full_name}</strong>
        <span>{safePercent(active.utilization_percent).toFixed(1)}%</span>
        <span>{active.booked_minutes} min {c.booked}</span>
        <span>{active.available_minutes} min {c.available}</span>
      </> : <span>{c.hoverHint}</span>}
    </ChartReadout>
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.utilization}>
      {[0, 25, 50, 75, 100].map((tick) => {
        const x = margin.left + (tick / 100) * plotWidth;
        return <g key={tick}>
          <line className="analytics-gridline" x1={x} x2={x} y1={margin.top} y2={height - margin.bottom} />
          <text className="analytics-axis-label" x={x} y={height - 10} textAnchor="middle">{tick}%</text>
        </g>;
      })}
      {visible.map((row, index) => {
        const y = margin.top + index * rowHeight + 9;
        const barHeight = 20;
        const value = safePercent(row.utilization_percent);
        return <g key={row.doctor.id} className={`analytics-hover-row${activeIndex === index ? " active" : ""}`} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
          <text className="analytics-doctor-label" x={margin.left - 14} y={y + 15} textAnchor="end">{row.doctor.full_name}</text>
          <rect className="analytics-track" x={margin.left} y={y} width={plotWidth} height={barHeight} rx="6" />
          <rect className="analytics-data-bar" x={margin.left} y={y} width={(value / 100) * plotWidth} height={barHeight} rx="6" fill={palette.teal} />
          <text className="analytics-value-label" x={margin.left + plotWidth + 12} y={y + 15}>{value.toFixed(1)}%</text>
        </g>;
      })}
    </svg>
    <p className="analytics-caption">{c.ofCapacity}</p>
  </div>;
}

type BillingSeriesKey = "billed" | "collected";

function BillingCurrencyChart({ language, currency, days }: { language: LanguagePreference; currency: "USD" | "SYP"; days: DashboardBillingActivityDay[] }) {
  const c = labels[language];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [seriesVisible, setSeriesVisible] = useState<Record<BillingSeriesKey, boolean>>({ billed: true, collected: true });
  const width = 1120;
  const height = 410;
  const margin = { top: 22, right: 24, bottom: 52, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const billed = days.map((day) => Math.max(0, finiteNumber(day[currency].billed)));
  const collected = days.map((day) => Math.max(0, finiteNumber(day[currency].collected)));
  const activeValues = [...(seriesVisible.billed ? billed : []), ...(seriesVisible.collected ? collected : [])];
  const yMax = niceMax(Math.max(1, ...activeValues));
  const point = (value: number, index: number) => {
    const x = margin.left + (index / Math.max(1, days.length - 1)) * plotWidth;
    const y = margin.top + plotHeight - (value / yMax) * plotHeight;
    return [x, y] as const;
  };
  const billedPoints = billed.map((value, index) => point(value, index).join(",")).join(" ");
  const collectedPoints = collected.map((value, index) => point(value, index).join(",")).join(" ");
  const billedTotal = billed.reduce((sum, value) => sum + value, 0);
  const collectedTotal = collected.reduce((sum, value) => sum + value, 0);
  const hoverDay = hoverIndex === null ? null : days[hoverIndex];
  const hoverBilled = hoverIndex === null ? 0 : billed[hoverIndex];
  const hoverCollected = hoverIndex === null ? 0 : collected[hoverIndex];
  const hoverRate = safePercent(hoverBilled > 0 ? (hoverCollected / hoverBilled) * 100 : hoverCollected > 0 ? 100 : 0);

  function toggleSeries(key: BillingSeriesKey) {
    setSeriesVisible((current) => {
      const nextValue = !current[key];
      if (!nextValue && Object.entries(current).every(([series, visible]) => series === key || !visible)) return current;
      return { ...current, [key]: nextValue };
    });
  }

  function updateHover(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !days.length) return;
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const ratio = Math.max(0, Math.min(1, (svgX - margin.left) / plotWidth));
    setHoverIndex(Math.round(ratio * Math.max(0, days.length - 1)));
  }

  return <div className="analytics-billing-panel analytics-billing-panel-large">
    <header>
      <div><strong>{currency}</strong><small>{c.billed}: {formatMoney(String(billedTotal), currency)} · {c.collected}: {formatMoney(String(collectedTotal), currency)}</small></div>
      <span>{c.collectionRate}: {billedTotal > 0 ? `${safePercent((collectedTotal / billedTotal) * 100).toFixed(1)}%` : "—"}</span>
    </header>
    <InteractiveLegend items={[{ key: "billed", label: c.billed, color: palette.blue }, { key: "collected", label: c.collected, color: palette.teal }]} active={seriesVisible} onToggle={(key) => toggleSeries(key as BillingSeriesKey)} />
    <ChartReadout>
      {hoverDay ? <>
        <strong>{shortDate(hoverDay.date, language)}</strong>
        <span>{c.billed}: {formatMoney(String(hoverBilled), currency)}</span>
        <span>{c.collected}: {formatMoney(String(hoverCollected), currency)}</span>
        <span>{c.difference}: {formatMoney(String(hoverBilled - hoverCollected), currency)}</span>
        <span>{c.collectionRate}: {hoverRate.toFixed(1)}%</span>
      </> : <span>{c.hoverHint}</span>}
    </ChartReadout>
    <svg className="analytics-svg analytics-billing-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${currency} ${c.billing}`} onPointerMove={(event) => updateHover(event.clientX, event.currentTarget)} onPointerLeave={() => setHoverIndex(null)}>
      {ticks(yMax, 5).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 12} y={y + 5} textAnchor="end">{compactNumber(tick)}</text>
        </g>;
      })}
      {seriesVisible.billed ? <polyline className="analytics-line analytics-line-blue" points={billedPoints} /> : null}
      {seriesVisible.collected ? <polyline className="analytics-line analytics-line-teal" points={collectedPoints} /> : null}
      {hoverIndex !== null ? (() => {
        const [x, billedY] = point(hoverBilled, hoverIndex);
        const [, collectedY] = point(hoverCollected, hoverIndex);
        return <g className="analytics-crosshair">
          <line x1={x} x2={x} y1={margin.top} y2={margin.top + plotHeight} />
          {seriesVisible.billed ? <circle cx={x} cy={billedY} r="6" fill={palette.blue} /> : null}
          {seriesVisible.collected ? <circle cx={x} cy={collectedY} r="6" fill={palette.teal} /> : null}
        </g>;
      })() : null}
      {days.map((day, index) => {
        if (index % 4 !== 0 && index !== days.length - 1) return null;
        const [x] = point(0, index);
        return <text key={day.date} className="analytics-axis-label" x={x} y={height - 14} textAnchor="middle">{shortDate(day.date, language)}</text>;
      })}
    </svg>
  </div>;
}

function BillingChart({ language, days }: { language: LanguagePreference; days: DashboardBillingActivityDay[] }) {
  return <div className="analytics-billing-grid analytics-billing-grid-large">
    <BillingCurrencyChart language={language} currency="USD" days={days} />
    <BillingCurrencyChart language={language} currency="SYP" days={days} />
  </div>;
}

function PatientMixChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardPatientMixWeek[] }) {
  const c = labels[language];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 820;
  const height = 340;
  const margin = { top: 20, right: 20, bottom: 52, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const totals = weeks.map((week) => week.new + week.returning);
  const yMax = niceMax(Math.max(1, ...totals));
  const band = plotWidth / Math.max(weeks.length, 1);
  const barWidth = Math.min(54, band * 0.56);
  const active = activeIndex === null ? null : weeks[activeIndex];

  return <div className="analytics-chart-block analytics-interactive-chart">
    <Legend items={[{ label: c.newPatients, color: palette.teal }, { label: c.returning, color: palette.violet }]} />
    <ChartReadout>
      {active ? <><strong>{shortDate(active.week_start, language)}</strong><span>{c.newPatients}: {active.new}</span><span>{c.returning}: {active.returning}</span><span>{c.scheduled}: {active.new + active.returning}</span></> : <span>{c.hoverHint}</span>}
    </ChartReadout>
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.patientMix}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}><line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} /><text className="analytics-axis-label" x={margin.left - 10} y={y + 5} textAnchor="end">{Math.round(tick)}</text></g>;
      })}
      {weeks.map((week, index) => {
        const x = margin.left + index * band + (band - barWidth) / 2;
        const returningHeight = (week.returning / yMax) * plotHeight;
        const newHeight = (week.new / yMax) * plotHeight;
        const bottom = margin.top + plotHeight;
        return <g key={week.week_start} className={`analytics-hover-row${activeIndex === index ? " active" : ""}`} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
          <rect className="analytics-hit-target" x={margin.left + index * band} y={margin.top} width={band} height={plotHeight} />
          <rect className="analytics-data-bar" x={x} y={bottom - returningHeight} width={barWidth} height={returningHeight} fill={palette.violet} rx="3" />
          <rect className="analytics-data-bar" x={x} y={bottom - returningHeight - newHeight} width={barWidth} height={newHeight} fill={palette.teal} rx="3" />
          <text className="analytics-axis-label" x={x + barWidth / 2} y={height - 16} textAnchor="middle">{shortDate(week.week_start, language)}</text>
        </g>;
      })}
    </svg>
  </div>;
}

function ProblemRateChart({ language, weeks }: { language: LanguagePreference; weeks: DashboardProblemRateWeek[] }) {
  const c = labels[language];
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 820;
  const height = 340;
  const margin = { top: 24, right: 22, bottom: 52, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMax = 100;
  const coords = weeks.map((week, index) => {
    const x = margin.left + (index / Math.max(1, weeks.length - 1)) * plotWidth;
    const y = margin.top + plotHeight - (safePercent(week.rate_percent) / yMax) * plotHeight;
    return { x, y, week };
  });
  const linePoints = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = coords.length ? `${margin.left},${margin.top + plotHeight} ${linePoints} ${margin.left + plotWidth},${margin.top + plotHeight}` : "";
  const active = activeIndex === null ? null : weeks[activeIndex];

  return <div className="analytics-chart-block analytics-interactive-chart">
    <ChartReadout>
      {active ? <><strong>{shortDate(active.week_start, language)}</strong><span>{safePercent(active.rate_percent).toFixed(1)}%</span><span>{c.cancelled}: {active.cancelled}</span><span>{c.noShow}: {active.no_show}</span><span>{c.scheduled}: {active.scheduled}</span></> : <span>{c.hoverHint}</span>}
    </ChartReadout>
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={c.problemRate}>
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}><line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} /><text className="analytics-axis-label" x={margin.left - 10} y={y + 5} textAnchor="end">{Math.round(tick)}%</text></g>;
      })}
      <polygon className="analytics-area" points={areaPoints} />
      <polyline className="analytics-line analytics-line-violet" points={linePoints} />
      {coords.map(({ x, y, week }, index) => <g key={week.week_start} className={`analytics-hover-row${activeIndex === index ? " active" : ""}`} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
        <circle className="analytics-point" cx={x} cy={y} r={activeIndex === index ? 7 : 5} />
        <text className="analytics-value-label" x={x} y={Math.max(18, y - 12)} textAnchor="middle">{safePercent(week.rate_percent).toFixed(1)}%</text>
        <text className="analytics-axis-label" x={x} y={height - 16} textAnchor="middle">{shortDate(week.week_start, language)}</text>
      </g>)}
    </svg>
  </div>;
}

function AgingCurrencyChart({ currency, rows, bucketName }: { currency: "USD" | "SYP"; rows: DashboardReceivablesAgingBucket[]; bucketName: Record<DashboardReceivablesAgingBucket["bucket"], string> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const width = 650;
  const height = 250;
  const margin = { top: 16, right: 132, bottom: 20, left: 116 };
  const plotWidth = width - margin.left - margin.right;
  const rowHeight = 50;
  const values = rows.map((row) => Number(row[currency]));
  const max = niceMax(Math.max(1, ...values));

  return <div className="analytics-aging-panel">
    <strong>{currency}</strong>
    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${currency} receivables aging`}>
      {rows.map((row, index) => {
        const y = margin.top + index * rowHeight + 9;
        const value = Number(row[currency]);
        return <g key={row.bucket} className={`analytics-hover-row${activeIndex === index ? " active" : ""}`} tabIndex={0} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onBlur={() => setActiveIndex(null)}>
          <text className="analytics-axis-label analytics-axis-label-strong" x={margin.left - 12} y={y + 15} textAnchor="end">{bucketName[row.bucket]}</text>
          <rect className="analytics-track" x={margin.left} y={y} width={plotWidth} height="20" rx="6" />
          <rect className="analytics-data-bar" x={margin.left} y={y} width={(value / max) * plotWidth} height="20" rx="6" fill={currency === "USD" ? palette.blue : palette.teal} />
          <text className="analytics-value-label" x={margin.left + plotWidth + 12} y={y + 15}>{formatMoney(String(value), currency)}</text>
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
    <DashboardSection title={c.billing} eyebrow={c.last30} className="admin-analytics-wide admin-analytics-billing"><BillingChart language={language} days={billing} /></DashboardSection>
    <DashboardSection title={c.patientMix} eyebrow={c.last8}><PatientMixChart language={language} weeks={patientMix} /></DashboardSection>
    <DashboardSection title={c.problemRate} eyebrow={c.last8}><ProblemRateChart language={language} weeks={problemRate} /></DashboardSection>
    <DashboardSection title={c.aging} className="admin-analytics-wide"><AgingChart language={language} rows={aging} /></DashboardSection>
  </div>;
}
