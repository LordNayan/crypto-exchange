import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    await this.seedTestUser();
  }

  async seedTestUser() {
    const testUserId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const exists = await this.userRepository.findOne({ where: { id: testUserId } });
    
    if (!exists) {
      this.logger.log('Seeding test user...');
      const user = this.userRepository.create({
        id: testUserId,
        username: 'test-user',
        email: 'test@example.com',
      });
      await this.userRepository.save(user);
      this.logger.log(`Test user seeded: ${testUserId}`);
    }
  }
}
