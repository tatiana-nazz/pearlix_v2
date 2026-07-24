import { describe, expect, it } from "vitest";

import { localizedEnum, teamUsersCopy } from "./i18n";

describe("Team and Users & Access localization", () => {
  it("provides Arabic labels for primary Team and account-management actions", () => {
    const copy = teamUsersCopy("AR");
    expect(copy.team).toBe("الفريق");
    expect(copy.usersAccess).toBe("المستخدمون والصلاحيات");
    expect(copy.addTeamMember).toBe("إضافة عضو فريق");
    expect(copy.resetPassword).toBe("إعادة تعيين كلمة المرور المؤقتة");
  });

  it("maps Team and account enums to readable localized labels", () => {
    expect(localizedEnum("EN", "PROFILE_SETUP_REQUIRED")).toBe("Professional profile integrity needs attention");
    expect(localizedEnum("AR", "DOCTOR")).toBe("طبيب");
    expect(localizedEnum("AR", "ON_LEAVE")).toBe("في إجازة");
  });
});
