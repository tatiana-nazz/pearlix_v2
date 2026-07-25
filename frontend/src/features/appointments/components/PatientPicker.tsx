import { useEffect, useMemo, useState } from "react";

import { Combobox, type ComboboxOption } from "../../../components/v2";
import { useAuthStore } from "../../../auth/authStore";
import { usePatients } from "../../patients/hooks/usePatients";
import type { PatientListItem } from "../../../types/patients";
import { appointmentCopy } from "../i18n";

const MINIMUM_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

interface PatientPickerProps {
  selectedPatient: PatientListItem | null;
  error?: string;
  disabled?: boolean;
  onSelect: (patient: PatientListItem) => void;
  onClear: () => void;
}

function patientDescription(patient: PatientListItem): string | undefined {
  const details = [patient.phone_number, patient.age === null ? null : `${patient.age} years`].filter(Boolean);
  return details.length ? details.join(" · ") : undefined;
}

export function PatientPicker({ selectedPatient, error, disabled = false, onSelect, onClear }: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const language = useAuthStore((state) => state.user?.language_preference ?? "EN");
  const c = appointmentCopy(language);
  const normalizedQuery = query.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizedQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedQuery]);

  const canSearch = debouncedQuery.length >= MINIMUM_SEARCH_LENGTH && !disabled;
  const patients = usePatients({ search: debouncedQuery, is_archived: false }, canSearch);
  const results = useMemo(
    () => (patients.data?.results ?? []).filter((patient) => !patient.is_archived),
    [patients.data?.results],
  );
  const options = useMemo<ComboboxOption[]>(
    () => results.map((patient) => ({ value: String(patient.id), label: patient.full_name, description: patientDescription(patient) })),
    [results],
  );

  function select(option: ComboboxOption) {
    const patient = results.find((candidate) => String(candidate.id) === option.value);
    if (!patient) return;
    onSelect(patient);
    setQuery("");
    setDebouncedQuery("");
  }

  const searchHelp = disabled
    ? undefined
    : normalizedQuery.length < MINIMUM_SEARCH_LENGTH
      ? c.typeToSearchPatients
      : undefined;
  const noOptionsMessage = canSearch && !patients.isLoading && !patients.isError ? c.noPatientsFound : undefined;

  return (
    <div className="appointment-patient-picker">
      <Combobox
        label={c.patient}
        value={query}
        onChange={setQuery}
        options={options}
        placeholder={c.searchPatients}
        onSelect={select}
        selectedLabel={selectedPatient ? `${c.selectedPatient}: ${selectedPatient.full_name}` : undefined}
        onClear={selectedPatient && !disabled ? onClear : undefined}
        clearLabel={c.clearPatient}
        loading={canSearch && patients.isLoading}
        loadingMessage={c.searchingPatients}
        error={canSearch && patients.isError ? c.unableToLoadPatients : undefined}
        onRetry={canSearch && patients.isError ? () => void patients.refetch() : undefined}
        noOptionsMessage={noOptionsMessage}
        help={searchHelp}
        disabled={disabled}
      />
      {error ? <span className="v2-field-error" role="alert">{error}</span> : null}
    </div>
  );
}
