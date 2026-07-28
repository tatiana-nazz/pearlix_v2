import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import type { AppointmentAvailability, AvailabilitySlot } from "../../../types/appointments";
import { formatTime } from "../../../utils/dates";
import { useFeatureT } from "../../../layouts/i18n";

interface AvailabilityPickerProps {
  availability?: AppointmentAvailability;
  isLoading?: boolean;
  error?: unknown;
  selectedStart?: string;
  onSelect: (slot: AvailabilitySlot) => void;
  onRetry?: () => void;
}

export function AvailabilityPicker({ availability, isLoading, error, selectedStart, onSelect, onRetry }: AvailabilityPickerProps) {
  const t = useFeatureT();
  if (isLoading) return <LoadingState title={t("loadingAvailability")} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={t("unableToLoadAvailability")} />;
  if (!availability) return <p className="empty-state">{t("chooseDoctorDate")}</p>;
  if (!availability.available_slots.length) return <p className="empty-state">{t("noAvailableSlots")}</p>;

  return (
    <div className="availability-grid" aria-label={t("availableTime")}>
      {availability.available_slots.map((slot) => (
        <button
          className={slot.start_datetime === selectedStart ? "active" : ""}
          key={slot.start_datetime}
          type="button"
          onClick={() => onSelect(slot)}
        >
          <strong>
            <span className="bidi-isolate">{formatTime(slot.start_datetime)} - {formatTime(slot.end_datetime)}</span>
          </strong>
          <span>
            <span className="bidi-isolate">{slot.current_count}/{slot.capacity} {t("booked")}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
