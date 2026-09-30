export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHENTICATED", message = "Authentication required") {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(code = "NOT_FOUND", message = "Resource not found") {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(code = "CONFLICT", message = "Resource already exists") {
    super(409, code, message);
  }
}

/**
 * Thrown by the tenantScoped plugin when a query on a tenant-owned collection
 * has no `company_id` filter, or a write would put a document in another tenant.
 * It is a programming error, not a client error, so it is intentionally not an
 * AppError: the handler turns it into a generic 500.
 */
export class TenantScopeError extends Error {
  constructor(model: string, operation: string, reason = "without a company_id filter") {
    super(`Tenant scope violation: ${model}.${operation} ${reason}`);
    this.name = "TenantScopeError";
  }
}
