import type { ClinicSafeSettings, ClinicSettings, ClinicSettingsUpdatePayload } from "../../types/clinic";
import { api } from "../http";

export const clinicApi = {
  getSettings: () => api.get<ClinicSettings | ClinicSafeSettings>("/clinic/settings/"),
  updateSettings: (payload: ClinicSettingsUpdatePayload) =>
    api.patch<ClinicSettings, ClinicSettingsUpdatePayload>("/clinic/settings/", payload),
};
