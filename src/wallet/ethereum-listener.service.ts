import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EthereumService } from '../ethereum/ethereum.service';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import Redis from 'ioredis';

@Injectable()
export class EthereumListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EthereumListenerService.name);
  private redis: Redis;
  private provider: ethers.WebSocketProvider;
  private isListening = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly ethereumService: EthereumService,
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
  ) {
    const redisHost = this.configService.get<string>('redis.host') || 'localhost';
    const redisPort = this.configService.get<number>('redis.port') || 6379;
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
    });
  }

  async onModuleInit() {
    await this.initializeWebSocketProvider();
    await this.startListening();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Ethereum listener');
    if (this.provider) {
      await this.provider.removeAllListeners();
      this.provider.destroy();
    }
    await this.redis.quit();
  }

  private async initializeWebSocketProvider() {
    try {
      // Use WebSocket provider for real-time event subscriptions
      // For production, use wss://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY or Infura
      const wsUrl = this.configService.get<string>('ethereum.wsUrl') || 
        'wss://ethereum-sepolia-rpc.publicnode.com';
      
      this.provider = new ethers.WebSocketProvider(wsUrl);
      
      const network = await this.provider.getNetwork();
      this.logger.log(`WebSocket connected to Ethereum network: ${network.name} (chainId: ${network.chainId})`);
      
      // Handle WebSocket disconnections and reconnect
      this.provider.on('error', async (error) => {
        this.logger.error('WebSocket error', error);
        await this.reconnect();
      });

    } catch (error) {
      this.logger.error('Failed to initialize WebSocket provider', error);
      // Fallback to HTTP provider if WebSocket fails
      const httpUrl = this.configService.get<string>('ethereum.rpcUrl') || 
        'https://ethereum-sepolia-rpc.publicnode.com';
      this.provider = new ethers.JsonRpcProvider(httpUrl) as any;
    }
  }

  private async reconnect() {
    if (this.isListening) {
      this.logger.log('Attempting to reconnect WebSocket...');
      try {
        await this.provider.removeAllListeners();
        this.provider.destroy();
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before reconnecting
        await this.initializeWebSocketProvider();
        await this.startListening();
      } catch (error) {
        this.logger.error('Reconnection failed', error);
      }
    }
  }

  private async startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    this.logger.log('Starting to listen for Ethereum deposits...');

    try {
      // Get all monitored addresses
      const addresses = await this.getAllMonitoredEthAddresses();
      
      if (addresses.length === 0) {
        this.logger.warn('No Ethereum addresses to monitor');
        return;
      }

      this.logger.log(`Monitoring ${addresses.length} Ethereum addresses`);

      // Listen for new blocks to check confirmations
      this.provider.on('block', async (blockNumber) => {
        this.logger.debug(`New ETH block: ${blockNumber}`);
        await this.checkPendingDeposits(blockNumber);
      });

      // Listen for incoming transactions to monitored addresses
      for (const address of addresses) {
        // Filter for transactions TO our address
        const filter = {
          address: null,
          topics: [
            null,
            null,
            ethers.zeroPadValue(address, 32), // Padded address as topic (for ERC20)
          ],
        };

        // Listen for native ETH transfers (checking each block)
        this.provider.on(filter, async (log) => {
          this.logger.log(`Event detected for address ${address}`);
          await this.handleEthereumEvent(log);
        });
      }

      // Also periodically scan for missed transactions
      this.startPeriodicScan();

    } catch (error) {
      this.logger.error('Error starting Ethereum listener', error);
      this.isListening = false;
    }
  }

  private startPeriodicScan() {
    // Scan every 2 minutes for any missed transactions
    setInterval(async () => {
      try {
        const addresses = await this.getAllMonitoredEthAddresses();
        const currentBlock = await this.provider.getBlockNumber();
        
        for (const address of addresses) {
          await this.scanAddressHistory(address, currentBlock);
        }
      } catch (error) {
        this.logger.error('Error in periodic scan', error);
      }
    }, 120000); // 2 minutes
  }

  private async handleEthereumEvent(log: ethers.Log) {
    try {
      const txHash = log.transactionHash;
      const blockNumber = log.blockNumber;
      
      // Get transaction details
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return;

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - blockNumber + 1;

      // Check if this is a deposit to one of our addresses
      if (tx.to) {
        const amount = parseFloat(ethers.formatEther(tx.value));
        
        if (amount > 0) {
          this.logger.log(
            `ETH deposit detected: ${amount} ETH to ${tx.to} (tx: ${txHash}, confirmations: ${confirmations})`,
          );

          await this.depositService.handleDeposit(
            'ETH',
            txHash,
            amount,
            tx.to,
            confirmations,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling Ethereum event', error);
    }
  }

  private async scanAddressHistory(address: string, currentBlock: number) {
    try {
      // Get last scanned block for this address
      const lastScannedKey = `eth:last_scanned:${address}`;
      const lastScanned = await this.redis.get(lastScannedKey);
      const fromBlock = lastScanned ? parseInt(lastScanned, 10) + 1 : currentBlock - 1000;

      if (fromBlock >= currentBlock) return;

      // Query transaction history (note: this requires archive node or external API like Etherscan)
      // For MVP, we'll just track from recent blocks
      const toBlock = Math.min(fromBlock + 100, currentBlock);

      this.logger.debug(`Scanning ETH address ${address} from block ${fromBlock} to ${toBlock}`);

      // This is a simplified approach - in production use Etherscan API or archive node
      for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
        const block = await this.provider.getBlock(blockNum, true);
        if (!block || !block.prefetchedTransactions) continue;

        for (const tx of block.prefetchedTransactions) {
          if (tx.to?.toLowerCase() === address.toLowerCase() && tx.value > 0n) {
            const confirmations = currentBlock - blockNum + 1;
            const amount = parseFloat(ethers.formatEther(tx.value));

            this.logger.log(
              `ETH deposit found in history: ${amount} ETH to ${tx.to} (tx: ${tx.hash}, confirmations: ${confirmations})`,
            );

            await this.depositService.handleDeposit(
              'ETH',
              tx.hash,
              amount,
              tx.to,
              confirmations,
            );
          }
        }
      }

      await this.redis.set(lastScannedKey, toBlock.toString());
    } catch (error) {
      this.logger.error(`Error scanning address history for ${address}`, error);
    }
  }

  private async checkPendingDeposits(currentBlock: number) {
    try {
      // Get all pending deposits from Redis
      const keys = await this.redis.keys('deposit:pending:ETH:*');
      
      for (const key of keys) {
        const txHash = key.replace('deposit:pending:ETH:', '');
        const data = await this.redis.get(key);
        
        if (!data) continue;
        
        const deposit = JSON.parse(data);
        const confirmations = currentBlock - deposit.blockNumber + 1;

        // Re-check if deposit meets confirmation requirements
        await this.depositService.handleDeposit(
          'ETH',
          txHash,
          deposit.amount,
          deposit.address,
          confirmations,
        );

        // If processed, remove from pending
        if (confirmations >= 12) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      this.logger.error('Error checking pending deposits', error);
    }
  }

  private async getAllMonitoredEthAddresses(): Promise<string[]> {
    return this.walletService.getAddressesByCurrency('ETH');
  }

  private async handleReorg(blockNumber: number) {
    this.logger.warn(`Handling potential Ethereum reorg at block ${blockNumber}`);
    
    // Mark deposits from affected blocks as needing revalidation
    const affectedKeys = await this.redis.keys('deposit:processed:ETH:*');
    
    for (const key of affectedKeys) {
      const txHash = key.replace('deposit:processed:ETH:', '');
      
      try {
        const tx = await this.provider.getTransaction(txHash);
        
        if (tx && tx.blockNumber && tx.blockNumber >= blockNumber) {
          // Transaction is in a potentially reorganized block
          this.logger.warn(`Transaction ${txHash} may be affected by reorg`);
          // In production, you would have more sophisticated handling here
          // such as reversing the balance update and re-processing
        }
      } catch (error) {
        this.logger.error(`Error checking transaction ${txHash} for reorg`, error);
      }
    }
  }
}
