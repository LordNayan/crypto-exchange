import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ApiKey } from './entities/api-key.entity';

@Injectable()
export class AuthService {
  // In a real app, this would be a database repository
  private apiKeys: ApiKey[] = [
    new ApiKey({
      id: '1',
      userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      publicKey: 'demo-public-key',
      secretKey: 'demo-secret-key',
      permissions: ['read', 'write'],
      isActive: true,
      createdAt: new Date(),
    }),
  ];

  async findApiKey(publicKey: string): Promise<ApiKey | undefined> {
    return this.apiKeys.find(
      (key) => key.publicKey === publicKey && key.isActive,
    );
  }

  validateSignature(
    secret: string,
    signature: string,
    payload: string,
  ): boolean {
    const calculatedSignature = this.generateSignature(secret, payload);
    return calculatedSignature === signature;
  }

  generateSignature(secret: string, payload: string): string {
    const hmac = createHmac('sha384', secret);
    return hmac.update(payload).digest('hex');
  }
}
