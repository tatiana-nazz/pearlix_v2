import type { AppointmentStatus } from "../../types/appointments";

const copy = {
  EN: {
    daySummary: "Day summary", monthSummary: "Month summary", periodTotal: "Total in period", loadedStatusSummary: "Status counts for this loaded page", clinicClosed: "Clinic closed",
    title: "Appointments", staffDescription: "Schedule and manage today's appointments.", readDescription: "Review appointment schedules and status.", appointmentDetail: "Appointment detail", detailDescription: "Scheduling information and current appointment status.", openAppointment: "Open appointment", openDay: "Open day", backToAppointments: "Back to Appointments", appointmentNotFound: "Appointment not found", appointmentNotFoundDescription: "This appointment is unavailable or the identifier is invalid.",
    day: "Day", week: "Week", month: "Month", list: "List", calendar: "Calendar", rescheduleQueue: "Reschedule Queue", workspaceViews: "Appointment workspaces", weekSummary: "Week summary", total: "Total", today: "Today", previous: "Previous", next: "Next", newAppointment: "New appointment", filters: "Filters", clearFilters: "Clear filters", refresh: "Refresh", refreshing: "Refreshing...", needsReschedule: "Needs reschedule", noAppointments: "No appointments for this period.", retry: "Retry", loading: "Loading appointments", details: "Appointment details", close: "Close", patient: "Patient", patientId: "Patient ID", doctor: "Doctor", allDoctors: "All doctors", selectDoctor: "Select doctor", date: "Date", time: "Time", startTime: "Start time", endTime: "End time", duration: "Duration", reason: "Reason", notes: "Scheduling notes", status: "Status", edit: "Edit", reschedule: "Reschedule", checkIn: "Check in", cancel: "Cancel", noShow: "Mark no-show", startVisit: "Start visit", save: "Save appointment", saveReschedule: "Save reschedule", availableSlots: "Available slots", noAvailability: "No availability for the selected doctor and date.", more: "more", page: "Page", records: "records", search: "Search patient name or phone", allStatuses: "All statuses", changeHistory: "Change history", created: "Created", updated: "Updated", readOnly: "Read-only", queueDescription: "Appointments awaiting a new valid time.", unavailable: "Appointments unavailable", minutes: "minutes", action: "Appointment action", confirmAction: "Confirm action", confirm: "Confirm", keepAppointment: "Keep appointment", actionUnavailable: "Unable to complete action", actionCheckIn: "check in this appointment", actionCancel: "cancel this appointment", actionNoShow: "mark this appointment as no-show", actionStartVisit: "start this visit", saveError: "Unable to save appointment. Review the highlighted fields and try again.", statusManaged: "Status is managed through appointment action endpoints, not the appointment form.", previousPage: "Previous", nextPage: "Next", rescheduleContext: "Reschedule context", rescheduleSource: "Source", previousStatus: "Previous status", createdBy: "Created by", updatedBy: "Updated by",
  },
  AR: {
    daySummary: "\u0645\u0644\u062e\u0635 \u0627\u0644\u064a\u0648\u0645", monthSummary: "\u0645\u0644\u062e\u0635 \u0627\u0644\u0634\u0647\u0631", periodTotal: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u062a\u0631\u0629", loadedStatusSummary: "\u062d\u0627\u0644\u0627\u062a \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u062d\u0645\u0644\u0629", clinicClosed: "\u0627\u0644\u0639\u064a\u0627\u062f\u0629 \u0645\u063a\u0644\u0642\u0629",
    title: "\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f", staffDescription: "\u062c\u062f\u0648\u0644\u0629 \u0648\u0625\u062f\u0627\u0631\u0629 \u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u064a\u0648\u0645.", readDescription: "\u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0648\u062d\u0627\u0644\u062a\u0647\u0627.", appointmentDetail: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0648\u0639\u062f", detailDescription: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062c\u062f\u0648\u0644\u0629 \u0648\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u062d\u0627\u0644\u064a\u0629.", openAppointment: "\u0641\u062a\u062d \u0627\u0644\u0645\u0648\u0639\u062f", openDay: "\u0641\u062a\u062d \u0627\u0644\u064a\u0648\u0645", backToAppointments: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f", appointmentNotFound: "\u0627\u0644\u0645\u0648\u0639\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f", appointmentNotFoundDescription: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0639\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0623\u0648 \u0623\u0646 \u0627\u0644\u0645\u0639\u0631\u0641 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d.",
    day: "\u064a\u0648\u0645", week: "\u0623\u0633\u0628\u0648\u0639", month: "\u0634\u0647\u0631", list: "\u0642\u0627\u0626\u0645\u0629", calendar: "\u0627\u0644\u062a\u0642\u0648\u064a\u0645", rescheduleQueue: "\u0642\u0627\u0626\u0645\u0629 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062c\u062f\u0648\u0644\u0629", workspaceViews: "\u0645\u0633\u0627\u062d\u0627\u062a \u0639\u0645\u0644 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f", weekSummary: "\u0645\u0644\u062e\u0635 \u0627\u0644\u0623\u0633\u0628\u0648\u0639", total: "\u0627\u0644\u0645\u062c\u0645\u0648\u0639", today: "\u0627\u0644\u064a\u0648\u0645", previous: "\u0627\u0644\u0633\u0627\u0628\u0642", next: "\u0627\u0644\u062a\u0627\u0644\u064a", newAppointment: "\u0645\u0648\u0639\u062f \u062c\u062f\u064a\u062f", filters: "\u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062a\u0635\u0641\u064a\u0629", clearFilters: "\u0645\u0633\u062d \u0639\u0648\u0627\u0645\u0644 \u0627\u0644\u062a\u0635\u0641\u064a\u0629", refresh: "\u062a\u062d\u062f\u064a\u062b", refreshing: "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u062f\u064a\u062b...", needsReschedule: "\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0625\u0639\u0627\u062f\u0629 \u062c\u062f\u0648\u0644\u0629", noAppointments: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0648\u0627\u0639\u064a\u062f \u0644\u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629.", retry: "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629", loading: "\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f", details: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0648\u0639\u062f", close: "\u0625\u063a\u0644\u0627\u0642", patient: "\u0627\u0644\u0645\u0631\u064a\u0636", patientId: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064a\u0636", doctor: "\u0627\u0644\u0637\u0628\u064a\u0628", allDoctors: "\u0643\u0644 \u0627\u0644\u0623\u0637\u0628\u0627\u0621", selectDoctor: "\u0627\u062e\u062a\u0631 \u0637\u0628\u064a\u0628\u0627", date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e", time: "\u0627\u0644\u0648\u0642\u062a", duration: "\u0627\u0644\u0645\u062f\u0629", reason: "\u0627\u0644\u0633\u0628\u0628", notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u062c\u062f\u0648\u0644\u0629", status: "\u0627\u0644\u062d\u0627\u0644\u0629", edit: "\u062a\u0639\u062f\u064a\u0644", reschedule: "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062c\u062f\u0648\u0644\u0629", checkIn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062d\u0636\u0648\u0631", cancel: "\u0625\u0644\u063a\u0627\u0621", noShow: "\u062a\u062d\u062f\u064a\u062f \u0643\u0645\u062a\u063a\u064a\u0628", startVisit: "\u0628\u062f\u0621 \u0627\u0644\u0632\u064a\u0627\u0631\u0629", save: "\u062d\u0641\u0638 \u0627\u0644\u0645\u0648\u0639\u062f", saveReschedule: "\u062d\u0641\u0638 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062c\u062f\u0648\u0644\u0629", availableSlots: "\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0645\u062a\u0627\u062d\u0629", noAvailability: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0648\u0642\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u0637\u0628\u064a\u0628 \u0648\u0627\u0644\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u062d\u062f\u062f\u064a\u0646.", more: "\u0627\u0644\u0645\u0632\u064a\u062f", page: "\u0627\u0644\u0635\u0641\u062d\u0629", records: "\u0633\u062c\u0644", search: "\u0627\u0644\u0628\u062d\u062b \u0628\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064a\u0636 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641", allStatuses: "\u0643\u0644 \u0627\u0644\u062d\u0627\u0644\u0627\u062a", changeHistory: "\u0633\u062c\u0644 \u0627\u0644\u062a\u063a\u064a\u064a\u0631\u0627\u062a", created: "\u0623\u0646\u0634\u0626", updated: "\u062d\u064f\u062f\u0651\u062b", readOnly: "\u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637", queueDescription: "\u0645\u0648\u0627\u0639\u064a\u062f \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0648\u0642\u062a \u062c\u062f\u064a\u062f \u0635\u0627\u0644\u062d.", unavailable: "\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629", minutes: "\u062f\u0642\u0627\u0626\u0642", action: "\u0625\u062c\u0631\u0627\u0621 \u0627\u0644\u0645\u0648\u0639\u062f", confirmAction: "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0625\u062c\u0631\u0627\u0621", confirm: "\u062a\u0623\u0643\u064a\u062f", keepAppointment: "\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0627\u0644\u0645\u0648\u0639\u062f", actionUnavailable: "\u062a\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0625\u062c\u0631\u0627\u0621", actionCheckIn: "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062d\u0636\u0648\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0639\u062f", actionCancel: "\u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0639\u062f", actionNoShow: "\u062a\u062d\u062f\u064a\u062f \u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0639\u062f \u0643\u0645\u062a\u063a\u064a\u0628", actionStartVisit: "\u0628\u062f\u0621 \u0647\u0630\u0647 \u0627\u0644\u0632\u064a\u0627\u0631\u0629", saveError: "\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0627\u0644\u0645\u0648\u0639\u062f. \u0631\u0627\u062c\u0639 \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u062d\u062f\u062f\u0629 \u0648\u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627.", statusManaged: "\u062a\u062f\u0627\u0631 \u0627\u0644\u062d\u0627\u0644\u0629 \u0628\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0648\u0639\u062f \u0648\u0644\u064a\u0633 \u0646\u0645\u0648\u0630\u062c \u0627\u0644\u0645\u0648\u0639\u062f.", previousPage: "\u0627\u0644\u0633\u0627\u0628\u0642", nextPage: "\u0627\u0644\u062a\u0627\u0644\u064a",
  },
} as const;

