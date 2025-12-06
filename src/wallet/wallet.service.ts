import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { EthereumService } from '../ethereum/ethereum.service';
import { DepositAddress } from './entities/deposit-address.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private redis: Redis;
  
  // In-memory store simulating a database
  private depositAddresses: DepositAddress[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly bitcoinService: BitcoinService,
    private readonly ethereumService: EthereumService,
  ) {
    const redisHost = this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
    });
  }

  onModuleInit() {
    this.logger.log('WalletService initialized');
  }

  async assignNewAddress(userId: string, currency: string): Promise<DepositAddress> {
    let address: string;
    let derivationPath: string | undefined;

    switch (currency.toUpperCase()) {
      case 'BTC':
        address = await this.bitcoinService.generateDepositAddress(userId);
        break;
      case 'ETH':
        const wallet = this.ethereumService.createWallet();
        address = wallet.address;
        // In a real HD wallet setup, we would store the derivation path or index here
        // For now, we just store the address. 
        // Note: EthereumService.createWallet() generates a random wallet, 
        // so we would need to store the private key securely if we want to sweep funds later.
        // For this MVP, we'll assume we just watch the address.
        break;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }

    const depositAddress = new DepositAddress({
      id: uuidv4(),
      userId,
      currency: currency.toUpperCase(),
      address,
      derivationPath,
      createdAt: new Date(),
    });

    // Save to "DB"
    this.depositAddresses.push(depositAddress);

    // Cache in Redis
    // Key: wallet:address:{currency}:{address} -> userId
    await this.redis.set(
      `wallet:address:${currency.toUpperCase()}:${address}`,
      userId,
      'EX',
      60 * 60 * 24 * 7 // 7 days expiration for cache
    );

    // Key: wallet:user:{userId}:{currency} -> List of addresses
    await this.redis.rpush(
      `wallet:user:${userId}:${currency.toUpperCase()}`,
      address
    );

    this.logger.log(`Assigned new ${currency} address ${address} to user ${userId}`);
    return depositAddress;
  }

  async getAddresses(userId: string): Promise<DepositAddress[]> {
    // Try to get from "DB"
    return this.depositAddresses.filter(da => da.userId === userId);
  }

  async validateAddress(currency: string, address: string): Promise<boolean> {
    // Basic validation logic
    // In a real app, use library validators like 'multicoin-address-validator'
    if (!address) return false;

    switch (currency.toUpperCase()) {
      case 'BTC':
        // Simple regex for BTC (P2PKH, P2SH, Bech32)
        return /^[13][a-km-zA-Z1-9]{25,34}$|^bc1[a-zA-Z0-9]{39,59}$/.test(address);
      case 'ETH':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      default:
        return false;
    }
  }

  async getUserIdByAddress(currency: string, address: string): Promise<string | null> {
    // Check Redis first
    const cachedUserId = await this.redis.get(`wallet:address:${currency.toUpperCase()}:${address}`);
    if (cachedUserId) return cachedUserId;

    // Fallback to "DB"
    const found = this.depositAddresses.find(
      da => da.currency === currency.toUpperCase() && da.address === address
    );
    return found ? found.userId : null;
  }
}
