import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { BitcoinModule } from './bitcoin/bitcoin.module';
import { EthereumModule } from './ethereum/ethereum.module';
import { WalletModule } from './wallet/wallet.module';
import { UsersModule } from './users/users.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import rateLimit from 'express-rate-limit';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './common/config/configuration';
import { User } from './users/entities/user.entity';
import { DepositAddress } from './wallet/entities/deposit-address.entity';
import { Transaction } from './wallet/entities/transaction.entity';
import { Balance } from './wallet/entities/balance.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host') || 'postgres',
        port: configService.get<number>('database.port') || 5432,
        username: configService.get<string>('database.user') || 'postgres',
        password: configService.get<string>('database.password') || 'postgres',
        database: configService.get<string>('database.name') || 'crypto_exchange',
        entities: [User, DepositAddress, Transaction, Balance],
        synchronize: true, // Set to false in production
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    EventsModule,
    BitcoinModule,
    EthereumModule,
    WalletModule,
    UsersModule,
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');

    // Trading API Rate Limit (100 req/min)
    consumer
      .apply(
        rateLimit({
          windowMs: 60 * 1000,
          limit: 100,
          standardHeaders: true,
          legacyHeaders: false,
          message: 'Too many trading requests, please try again later.',
        }),
      )
      .forRoutes('trading');

    // Market Data Rate Limit (1000 req/min)
    consumer
      .apply(
        rateLimit({
          windowMs: 60 * 1000,
          limit: 1000,
          standardHeaders: true,
          legacyHeaders: false,
          message: 'Too many market data requests, please try again later.',
        }),
      )
      .forRoutes('market');
  }
}
