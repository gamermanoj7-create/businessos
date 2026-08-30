import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'crypto';

// Structured request logging. Deliberately never logs request/response
// bodies (which could contain passwords, tokens, or PII) — only method,
// path, status, duration, and a correlation ID.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request>();
    const response = httpCtx.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) ?? randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} ${duration}ms [${requestId}]`,
          );
        },
        error: () => {
          const duration = Date.now() - start;
          this.logger.warn(
            `${method} ${originalUrl} ${response.statusCode} ${duration}ms [${requestId}] (error)`,
          );
        },
      }),
    );
  }
}
