import { Request, Response, NextFunction } from 'express';
import { AppError, BusinessError } from '../utils/errors';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Ocorreu um erro interno no servidor.';
  let code: string | undefined = undefined;
  let details: any = undefined;

  if (err instanceof BusinessError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Erro de validação';
    details = fromZodError(err).details;
  } else if (err.message && err.message.includes('permissão')) {
    statusCode = 403;
    message = err.message;
  } else if (err.message && err.message.includes('encontrado')) {
    statusCode = 404;
    message = err.message;
  } else {
    console.error(`[Unhandled Error] ${req.method} ${req.url}:`, err);
    if (err.message && !err.message.includes('Erro interno')) {
      message = err.message;
      statusCode = 400;
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    details,
    ...(process.env.NODE_ENV === 'development' && statusCode === 500 ? { stack: err.stack } : {})
  });
};
