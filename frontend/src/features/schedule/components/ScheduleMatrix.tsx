import { formatClock } from "../../../utils/dates";
import { clinicWeekdayLabels } from "../../../utils/clinicWeek";
import { buildScheduleMatrix, type ScheduleShiftLike } from "../utils/scheduleMatrix";

export function ScheduleMatrix({ shifts, language, emptyText, weeklyClosedDays = [] }: { shifts: ScheduleShiftLike[]; language: "EN" | "AR"; emptyText: string; weeklyClosedDays?: readonly number[] }) {
  const rows = buildScheduleMatrix(shifts);
  if (!rows.length) return <p className="panel-note">{emptyText}</p>;
  const off = language === "AR" ? "لا دوام" : "Off";
  const clinicClosed = language === "AR" ? "العيادة مغلقة" : "Clinic closed";
  const storedShift = language === "AR" ? "المناوبة المحفوظة" : "Stored shift";
  const rowLabel = (index: number) => language === "AR" ? `المناوبة ${index + 1}` : `Shift ${index + 1}`;
  return <div className="schedule-matrix-scroll">
    <table className="schedule-matrix">
      <thead><tr><th>{language === "AR" ? "المناوبة" : "Shift"}</th>{clinicWeekdayLabels[language].map((day) => <th key={day}>{day}</th>)}</tr></thead>
      <tbody>{rows.map((row, rowIndex) => <tr key={row.id}><th scope="row">{rowLabel(rowIndex)}</th>{row.days.map((ranges, index) => {
        const closed = weeklyClosedDays.includes(index);
        return <td key={index} className={closed ? "schedule-clinic-closed" : undefined} data-clinic-closed={closed || undefined}>
          {closed ? <>
            <strong>{clinicClosed}</strong>
            {ranges.map((range) => <span className="schedule-stored-shift" key={`${range.start}-${range.end}`}><span>{storedShift}</span> <span dir="ltr">{formatClock(range.start)}–{formatClock(range.end)}</span></span>)}
          </> : ranges.length ? ranges.map((range) => <span key={`${range.start}-${range.end}`} dir="ltr">{formatClock(range.start)}–{formatClock(range.end)}</span>) : <span className="schedule-off">{off}</span>}
        </td>;
      })}</tr>)}</tbody>
    </table>
  </div>;
}
