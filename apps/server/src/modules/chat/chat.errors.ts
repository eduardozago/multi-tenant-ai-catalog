import { AppError } from "../../shared/errors";

/**
 * The model still asked for tools on the last allowed call, even with tools disabled
 * (see D-31). 502: the dependency did not produce a usable answer; the request itself
 * was valid, so it is not a 4xx, and our server did not fail, so it is not a 500.
 */
export class AgentIterationLimitError extends AppError {
  constructor(limit: number) {
    super(502, "AGENT_ITERATION_LIMIT", `The assistant could not finish the answer within ${limit} steps`);
  }
}
