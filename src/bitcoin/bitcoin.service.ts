import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from "@nestjs/config";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Client = require('bitcoin-core');

@Injectable()
export class BitcoinService implements OnModuleInit {
  private client: any;
  private readonly logger = new Logger(BitcoinService.name);
  private readonly configService: ConfigService

  constructor(configService: ConfigService) {
    this.configService = configService;
    const host = this.configService.get<string>('bitcoin.rpcHost') || 'localhost';
    const port = parseInt(this.configService.get<string>('bitcoin.rpcPort') || '18332', 10);
    const walletName = 'crypto-exchange-wallet';

    this.client = new Client({
      username: this.configService.get<string>('bitcoin.rpcUser') || 'bitcoin',
      password: this.configService.get<string>('bitcoin.rpcPassword') || 'bitcoin',
      host: `http://${host}:${port}`,
      wallet: walletName,
      timeout: 30000,
    });
  }

  async onModuleInit() {
    try {
      // Create a temporary client without wallet context to check/create wallet
      const host = this.configService.get<string>('bitcoin.rpcHost') || 'localhost';
      const port = parseInt(this.configService.get<string>('bitcoin.rpcPort') || '18332', 10);
      const baseClient = new Client({
        username: this.configService.get<string>('bitcoin.rpcUser') || 'bitcoin',
        password: this.configService.get<string>('bitcoin.rpcPassword') || 'bitcoin',
        host: `http://${host}:${port}`,
        timeout: 30000,
      });

      const info = await baseClient.getNetworkInfo();
      this.logger.log(`Connected to Bitcoin Testnet: ${info.version}`);

      // Ensure wallet is loaded
      const walletName = 'crypto-exchange-wallet';
      try {
        const wallets = await baseClient.listWallets();
        if (!wallets.includes(walletName)) {
          try {
            await baseClient.loadWallet(walletName);
            this.logger.log(`Loaded wallet: ${walletName}`);
          } catch (e) {
            // If load fails, try creating it
            await baseClient.createWallet(walletName);
            this.logger.log(`Created wallet: ${walletName}`);
          }
        }
      } catch (error) {
        this.logger.warn('Wallet management error:', error.message);
      }

      this.listenForDeposits();
    } catch (error) {
      this.logger.error('Failed to connect to Bitcoin node. Make sure bitcoind is running.', error.message);
    }
  }

  async generateDepositAddress(userId: string): Promise<string> {
    try {
      // Using getnewaddress with userId as label
      // Note: In production, you should manage addresses in your own DB
      // and not rely solely on the node's wallet.
      return await this.client.getNewAddress(userId);
    } catch (error) {
      this.logger.error(`Failed to generate deposit address for user ${userId}`, error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<number> {
    try {
      // getreceivedbyaddress returns the total amount received by the address
      // minConf = 1
      return await this.client.getReceivedByAddress(address, 1);
    } catch (error) {
      this.logger.error(`Failed to get balance for address ${address}`, error);
      throw error;
    }
  }

  async sendTransaction(to: string, amount: number): Promise<string> {
    try {
      // sendtoaddress returns the transaction ID
      return await this.client.sendToAddress(to, amount);
    } catch (error) {
      this.logger.error(`Failed to send ${amount} to ${to}`, error);
      throw error;
    }
  }

  async listenForDeposits() {
    this.logger.log('Started listening for deposits...');
    
    // Simple polling mechanism
    setInterval(async () => {
      try {
        // listtransactions(label, count, skip)
        // '*' means all labels
        const transactions = await this.client.listTransactions('*', 10, 0);
        
        const deposits = transactions.filter((tx: any) => 
          tx.category === 'receive' && 
          tx.confirmations > 0
        );

        if (deposits.length > 0) {
          this.logger.debug(`Found ${deposits.length} confirmed deposits`);
          // Here you would emit an event or update the database
          // e.g. this.eventEmitter.emit('deposit.received', deposits);
        }
      } catch (error) {
        // Suppress error logs if it's just a connection issue during startup
        // or handle specific RPC errors
        this.logger.error('Error polling for deposits', error.message);
      }
    }, 60000); // Poll every minute
  }
}
