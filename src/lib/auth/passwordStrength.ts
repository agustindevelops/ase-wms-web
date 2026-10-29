export const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (value: string) => value.length >= 12,
  },
  {
    id: "lower",
    label: "A lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "upper",
    label: "An uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "number",
    label: "A number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "symbol",
    label: "A symbol",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export type PasswordStrengthLabel = "" | "Weak" | "Fair" | "Strong";

export function passwordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
}

export function passwordStrength(password: string): {
  score: number;
  total: number;
  label: PasswordStrengthLabel;
} {
  const total = PASSWORD_RULES.length;
  if (!password) {
    return { score: 0, total, label: "" };
  }

  const score = passwordRuleResults(password).filter((rule) => rule.met).length;
  const label: PasswordStrengthLabel =
    score === total ? "Strong" : score >= 3 ? "Fair" : "Weak";
  return { score, total, label };
}

export function isStrongPassword(password: string): boolean {
  return passwordStrength(password).label === "Strong";
}
