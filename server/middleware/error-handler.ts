import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
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
  let details: any = undefined;

  if (err instanceof AppError) {
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
    // Para erros que a gente já estava jogando como throw new Error('mensagem explicativa')
    if (err.message) {
      message = err.message;
      // Default to 400 if it's a known string error from our business logic that doesn't fit 404/403
      // We can refine this later by actually using the custom classes in the services
      if (!err.message.includes('Erro interno')) {
        statusCode = 400;
      }
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    ...(process.env.NODE_ENV === 'development' && statusCode === 500 ? { stack: err.stack } : {})
  });
};
