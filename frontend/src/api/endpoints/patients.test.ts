import { describe, expect, it } from "vitest";

import { patientListQuery } from "./patients";

describe("patientListQuery", () => {
  it("serializes only supported patient list filters", () => {
    const query = patientListQuery({
      page: 2,
      search: "Maya",
      is_archived: false,
      my_patients: true,
      upcoming_with_me: false,
      last_visit_with_me: true,
    });

    expect(query).toEqual({
      page: 2,
      search: "Maya",
      name: undefined,
      phone: undefined,
      is_archived: false,
      my_patients: true,
      upcoming_with_me: undefined,
      last_visit_with_me: true,
    });
    expect(query).not.toHaveProperty("unsupported");
  });
});
