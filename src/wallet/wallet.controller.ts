import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';

@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
  ) {}

  @Get('balance')
  async getBalance(
    @Query('userId') userId: string,
    @Query('currency') currency?: string,
  ) {
    if (!userId) {
      return { error: 'userId is required' };
    }

    try {
      // Get balance from Redis
      const balances: Record<string, number> = {};
      
      if (currency) {
        const balance = await this.walletService.getBalance(userId, currency.toUpperCase());
        balances[currency.toUpperCase()] = balance;
      } else {
        // Get all currency balances
        const currencies = ['BTC', 'ETH'];
        for (const curr of currencies) {
          balances[curr] = await this.walletService.getBalance(userId, curr);
        }
      }

      return {
        userId,
        balances,
      };
    } catch (error) {
      this.logger.error('Error getting balance', error);
      return { error: 'Failed to get balance' };
    }
  }

  @Get('transactions')
  async getTransactions(
    @Query('userId') userId: string,
    @Query('currency') currency?: string,
  ) {
    if (!userId) {
      return { error: 'userId is required' };
    }

    try {
      const transactions = await this.depositService.getTransactionHistory(userId, currency);
      return {
        userId,
        currency,
        transactions,
      };
    } catch (error) {
      this.logger.error('Error getting transactions', error);
      return { error: 'Failed to get transactions' };
    }
  }

  @Get('transaction')
  async getTransaction(@Query('txHash') txHash: string) {
    if (!txHash) {
      return { error: 'txHash is required' };
    }

    try {
      const transaction = await this.depositService.getTransactionByHash(txHash);
      if (!transaction) {
        return { error: 'Transaction not found' };
      }
      return transaction;
    } catch (error) {
      this.logger.error('Error getting transaction', error);
      return { error: 'Failed to get transaction' };
    }
  }

  @Get('addresses')
  async getAddresses(@Query('userId') userId: string) {
    if (!userId) {
      return { error: 'userId is required' };
    }

    try {
      const addresses = await this.walletService.getAddresses(userId);
      return {
        userId,
        addresses,
      };
    } catch (error) {
      this.logger.error(`Error getting addresses for user ${userId}`, error);
      return { error: 'Failed to get addresses' };
    }
  }

  @Post('address')
  async generateAddress(
    @Body('userId') userId: string,
    @Body('currency') currency: string,
  ) {
    if (!userId || !currency) {
      return { error: 'userId and currency are required' };
    }
    try {
      const address = await this.walletService.assignNewAddress(userId, currency);
      return address;
    } catch (error) {
      this.logger.error(`Error generating address for user ${userId} currency ${currency}`, error);
      return { error: 'Failed to generate address' };
    }
  }

  @Post('simulate-deposit')
  async simulateDeposit(
    @Body('currency') currency: string,
    @Body('amount') amount: number,
    @Body('address') address: string,
    @Body('txHash') txHash: string,
  ) {
    this.logger.log(`Simulating ${currency} deposit for ${address}`);
    
    // 1. Simulate Pending (0 confirmations)
    await this.depositService.handleDeposit(currency, txHash, amount, address, 0);
    
    // 2. Simulate Confirmed (after 2 seconds)
    setTimeout(async () => {
      this.logger.log(`Simulating confirmation for ${txHash}`);
      await this.depositService.handleDeposit(currency, txHash, amount, address, 12);
    }, 2000);

    return { status: 'simulated', txHash };
  }
}
