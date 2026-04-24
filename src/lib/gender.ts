// Egyptian National ID gender helper
// 14 digits: digit at index 12 (13th digit) — odd = male, even = female
export type Gender = "male" | "female" | "unknown";

export function genderFromNationalId(nid?: string | null): Gender {
  if (!nid) return "unknown";
  const cleaned = nid.replace(/\D/g, "");
  if (cleaned.length !== 14) return "unknown";
  const d = parseInt(cleaned.charAt(12), 10);
  if (Number.isNaN(d)) return "unknown";
  return d % 2 === 1 ? "male" : "female";
}

export const genderLabel: Record<Gender, string> = {
  male: "ذكر",
  female: "أنثى",
  unknown: "غير معروف",
};