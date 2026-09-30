import { ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/form-errors";

// Chat-specific copy; anything else falls back to the app-wide map. Kept here rather than
// in lib/form-errors.ts because "you sent too many messages" only makes sense in the chat.
const CHAT_MESSAGES_BY_CODE: Record<string, string> = {
  TOO_MANY_REQUESTS: "Você enviou muitas mensagens em pouco tempo. Aguarde um minuto e tente de novo.",
  LLM_UNAVAILABLE: "O assistente está indisponível no momento. Tente novamente em instantes.",
  AGENT_ITERATION_LIMIT:
    "O assistente não conseguiu concluir esta resposta. Tente de novo ou reformule a pergunta.",
  CONVERSATION_NOT_FOUND: "Esta conversa não existe mais. Comece uma nova conversa.",
  STREAM_INTERRUPTED: "A conexão caiu antes do fim da resposta. Tente novamente.",
  NETWORK_ERROR: "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
  VALIDATION_ERROR: "A mensagem precisa ter entre 1 e 2.000 caracteres.",
};

export function getChatErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message = CHAT_MESSAGES_BY_CODE[error.code];
    if (message) return message;
    // Any other 502 is still the model provider failing, not the user's fault.
    if (error.status === 502) return CHAT_MESSAGES_BY_CODE.LLM_UNAVAILABLE;
  }
  return getErrorMessage(error);
}

/** Sending the same message again cannot fix these. */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && (error.code === "CONVERSATION_NOT_FOUND" || error.code === "VALIDATION_ERROR"));
}
