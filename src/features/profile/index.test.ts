import { describe, expect, it } from "vitest";
import { profileFormValuesToPayload, profileViewToFormValues, type ProfileFormValues } from "./index";
import type { ProfileView } from "../../api/profile";

describe("profile form helpers", () => {
  it("maps a profile view into editable form values", () => {
    const profileView: ProfileView["profile"] = {
      profile_id: "profile-1",
      display_name: "Alex Example",
      birth_year: 1995,
      gender: "other",
      blood_type: "O+",
      critical_allergies: ["Penicillin", "Latex"],
      important_conditions: ["Asthma"],
      critical_medications: [],
      emergency_note: "Use the right arm",
      location_alerts_enabled: true,
      emergency_contacts: [{ name: "Sam Example", relationship: "Friend", phone: "0901234567", email: "sam@example.com" }],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    expect(profileViewToFormValues(profileView)).toEqual({
      display_name: "Alex Example",
      birth_year: "1995",
      gender: "other",
      blood_type: "O+",
      critical_allergies: "Penicillin\nLatex",
      important_conditions: "Asthma",
      critical_medications: "",
      emergency_note: "Use the right arm",
      location_alerts_enabled: true,
      emergency_contacts: [{ name: "Sam Example", relationship: "Friend", phone: "0901234567", email: "sam@example.com" }],
    });
  });

  it("builds a profile payload from editable form values", () => {
    const values: ProfileFormValues = {
      display_name: "  Alex Example  ",
      birth_year: "1995",
      gender: "other",
      blood_type: "O+",
      critical_allergies: " Penicillin \n\n Latex ",
      important_conditions: "Asthma",
      critical_medications: "",
      emergency_note: "  Use the right arm  ",
      location_alerts_enabled: true,
      emergency_contacts: [
        { name: " Sam Example ", relationship: " Friend ", phone: " 0901234567 ", email: " SAM@EXAMPLE.COM " },
        { name: "", relationship: "", phone: "", email: "" },
      ],
    };

    expect(profileFormValuesToPayload(values)).toEqual({
      display_name: "Alex Example",
      birth_year: 1995,
      gender: "other",
      blood_type: "O+",
      critical_allergies: ["Penicillin", "Latex"],
      important_conditions: ["Asthma"],
      critical_medications: [],
      emergency_note: "Use the right arm",
      location_alerts_enabled: true,
      emergency_contacts: [{ name: "Sam Example", relationship: "Friend", phone: "0901234567", email: "sam@example.com" }],
    });
  });
});
