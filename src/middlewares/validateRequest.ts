import type { Request, Response, NextFunction } from 'express';
import { ZodObject, type ZodType, ZodError } from 'zod';

export type ValidationTarget = 'body' | 'query' | 'params';

export interface RequestSchemaMap {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export type ValidationSchema = ZodType | RequestSchemaMap;

/**
 * Safely assigns validated and transformed data to req.body, req.query, or req.params.
 * In Express 5, req.query is a getter-only property on the prototype, so Object.defineProperty
 * is used as fallback when direct assignment throws a TypeError.
 */
const assignValidatedProperty = (
  req: Request,
  target: 'body' | 'query' | 'params',
  value: unknown
): void => {
  if (value === undefined || value === null) {
    return;
  }
  try {
    (req as unknown as Record<string, unknown>)[target] = value;
  } catch {
    Object.defineProperty(req, target, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
};

/**
 * Normalizes Zod issue paths so that field paths consistently include
 * the target namespace prefix ('body', 'query', 'params').
 */
const prefixIssuePaths = (issues: ZodError['issues'], defaultTarget: ValidationTarget) => {
  return issues.map((issue) => {
    const firstSegment = issue.path[0];
    const hasTargetPrefix =
      firstSegment === 'body' || firstSegment === 'query' || firstSegment === 'params';

    return {
      ...issue,
      path: hasTargetPrefix ? issue.path : [defaultTarget, ...issue.path],
    };
  });
};

/**
 * Reusable Express middleware for validating request data (body, params, query) using Zod schemas.
 *
 * Supports:
 * - Direct schema: `validateRequest(registerSchema)` (validates `req.body` directly)
 * - Container schema: `validateRequest(z.object({ body: ..., query: ..., params: ... }))`
 * - Object mapping: `validateRequest({ body: ..., query: ..., params: ... })`
 *
 * Reassigns transformed and sanitized values back to `req.body`, `req.query`, and `req.params`.
 */
export const validateRequest = (schema: ValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if ('parseAsync' in schema) {
        // Handle ZodType / ZodObject / ZodEffects / ZodUnion
        const isZodObj = schema instanceof ZodObject;
        const hasContainerKeys =
          isZodObj && ('body' in schema.shape || 'query' in schema.shape || 'params' in schema.shape);

        if (hasContainerKeys) {
          const parsed = (await schema.parseAsync({
            body: req.body ?? {},
            query: req.query ?? {},
            params: req.params ?? {},
          })) as { body?: unknown; query?: unknown; params?: unknown };

          if (parsed && typeof parsed === 'object') {
            if ('body' in parsed) {
              assignValidatedProperty(req, 'body', parsed.body);
            }
            if ('query' in parsed) {
              assignValidatedProperty(req, 'query', parsed.query);
            }
            if ('params' in parsed) {
              assignValidatedProperty(req, 'params', parsed.params);
            }
          }
        } else {
          // Direct body schema
          try {
            const bodyToValidate = req.body !== undefined ? req.body : {};
            const parsedBody = await schema.parseAsync(bodyToValidate);
            assignValidatedProperty(req, 'body', parsedBody);
          } catch (bodyError) {
            if (bodyError instanceof ZodError) {
              throw new ZodError(prefixIssuePaths(bodyError.issues, 'body'));
            }
            throw bodyError;
          }
        }
      } else {
        // Object mapping: { body?: ZodType, query?: ZodType, params?: ZodType }
        if (schema.params) {
          try {
            const parsedParams = await schema.params.parseAsync(req.params ?? {});
            assignValidatedProperty(req, 'params', parsedParams);
          } catch (paramError) {
            if (paramError instanceof ZodError) {
              throw new ZodError(prefixIssuePaths(paramError.issues, 'params'));
            }
            throw paramError;
          }
        }

        if (schema.query) {
          try {
            const parsedQuery = await schema.query.parseAsync(req.query ?? {});
            assignValidatedProperty(req, 'query', parsedQuery);
          } catch (queryError) {
            if (queryError instanceof ZodError) {
              throw new ZodError(prefixIssuePaths(queryError.issues, 'query'));
            }
            throw queryError;
          }
        }

        if (schema.body) {
          try {
            const bodyToValidate = req.body !== undefined ? req.body : {};
            const parsedBody = await schema.body.parseAsync(bodyToValidate);
            assignValidatedProperty(req, 'body', parsedBody);
          } catch (bodyError) {
            if (bodyError instanceof ZodError) {
              throw new ZodError(prefixIssuePaths(bodyError.issues, 'body'));
            }
            throw bodyError;
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
