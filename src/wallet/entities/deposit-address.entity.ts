export class DepositAddress {
  id: string;
  userId: string;
  currency: string; // 'BTC', 'ETH', etc.
  address: string;
  derivationPath?: string; // For HD wallets
  createdAt: Date;

  constructor(partial: Partial<DepositAddress>) {
    Object.assign(this, partial);
  }
}
