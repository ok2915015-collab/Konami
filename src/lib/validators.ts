import { z } from "zod";

// Helper to strip non-digits from a phone number
export const cleanPhoneDigits = (phone: string): string => {
  return (phone || "").replace(/\D/g, "");
};

// Robust phone normalizer:
// - Removes spaces, dashes, dots, parentheses
// - Handles local CI numbers (e.g. 0701020304 -> +2250701020304)
// - Handles international formats (+33..., +221..., 00225...)
export const normalizePhoneNumber = (raw: string): string => {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/[\s\-\.\(\)]/g, "");

  // Convert leading 00 to +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // 10 digits starting with 0 (e.g., 0712345678, 0512345678, 0112345678 in Côte d'Ivoire)
  if (/^0[1-9]\d{8}$/.test(cleaned)) {
    return `+225${cleaned}`;
  }

  // 8 digits (legacy CI format, e.g. 01020304)
  if (/^\d{8}$/.test(cleaned)) {
    return `+225${cleaned}`;
  }

  // 225 followed by 8 to 10 digits without leading '+'
  if (/^225\d{8,10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Already starts with +
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Fallback: prepend + if only digits
  if (/^\d+$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
};

// Flexible phone regex for Ivory Coast and international (accepts spaces, dashes, +225, 07/05/01, etc.)
export const ivorianPhoneRegex = /^(?:\+?225|00225)?\s*0?[1-9](\s*\d){7,11}$/;

// Shared phone validation schema: accepts standard phone numbers (8 to 15 digits)
export const phoneSchema = z.string()
  .min(8, "Numéro trop court (au moins 8 chiffres)")
  .max(25, "Numéro trop long")
  .refine((val) => {
    const digits = cleanPhoneDigits(val);
    return digits.length >= 8 && digits.length <= 15;
  }, {
    message: "Numéro invalide (ex: 07 01 02 03 04 ou +225 07 01 02 03 04)",
  });

// Username regex: 4-20 alphanumeric characters or underscore
export const usernameRegex = /^[a-zA-Z0-9_]{4,20}$/;

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export const signupSchema = z.object({
  username: z.string().regex(usernameRegex, "Pseudo invalide (4-20 caractères, sans espaces)"),
  gender: z.enum(["homme", "femme"]),
  phone: phoneSchema,
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string().min(6, "Veuillez confirmer le mot de passe"),
  referralCode: z.string().optional(),
  isAdult: z.boolean().refine(val => val === true, "Vous devez avoir 18 ans ou plus"),
  acceptTerms: z.boolean().refine(val => val === true, "Vous devez accepter les conditions"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

export const otpSchema = z.object({
  otp: z.string().length(4, "Le code doit contenir 4 chiffres"),
});

export const forgotPasswordSchema = z.object({
  phone: phoneSchema,
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string().min(6, "Veuillez confirmer le mot de passe"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});
