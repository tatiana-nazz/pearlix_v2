import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getPatients } from "../../../api/endpoints/patients";
import type { PatientListFilters } from "../../../types/patients";

export function patientListKey(filters: PatientListFilters) {
  return ["patients", filters] as const;
}

export function usePatients(filters: PatientListFilters) {
  return useQuery({
    queryKey: patientListKey(filters),
    queryFn: () => getPatients(filters),
    placeholderData: keepPreviousData,
  });
}
