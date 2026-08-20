import type { ClinicSafeSettings, ClinicSettings, ClinicSettingsUpdatePayload, ClinicSettingsUpdateResponse } from "../../types/clinic";
import { api } from "../http";

export const clinicSettingsQueryKey = ["clinic-settings"] as const;

export const clinicApi = {
  getSettings: () => api.get<ClinicSettings | ClinicSafeSettings>("/clinic/settings/"),
  updateSettings: (payload: ClinicSettingsUpdatePayload) =>
    api.patch<ClinicSettingsUpdateResponse, ClinicSettingsUpdatePayload>("/clinic/settings/", payload),
};
