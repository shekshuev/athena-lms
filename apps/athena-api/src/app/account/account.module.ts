import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ProfileRecord } from "../profile-record";
import { AccountService } from "./account.service";
import { Account } from "./entities/account.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Account, ProfileRecord])],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
