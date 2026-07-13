import { describe, expect, it } from "vitest";
import { bloodTypeLabel, genderLabel } from "./profile-labels";

describe("profile labels", () => {
  it("maps gender values to Vietnamese labels", () => {
    expect(genderLabel("female")).toBe("Nữ");
    expect(genderLabel("male")).toBe("Nam");
    expect(genderLabel("other")).toBe("Khác");
    expect(genderLabel("prefer_not_to_say")).toBe("Không muốn nói");
    expect(genderLabel("unknown")).toBe("unknown");
    expect(genderLabel(null)).toBe("Chưa cung cấp");
  });

  it("maps blood type values to Vietnamese labels", () => {
    expect(bloodTypeLabel("A+")).toBe("A+");
    expect(bloodTypeLabel("O-")).toBe("O-");
    expect(bloodTypeLabel("unknown")).toBe("Không rõ");
    expect(bloodTypeLabel(null)).toBe("Chưa cung cấp");
  });
});
