export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (msg = 'not found') => new AppError('NOT_FOUND', msg, 404);
export const badRequest = (msg: string, details?: Record<string, unknown>) =>
  new AppError('BAD_REQUEST', msg, 400, details);
export const conflict = (msg: string) => new AppError('CONFLICT', msg, 409);
export const unauthorized = (msg = 'unauthorized') => new AppError('UNAUTHORIZED', msg, 401);
export const forbidden = (msg = 'forbidden') => new AppError('FORBIDDEN', msg, 403);
export const notImplemented = (msg = 'not implemented') =>
  new AppError('NOT_IMPLEMENTED', msg, 501);
