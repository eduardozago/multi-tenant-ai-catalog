import { AppError } from "../../shared/errors";

/** The model kept requesting tools past the cap: 502 like any other upstream failure. */
export class AgentIterationLimitError extends AppError {
  constructor(limit: number) {
    super(502, "AGENT_ITERATION_LIMIT", `The assistant could not finish the answer within ${limit} steps`);
  }
}
