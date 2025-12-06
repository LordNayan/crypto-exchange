import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { BitcoinPollerService } from './bitcoin-poller.service';
import { EthereumListenerService } from './ethereum-listener.service';
import { ConfirmationMonitorService } from './confirmation-monitor.service';
import { DepositEventSubscriber } from './deposit-event-subscriber';
import { WalletController } from './wallet.controller';
import { BitcoinModule } from '../bitcoin/bitcoin.module';
import { EthereumModule } from '../ethereum/ethereum.module';
import { EventsModule } from '../events/events.module';
import { DepositAddress } from './entities/deposit-address.entity';
import { Transaction } from './entities/transaction.entity';
import { Balance } from './entities/balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DepositAddress, Transaction, Balance]),
    forwardRef(() => BitcoinModule),
    forwardRef(() => EthereumModule),
    EventsModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    DepositService,
    BitcoinPollerService,
    EthereumListenerService,
    ConfirmationMonitorService,
    DepositEventSubscriber,
  ],
  exports: [WalletService, DepositService],
})
export class WalletModule {}
