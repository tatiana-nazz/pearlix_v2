import { describe, expect, it } from "vitest";

import { patientListQuery } from "./patients";

describe("patientListQuery", () => {
  it("serializes only supported patient list filters", () => {
    const query = patientListQuery({
      page: 2,
      search: "Maya",
      phone_number: "555",
      email: "maya@example.com",
      is_archived: false,
      my_patients: true,
      upcoming_with_me: false,
      last_visit_with_me: true,
    });

    expect(query).toEqual({
      page: 2,
      search: "Maya",
      name: undefined,
      first_name: undefined,
      last_name: undefined,
      phone_number: "555",
      email: "maya@example.com",
      national_id_or_passport: undefined,
      is_archived: false,
      my_patients: true,
      upcoming_with_me: undefined,
      last_visit_with_me: true,
    });
    expect(query).not.toHaveProperty("unsupported");
  });
});
