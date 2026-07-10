import { useQuery } from "@tanstack/react-query";

import { scheduleApi } from "../../../api/endpoints/schedule";

export function useDoctors() {
  return useQuery({
    queryKey: ["doctors"],
    queryFn: () => scheduleApi.doctors(),
  });
}