const pickerCopy = {
  EN: {
    searchPatients: "Search patients",
    typeToSearchPatients: "Type at least 2 characters to search active patients.",
    searchingPatients: "Searching patients...",
    noPatientsFound: "No patients found.",
    unableToLoadPatients: "Unable to load patients.",
    clearPatient: "Clear selected patient",
    selectedPatient: "Selected patient",
    patientRequired: "Patient is required.",
    patientUnavailable: "This patient is unavailable or archived. Choose another patient.",
  },
  AR: {
    searchPatients: "\u0627\u0628\u062d\u062b \u0639\u0646 \u0645\u0631\u0636\u0649",
    typeToSearchPatients: "\u0627\u0643\u062a\u0628 \u062d\u0631\u0641\u064a\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0644\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0645\u0631\u0636\u0649 \u0627\u0644\u0646\u0634\u0637\u064a\u0646.",
    searchingPatients: "\u062c\u0627\u0631\u064d \u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0627\u0644\u0645\u0631\u0636\u0649...",
    noPatientsFound: "\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0631\u0636\u0649.",
    unableToLoadPatients: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0631\u0636\u0649.",
    clearPatient: "\u0645\u0633\u062d \u0627\u0644\u0645\u0631\u064a\u0636 \u0627\u0644\u0645\u062d\u062f\u062f",
    selectedPatient: "\u0627\u0644\u0645\u0631\u064a\u0636 \u0627\u0644\u0645\u062d\u062f\u062f",
    patientRequired: "\u0627\u0644\u0645\u0631\u064a\u0636 \u0645\u0637\u0644\u0648\u0628.",
    patientUnavailable: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0631\u064a\u0636 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0623\u0648 \u0645\u0624\u0631\u0634\u0641. \u0627\u062e\u062a\u0631 \u0645\u0631\u064a\u0636\u0627 \u0622\u062e\u0631.",
  },
} as const;

