import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError, getValidationIssues } from "@/lib/api-client";

// Server messages are English and meant for developers; the UI maps codes to pt-BR copy.
const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_CREDENTIALS: "Email ou senha inválidos",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um minuto e tente novamente.",
  NETWORK_ERROR: "Não foi possível conectar ao servidor. Verifique sua conexão.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  VALIDATION_ERROR: "Revise os campos destacados.",
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES_BY_CODE[error.code] ?? "Algo deu errado. Tente novamente.";
  }
  return "Algo deu errado. Tente novamente.";
}

/**
 * Puts server-side validation issues on the matching form fields.
 * Returns true when at least one field received an error, so the caller can skip the banner.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError)) return false;

  if (error.code === "EMAIL_TAKEN" && fields.includes("email" as Path<T>)) {
    setError("email" as Path<T>, { message: "Este email já está em uso" }, { shouldFocus: true });
    return true;
  }

  let applied = false;
  for (const issue of getValidationIssues(error)) {
    const field = issue.path as Path<T>;
    if (!fields.includes(field)) continue;
    setError(field, { message: "Valor inválido" }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}
