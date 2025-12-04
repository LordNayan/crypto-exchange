import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only check if headers are present, otherwise skip (might be public route)
    // But if it's a protected route, the Guard will fail if headers are missing.
    // This middleware enforces nonce validity if the header exists.

    const nonce = req.headers['nyn-nonce'];

    if (nonce) {
      const nonceValue = parseInt(nonce as string, 10);
      const now = Date.now();
      const window = 5 * 60 * 1000; // 5 minutes

      if (isNaN(nonceValue)) {
        throw new UnauthorizedException('Invalid nonce');
      }

      // Check if nonce is within acceptable window (not too old, not too far in future)
      if (nonceValue < now - window || nonceValue > now + window) {
        throw new UnauthorizedException('Nonce out of time window');
      }
    }

    next();
  }
}
