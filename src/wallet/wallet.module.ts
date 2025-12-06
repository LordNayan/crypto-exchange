import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { BitcoinModule } from '../bitcoin/bitcoin.module';
import { EthereumModule } from '../ethereum/ethereum.module';

@Module({
  imports: [BitcoinModule, EthereumModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
