import { Module } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { TrainersController } from './trainers.controller';
import { UsersModule } from '../users/users.module';

@Module({ imports: [UsersModule], controllers: [TrainersController], providers: [TrainersService], exports: [TrainersService] })
export class TrainersModule {}
