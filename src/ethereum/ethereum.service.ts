import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EthereumService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet; // The exchange's hot wallet
  private readonly logger = new Logger(EthereumService.name);
  
  constructor(private readonly configService: ConfigService) {
    // Default to Sepolia testnet if not specified
    // Using a more reliable public node. For production, use Alchemy or Infura.
    const rpcUrl = this.configService.get<string>('ethereum.rpcUrl') || 'https://ethereum-sepolia-rpc.publicnode.com';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize exchange wallet from private key
    const privateKey = this.configService.get<string>('ethereum.privateKey');
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
    }
  }

  async onModuleInit() {
    try {
      const network = await this.provider.getNetwork();
      this.logger.log(`Connected to Ethereum network: ${network.name} (chainId: ${network.chainId})`);
      
      if (this.wallet) {
        this.logger.log(`Exchange wallet loaded: ${this.wallet.address}`);
      } else {
        this.logger.warn('No ETHEREUM_PRIVATE_KEY provided. Sending transactions will not work.');
      }

      this.listenForTransfers();
    } catch (error) {
      this.logger.error('Failed to connect to Ethereum node', error);
    }
  }

  createWallet() {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
    };
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      this.logger.error(`Failed to get balance for ${address}`, error);
      throw error;
    }
  }

  async sendTransaction(to: string, amount: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Exchange wallet not initialized');
    }

    try {
      const tx = await this.wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      this.logger.error(`Failed to send ${amount} ETH to ${to}`, error);
      throw error;
    }
  }

  async listenForTransfers() {
    this.logger.log('Listening for new blocks...');
    
    this.provider.on('block', async (blockNumber) => {
      try {
        const block = await this.provider.getBlock(blockNumber, true);
        if (!block || !block.prefetchedTransactions) return;

        for (const tx of block.prefetchedTransactions) {
          // In a real app, you would check if tx.to matches any of your user's deposit addresses
          // For now, we just log incoming transfers to our exchange wallet if it exists
          if (this.wallet && tx.to && tx.to.toLowerCase() === this.wallet.address.toLowerCase()) {
            this.logger.log(`Incoming transfer detected! Hash: ${tx.hash}, From: ${tx.from}, Value: ${ethers.formatEther(tx.value)} ETH`);
            // Emit event or update DB here
          }
        }
      } catch (error) {
        this.logger.error(`Error processing block ${blockNumber}`, error);
      }
    });
  }

  async getConfirmations(txHash: string): Promise<number> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx || !tx.blockNumber) return 0;

      const currentBlock = await this.provider.getBlockNumber();
      return currentBlock - tx.blockNumber + 1;
    } catch (error) {
      this.logger.error(`Failed to get confirmations for ${txHash}`, error);
      return 0;
    }
  }
  
  // Helper for ERC20 interaction (placeholder)
  getContract(address: string, abi: any[]) {
    return new ethers.Contract(address, abi, this.provider);
  }
}
