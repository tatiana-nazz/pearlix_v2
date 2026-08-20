import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getAllAppointments } from "../../api/endpoints/appointments";
import { clinicApi, clinicSettingsQueryKey } from "../../api/endpoints/clinic";
import type { LanguagePreference } from "../../types/auth";
import { isClinicClosedDate } from "../../utils/clinicWeek";
import { addDays } from "../appointments/utils/appointmentDates";
import { dateFromAppointment } from "../appointments/utils/appointmentFilters";

const palette = {
  blue: "#5B8FF9",
  amber: "#F6BD16",
  red: "#E8684A",
} as const;

const copy = {
  EN: {
    booked: "Booked",
    needsReschedule: "Needs reschedule",
    cancelled: "Cancelled",
    appointments: "appointments",
    hoverHint: "Hover or focus a day for exact values.",
    clickHint: "Click a day to open its schedule.",
    busiest: "Busiest day",
    clinicClosed: "Clinic closed",
    loading: "Loading upcoming schedule…",
    unavailable: "Upcoming schedule unavailable.",
  },
  AR: {
    booked: "محجوز",
    needsReschedule: "تحتاج إعادة جدولة",
    cancelled: "ملغى",
    appointments: "موعد",
    hoverHint: "مرر المؤشر أو ركّز على يوم لعرض القيم الدقيقة.",
    clickHint: "انقر على يوم لفتح جدوله.",
    busiest: "أكثر الأيام ازدحاماً",
    clinicClosed: "العيادة مغلقة",
    loading: "جارٍ تحميل الجدول القادم…",
    unavailable: "الجدول القادم غير متاح.",
  },
} as const;

type DailyLoad = {
  date: string;
  booked: number;
  needsReschedule: number;
  cancelled: number;
};

