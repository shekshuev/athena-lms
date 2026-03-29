import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";

import { BlockController } from "./block.controller";
import { BlockLibraryService } from "./block.library.service";
import { BlockService } from "./block.service";
import { IdentityModule } from "../../identity";
import { OutboxModule } from "../../outbox";
import { SubmissionQueueModule } from "../../submission-queue";
import { Block } from "./entities/block.entity";
import { LibraryBlock } from "./entities/library-block.entity";
import { Lesson } from "../lesson/entities/lesson.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Block, Lesson, LibraryBlock]),
    IdentityModule,
    JwtModule,
    SubmissionQueueModule,
    OutboxModule,
  ],
  providers: [BlockService, BlockLibraryService],
  controllers: [BlockController],
  exports: [BlockService, BlockLibraryService],
})
export class BlockModule {}
