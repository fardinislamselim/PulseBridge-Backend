export interface IApiError {
  success: false;
  message: string;
  errors: unknown[];
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    errors: unknown[] = [],
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  public toJSON(): IApiError {
    return {
      success: false,
      message: this.message,
      errors: this.errors,
    };
  }

  public static badRequest(message = 'Bad Request', errors: unknown[] = []): ApiError {
    return new ApiError(400, message, errors);
  }

  public static unauthorized(message = 'Unauthorized', errors: unknown[] = []): ApiError {
    return new ApiError(401, message, errors);
  }

  public static forbidden(message = 'Forbidden', errors: unknown[] = []): ApiError {
    return new ApiError(403, message, errors);
  }

  public static notFound(message = 'Resource not found', errors: unknown[] = []): ApiError {
    return new ApiError(404, message, errors);
  }

  public static conflict(message = 'Conflict', errors: unknown[] = []): ApiError {
    return new ApiError(409, message, errors);
  }

  public static tooManyRequests(
    message = 'Too many requests, please try again later',
    errors: unknown[] = []
  ): ApiError {
    return new ApiError(429, message, errors);
  }

  public static internal(message = 'Internal Server Error', errors: unknown[] = []): ApiError {
    return new ApiError(500, message, errors, false);
  }

  public static serviceUnavailable(
    message = 'Service Unavailable',
    errors: unknown[] = []
  ): ApiError {
    return new ApiError(503, message, errors, true);
  }
}
