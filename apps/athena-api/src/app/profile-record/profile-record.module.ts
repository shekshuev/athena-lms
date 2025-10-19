import { Module } from "@nestjs/common";

import { ProfileRecordService } from "./profile-record.service";

@Module({
  providers: [ProfileRecordService],
})
export class ProfileRecordModule {}
