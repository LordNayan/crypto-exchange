import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { IS_API_KEY_PROTECTED } from '../decorators/api-key-protected.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isProtected = this.reflector.getAllAndOverride<boolean>(
      IS_API_KEY_PROTECTED,
      [context.getHandler(), context.getClass()],
    );

    if (!isProtected) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['nyn-apikey'] as string;
    const signature = request.headers['nyn-signature'] as string;
    const nonce = request.headers['nyn-nonce'] as string;

    if (!apiKey || !signature || !nonce) {
      throw new UnauthorizedException('Missing API key headers');
    }

    const keyEntity = await this.authService.findApiKey(apiKey);
    if (!keyEntity) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Signature format: timestamp + method + path + body
    const path = request.path;
    const method = request.method.toUpperCase();
    const body =
      Object.keys(request.body).length > 0 ? JSON.stringify(request.body) : '';
    const payload = `${nonce}${method}${path}${body}`;

    const isValid = this.authService.validateSignature(
      keyEntity.secretKey,
      signature,
      payload,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Attach user/key to request for controllers
    request['user'] = {
      userId: keyEntity.userId,
      permissions: keyEntity.permissions,
    };
    request['apiKey'] = keyEntity;

    return true;
  }
}
