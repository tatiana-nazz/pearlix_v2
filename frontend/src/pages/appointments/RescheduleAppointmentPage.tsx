import { Navigate } from "react-router-dom";

// Rescheduling is intentionally completed in the centered appointment modal so
// the selected appointment and current list filters remain in context.
export function RescheduleAppointmentPage() {
  return <Navigate to="/staff/appointments/needs-reschedule" replace />;
}
