import { AppError } from "../../../shared/errors";

/**
 * The model provider failed (rate limit, 5xx, timeout, network, auth). 502: our
 * server is fine, an upstream dependency is not. The original error is kept as
 * `cause` for the log and never sent to the client.
 */
export class LLMUnavailableError extends AppError {
  constructor(cause?: unknown) {
    super(502, "LLM_UNAVAILABLE", "The assistant is temporarily unavailable, try again shortly");
    this.cause = cause;
  }
}
