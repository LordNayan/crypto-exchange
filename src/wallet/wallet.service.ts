import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { BitcoinService } from '../bitcoin/bitcoin.service';
import { EthereumService } from '../ethereum/ethereum.service';
import { DepositAddress } from './entities/deposit-address.entity';
import { Balance } from './entities/balance.entity';

@Injectable()
export class WalletService implements OnModuleInit {
  private readonly logger = new Logger(WalletService.name);
  private redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly bitcoinService: BitcoinService,
    private readonly ethereumService: EthereumService,
    @InjectRepository(DepositAddress)
    private readonly depositAddressRepository: Repository<DepositAddress>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
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
        break;
      default:
        throw new Error(`Unsupported currency: ${currency}`);
    }

    const depositAddress = this.depositAddressRepository.create({
      userId,
      currency: currency.toUpperCase(),
      address,
      derivationPath,
    });

    await this.depositAddressRepository.save(depositAddress);

    // Cache in Redis
    await this.redis.set(
      `wallet:address:${currency.toUpperCase()}:${address}`,
      userId,
      'EX',
      60 * 60 * 24 * 7 // 7 days expiration for cache
    );

    this.logger.log(`Assigned new ${currency} address ${address} to user ${userId}`);
    return depositAddress;
  }

  async getAddresses(userId: string): Promise<DepositAddress[]> {
    return this.depositAddressRepository.find({ where: { userId } });
  }

  async getAddressesByCurrency(currency: string): Promise<string[]> {
    const addresses = await this.depositAddressRepository.find({
      where: { currency: currency.toUpperCase() },
      select: ['address'],
    });
    return addresses.map(da => da.address);
  }

  async validateAddress(currency: string, address: string): Promise<boolean> {
    if (!address) return false;

    switch (currency.toUpperCase()) {
      case 'BTC':
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

    // Fallback to DB
    const found = await this.depositAddressRepository.findOne({
      where: { currency: currency.toUpperCase(), address },
    });
    
    if (found) {
      // Populate cache
      await this.redis.set(
        `wallet:address:${currency.toUpperCase()}:${address}`,
        found.userId,
        'EX',
        60 * 60 * 24 * 7
      );
      return found.userId;
    }
    
    return null;
  }

  async getBalance(userId: string, currency: string): Promise<number> {
    const balance = await this.balanceRepository.findOne({
      where: { userId, currency: currency.toUpperCase() },
    });
    return balance ? Number(balance.amount) : 0;
  }
}