const detailCopy = {
  EN: {
    appointmentDetail: "Appointment detail",
    detailDescription: "Scheduling information and current appointment status.",
    openAppointment: "Open appointment",
    openDay: "Open day",
    backToAppointments: "Back to Appointments",
    appointmentNotFound: "Appointment not found",
    appointmentNotFoundDescription: "This appointment is unavailable or the identifier is invalid.",
    startTime: "Start time",
    endTime: "End time",
    rescheduleContext: "Reschedule context",
    rescheduleSource: "Source",
    previousStatus: "Previous status",
    createdBy: "Created by",
    updatedBy: "Updated by",
  },
  AR: {
    appointmentDetail: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0648\u0639\u062f",
    detailDescription: "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062c\u062f\u0648\u0644\u0629 \u0648\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u062d\u0627\u0644\u064a\u0629.",
    openAppointment: "\u0641\u062a\u062d \u0627\u0644\u0645\u0648\u0639\u062f",
    openDay: "\u0641\u062a\u062d \u0627\u0644\u064a\u0648\u0645",
    backToAppointments: "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f",
    appointmentNotFound: "\u0627\u0644\u0645\u0648\u0639\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f",
    appointmentNotFoundDescription: "\u0647\u0630\u0627 \u0627\u0644\u0645\u0648\u0639\u062f \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u0623\u0648 \u0623\u0646 \u0627\u0644\u0645\u0639\u0631\u0641 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d.",
    startTime: "\u0648\u0642\u062a \u0627\u0644\u0628\u062f\u0621",
    endTime: "\u0648\u0642\u062a \u0627\u0644\u0627\u0646\u062a\u0647\u0627\u0621",
    rescheduleContext: "\u0633\u064a\u0627\u0642 \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062c\u062f\u0648\u0644\u0629",
    rescheduleSource: "\u0627\u0644\u0645\u0635\u062f\u0631",
    previousStatus: "\u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629",
    createdBy: "\u0623\u0646\u0634\u0626 \u0628\u0648\u0627\u0633\u0637\u0629",
    updatedBy: "\u062d\u064f\u062f\u0651\u062b \u0628\u0648\u0627\u0633\u0637\u0629",
  },
} as const;

