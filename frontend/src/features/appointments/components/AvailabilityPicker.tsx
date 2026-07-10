import { ErrorState } from "../../../components/ErrorState";
import { LoadingState } from "../../../components/LoadingState";
import type { AppointmentAvailability, AvailabilitySlot } from "../../../types/appointments";
import { formatTime } from "../../../utils/dates";

interface AvailabilityPickerProps {
  availability?: AppointmentAvailability;
  isLoading?: boolean;
  error?: unknown;
  selectedStart?: string;
  onSelect: (slot: AvailabilitySlot) => void;
  onRetry?: () => void;
}

export function AvailabilityPicker({ availability, isLoading, error, selectedStart, onSelect, onRetry }: AvailabilityPickerProps) {
  if (isLoading) return <LoadingState title="Loading available appointment slots..." />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Unable to load availability" />;
  if (!availability) return <p className="empty-state">Choose a doctor and date to see open slots.</p>;
  if (!availability.available_slots.length) return <p className="empty-state">No available slots for this doctor and date.</p>;

  return (
    <div className="availability-grid" aria-label="Available appointment slots">
      {availability.available_slots.map((slot) => (
        <button
          className={slot.start_datetime === selectedStart ? "active" : ""}
          key={slot.start_datetime}
          type="button"
          onClick={() => onSelect(slot)}
        >
          <strong>
            {formatTime(slot.start_datetime)} - {formatTime(slot.end_datetime)}
          </strong>
          <span>
            {slot.current_count}/{slot.capacity} booked
          </span>
        </button>
      ))}
    </div>
  );
}