function shortDate(value: string, language: LanguagePreference) {
  return new Intl.DateTimeFormat(language === "AR" ? "ar" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
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

export function UpcomingClinicLoadChart({ language, clinicDate, clinicTimezone }: {
  language: LanguagePreference;
  clinicDate: string;
  clinicTimezone: string;
}) {
  const c = copy[language];
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const endDate = addDays(clinicDate, 14);
  const schedule = useQuery({
    queryKey: ["dashboard", "upcoming-clinic-load", clinicDate, clinicTimezone],
    queryFn: () => getAllAppointments({
      start_from: `${clinicDate}T00:00:00`,
      start_to: `${endDate}T00:00:00`,
    }),
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  const clinicSettings = useQuery({
    queryKey: clinicSettingsQueryKey,
    queryFn: clinicApi.getSettings,
    staleTime: 300_000,
  });

  const days = useMemo<DailyLoad[]>(() => {
    const rows = Array.from({ length: 14 }, (_, index) => ({
      date: addDays(clinicDate, index),
      booked: 0,
      needsReschedule: 0,
      cancelled: 0,
    }));
    const byDate = new Map(rows.map((row) => [row.date, row]));

    for (const appointment of schedule.data?.results ?? []) {
      const date = dateFromAppointment(appointment.start_datetime, clinicTimezone);
      const row = byDate.get(date);
      if (!row) continue;
      if (["UPCOMING", "CHECKED_IN", "ACTIVE"].includes(appointment.status)) row.booked += 1;
      else if (appointment.status === "NEEDS_RESCHEDULE") row.needsReschedule += 1;
      else if (appointment.status === "CANCELLED") row.cancelled += 1;
    }

    return rows;
  }, [clinicDate, clinicTimezone, schedule.data?.results]);

  const totalBooked = days.reduce((sum, day) => sum + day.booked, 0);
  const totalNeedsReschedule = days.reduce((sum, day) => sum + day.needsReschedule, 0);
  const busiest = days.reduce((current, day) => day.booked > current.booked ? day : current, days[0]);
  const active = activeIndex === null ? null : days[activeIndex];
  const activeClosed = active ? isClinicClosedDate(active.date, clinicSettings.data?.weekly_closed_days ?? []) : false;

  const width = 820;
  const height = 390;
  const margin = { top: 24, right: 24, bottom: 64, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yMax = niceMax(Math.max(1, ...days.map((day) => Math.max(day.booked, day.needsReschedule))));
  const band = plotWidth / days.length;
  const groupWidth = Math.min(34, band * 0.72);
  const bookedWidth = groupWidth * 0.68;
  const rescheduleWidth = Math.max(5, groupWidth * 0.24);

  function openDay(index: number) {
    navigate(`/admin/appointments/day?date=${days[index].date}`);
  }

  return <div className="analytics-chart-block analytics-interactive-chart upcoming-load-chart">
    <div className="analytics-legend">
      <span><i style={{ backgroundColor: palette.blue }} />{c.booked}</span>
      <span><i style={{ backgroundColor: palette.amber }} />{c.needsReschedule}</span>
    </div>

    <div className="analytics-readout" aria-live="polite">
      {schedule.isLoading ? <span>{c.loading}</span> : schedule.isError ? <span>{c.unavailable}</span> : active ? <>
        <strong>{shortDate(active.date, language)}</strong>
        {activeClosed ? <><span>{c.clinicClosed}</span>{active.needsReschedule > 0 ? <span>{c.needsReschedule}: {active.needsReschedule}</span> : null}</> : <>
          <span>{c.booked}: {active.booked}</span>
          <span>{c.needsReschedule}: {active.needsReschedule}</span>
          <span>{c.cancelled}: {active.cancelled}</span>
        </>}
      </> : <>
        <strong>{totalBooked} {c.booked.toLowerCase()}</strong>
        <span>{totalNeedsReschedule} {c.needsReschedule.toLowerCase()}</span>
        <span>{c.busiest}: {shortDate(busiest.date, language)} · {busiest.booked}</span>
        <span>{c.hoverHint}</span>
        <span>{c.clickHint}</span>
      </>}
    </div>

    <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Upcoming clinic load">
      {ticks(yMax).map((tick) => {
        const y = margin.top + plotHeight - (tick / yMax) * plotHeight;
        return <g key={tick}>
          <line className="analytics-gridline" x1={margin.left} x2={width - margin.right} y1={y} y2={y} />
          <text className="analytics-axis-label" x={margin.left - 10} y={y + 5} textAnchor="end">{Math.round(tick)}</text>
        </g>;
      })}

      {days.map((day, index) => {
        const x = margin.left + index * band + (band - groupWidth) / 2;
        const bookedHeight = (day.booked / yMax) * plotHeight;
        const rescheduleHeight = (day.needsReschedule / yMax) * plotHeight;
        const bottom = margin.top + plotHeight;
        const clinicClosed = isClinicClosedDate(day.date, clinicSettings.data?.weekly_closed_days ?? []);
        return <g
          key={day.date}
          className={`analytics-outcome-day${activeIndex === index ? " active" : ""}`}
          tabIndex={0}
          role="button"
          aria-label={`${day.date}: ${clinicClosed ? `${c.clinicClosed}; ` : ""}${day.booked} ${c.booked}`}
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
          {clinicClosed ? <rect className="upcoming-load-closed-band" x={margin.left + index * band} y={margin.top} width={band} height={plotHeight} /> : null}
          <rect className="analytics-hit-target" x={margin.left + index * band} y={margin.top} width={band} height={plotHeight} />
          <rect className="analytics-data-bar" x={x} y={bottom - bookedHeight} width={bookedWidth} height={bookedHeight} rx="4" fill={palette.blue} />
          {day.needsReschedule > 0 ? <rect className="analytics-data-bar" x={x + bookedWidth + 3} y={bottom - rescheduleHeight} width={rescheduleWidth} height={rescheduleHeight} rx="3" fill={palette.amber} /> : null}
          {day.cancelled > 0 ? <circle cx={x + groupWidth / 2} cy={bottom + 10} r="3.5" fill={palette.red} /> : null}
          {(index % 2 === 0 || index === days.length - 1) ? <text className="analytics-axis-label" x={x + groupWidth / 2} y={height - 18} textAnchor="middle">{shortDate(day.date, language)}</text> : null}
        </g>;
      })}
    </svg>
  </div>;
}