export type AppointmentCopy = { [Key in keyof typeof copy.EN | keyof typeof pickerCopy.EN | keyof typeof detailCopy.EN]: string };
export const appointmentCopy = (language: "EN" | "AR"): AppointmentCopy => ({ ...copy[language], ...pickerCopy[language], ...detailCopy[language] });

const statuses: Record<"EN" | "AR", Record<AppointmentStatus, string>> = {
  EN: { UPCOMING: "Upcoming", CHECKED_IN: "Checked in", ACTIVE: "Active", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No-show", NEEDS_RESCHEDULE: "Needs reschedule" },
  AR: { UPCOMING: "\u0642\u0627\u062f\u0645", CHECKED_IN: "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062d\u0636\u0648\u0631", ACTIVE: "\u0646\u0634\u0637", COMPLETED: "\u0645\u0643\u062a\u0645\u0644", CANCELLED: "\u0645\u0644\u063a\u0649", NO_SHOW: "\u0645\u062a\u063a\u064a\u0628", NEEDS_RESCHEDULE: "\u062a\u062d\u062a\u0627\u062c \u0625\u0644\u0649 \u0625\u0639\u0627\u062f\u0629 \u062c\u062f\u0648\u0644\u0629" },
};

export const appointmentStatusLabel = (language: "EN" | "AR", status: AppointmentStatus) => statuses[language][status];
