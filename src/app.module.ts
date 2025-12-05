import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { BitcoinModule } from './bitcoin/bitcoin.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import rateLimit from 'express-rate-limit';

@Module({
  imports: [AuthModule, EventsModule, BitcoinModule],
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
