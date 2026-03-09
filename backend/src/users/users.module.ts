import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { UserPreference } from "./entities/user-preference.entity";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, UserPreference])],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
