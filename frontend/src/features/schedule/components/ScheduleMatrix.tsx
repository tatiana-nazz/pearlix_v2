import { formatClock } from "../../../utils/dates";
import { buildScheduleMatrix, type ScheduleShiftLike } from "../utils/scheduleMatrix";

const weekdays = {
  EN: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  AR: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
};

export function ScheduleMatrix({ shifts, language, emptyText }: { shifts: ScheduleShiftLike[]; language: "EN" | "AR"; emptyText: string }) {
  const rows = buildScheduleMatrix(shifts);
  if (!rows.length) return <p className="panel-note">{emptyText}</p>;
  const off = language === "AR" ? "لا دوام" : "Off";
  return <div className="schedule-matrix-scroll">
    <table className="schedule-matrix">
      <thead><tr><th>{language === "AR" ? "المناوبة" : "Shift"}</th>{weekdays[language].map((day) => <th key={day}>{day}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}><th scope="row">{row.label}</th>{row.days.map((ranges, index) => <td key={index}>{ranges.length ? ranges.map((range) => <span key={`${range.start}-${range.end}`} dir="ltr">{formatClock(range.start)}–{formatClock(range.end)}</span>) : <span className="schedule-off">{off}</span>}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
