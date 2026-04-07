import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

/**
 * Validation targets — where to extract data from the request.
 */
type ValidationTarget = "body" | "params" | "query";

/**
 * validate() — Generic Zod validation middleware factory.
 *
 * Design: Validate-at-the-boundary pattern. Parse once at the route level,
 * pass typed objects to controllers/services. Never trust req.body directly.
 *
 * @param schema - Zod schema to validate against
 * @param target - Which part of the request to validate (body, params, query)
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), controller.register);
 *   router.get('/:id', validate(idSchema, 'params'), controller.getOne);
 */
export function validate(schema: ZodSchema, target: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      // Let the global error handler format the ZodError
      next(result.error);
      return;
    }

    // Replace raw data with parsed + validated data
    (req as Record<string, unknown>)[target] = result.data;
    next();
  };
}

/**
 * validateMultiple() — Validate multiple targets in a single middleware call.
 *
 * Usage:
 *   router.post('/:id/messages',
 *     validateMultiple({ params: sessionIdSchema, body: sendMessageSchema }),
 *     controller.sendMessage
 *   );
 */
export function validateMultiple(
  schemas: Partial<Record<ValidationTarget, ZodSchema>>
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const [target, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const result = schema.safeParse(req[target as ValidationTarget]);
      if (!result.success) {
        next(result.error);
        return;
      }
      (req as Record<string, unknown>)[target] = result.data;
    }
    next();
  };
}
