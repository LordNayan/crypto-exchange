export class ApiKey {
  id: string;
  userId: string;
  publicKey: string;
  secretKey: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;

  constructor(partial: Partial<ApiKey>) {
    Object.assign(this, partial);
  }
}
