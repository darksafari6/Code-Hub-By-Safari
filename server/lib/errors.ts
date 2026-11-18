/** Error carrying an HTTP status code. Thrown by services, rendered by the
 * central error handler in `app.ts`. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
export const unsupported = (message: string) => new HttpError(415, message);
export const tooLarge = (message: string) => new HttpError(413, message);
export const upstream = (message: string) => new HttpError(502, message);

/** Narrow an unknown thrown value into a readable message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/** Extract a useful message from provider/HTTP errors. */
export function providerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError) return error.message;

  const candidate = error as {
    status?: number;
    message?: string;
    response?: { status?: number; data?: { error?: { message?: string } } };
  };

  const status = candidate?.status ?? candidate?.response?.status;
  const detail =
    candidate?.response?.data?.error?.message ?? candidate?.message ?? '';

  if (status === 401 || status === 403) {
    return 'The AI provider rejected the API key (401/403). Check the key in your .env file.';
  }
  if (status === 429) {
    return 'The AI provider rate-limited the request (429). Try again shortly.';
  }
  if (status === 404) {
    return `The AI model was not found (404). Check the model name. ${detail}`.trim();
  }
  return detail || fallback;
}
