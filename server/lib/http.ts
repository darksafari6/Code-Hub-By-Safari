import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from './errors.js';

type AsyncRoute = (req: Request, res: Response) => Promise<unknown> | unknown;

/** Wrap an async route so rejections reach the Express error handler. */
export function route(handler: AsyncRoute): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

/** Validate `req.body` against a zod schema, returning the typed value. */
export function parseBody<T>(schema: ZodType<T>, request: Request): T {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => {
        const location = issue.path.join('.');
        return location ? `${location}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw new HttpError(400, detail || 'Invalid request body');
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodType<T>, request: Request): T {
  const result = schema.safeParse(request.query);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => issue.message).join('; ');
    throw new HttpError(400, detail || 'Invalid query parameters');
  }
  return result.data;
}
