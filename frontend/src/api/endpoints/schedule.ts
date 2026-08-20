import type { Page, QueryParams } from "../../types/api";
import type { AvailabilityCancelResponse, AvailabilityException, AvailabilityExceptionPayload, ClinicDefaultShift, DoctorListItem, ScheduleApplyMode, ScheduleMutationResult, WorkingHoursPayload, WorkingHoursResponse, WorkingShift, WorkingShiftPayload } from "../../types/schedule";
import { api } from "../http";

async function getAllPages<T>(url: string, query?: QueryParams): Promise<Page<T>> {
  let page = 1;
  let last: Page<T> | null = null;
  const results: T[] = [];

  do {
    last = await api.get<Page<T>>(url, { ...(query ?? {}), page });
    results.push(...last.results);
    page += 1;
  } while (last.next);

  return {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}

export const scheduleApi = {
  doctors: () => api.get<DoctorListItem[]>("/doctors/"),
  workingHours: (doctorId: number) => api.get<WorkingHoursResponse>(`/doctors/${doctorId}/working-hours/`),
  replaceWorkingHours: (doctorId: number, payload: WorkingHoursPayload) => api.put<WorkingHoursResponse, WorkingHoursPayload>(`/doctors/${doctorId}/working-hours/`, payload),
  defaultShifts: () => getAllPages<ClinicDefaultShift>("/clinic-default-shifts/"),
  createDefaultShift: (payload: Omit<ClinicDefaultShift, "id" | "is_active" | "clinic_closed" | "effective_is_active" | "version" | "created_at" | "updated_at" | "created_by" | "updated_by" | "weekday_label">) => api.post<ClinicDefaultShift>("/clinic-default-shifts/", payload),
  updateDefaultShift: (id: number, payload: Partial<ClinicDefaultShift> & { version: number }) => api.patch<ClinicDefaultShift>(`/clinic-default-shifts/${id}/`, payload),
  setDefaultShiftActive: (id: number, version: number, active: boolean) => api.post<ClinicDefaultShift>(`/clinic-default-shifts/${id}/${active ? "activate" : "deactivate"}/`, { version }),
  workingShifts: (query?: QueryParams) => getAllPages<WorkingShift>("/working-shifts/", query),
  createWorkingShift: (payload: WorkingShiftPayload) => api.post<WorkingShift, WorkingShiftPayload>("/working-shifts/", payload),
  updateWorkingShift: (id: number, payload: Partial<WorkingShiftPayload> & { version: number; confirm_appointment_impact?: boolean }) => api.patch<WorkingShift>(`/working-shifts/${id}/`, payload),
  setWorkingShiftActive: (id: number, version: number, active: boolean, confirm_appointment_impact = false) => api.post<WorkingShift>(`/working-shifts/${id}/${active ? "activate" : "deactivate"}/`, { version, confirm_appointment_impact }),
  applyDefault: (employee_id: number, mode: ScheduleApplyMode, confirm_appointment_impact = false) => api.post<ScheduleMutationResult>("/working-shifts/apply-default/", { employee_id, mode, confirm_appointment_impact }),
  copySchedule: (source_employee_id: number, target_employee_id: number, mode: ScheduleApplyMode, confirm_appointment_impact = false) => api.post<ScheduleMutationResult>("/working-shifts/copy-schedule/", { source_employee_id, target_employee_id, mode, confirm_appointment_impact }),
  availabilityExceptions: (query?: QueryParams) => api.get<Page<AvailabilityException>>("/availability-exceptions/", query),
  createAvailabilityException: (payload: AvailabilityExceptionPayload) => api.post<AvailabilityException, AvailabilityExceptionPayload>("/availability-exceptions/", payload),
  updateAvailabilityException: (id: number, payload: Partial<AvailabilityExceptionPayload> & { version: number }) => api.patch<AvailabilityException>(`/availability-exceptions/${id}/`, payload),
  cancelAvailabilityException: (id: number, version: number) => api.post<AvailabilityCancelResponse>(`/availability-exceptions/${id}/cancel/`, { version }),
};
