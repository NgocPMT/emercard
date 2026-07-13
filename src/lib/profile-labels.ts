const genderLabels = {
  female: "Nữ",
  male: "Nam",
  other: "Khác",
  prefer_not_to_say: "Không muốn nói",
} as const;

const bloodTypeLabels = {
  "A+": "A+",
  "A-": "A-",
  "B+": "B+",
  "B-": "B-",
  "AB+": "AB+",
  "AB-": "AB-",
  "O+": "O+",
  "O-": "O-",
  unknown: "Không rõ",
} as const;

export function genderLabel(value: string | null | undefined) {
  if (!value) return "Chưa cung cấp";
  return genderLabels[value as keyof typeof genderLabels] ?? value;
}

export function bloodTypeLabel(value: string | null | undefined) {
  if (!value) return "Chưa cung cấp";
  return bloodTypeLabels[value as keyof typeof bloodTypeLabels] ?? value;
}
