import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class ExamReaperService implements OnModuleInit {
  private readonly logger = new Logger(ExamReaperService.name);

  constructor(@InjectQueue("exam-reaper") private readonly reaperQueue: Queue) {}

  async onModuleInit() {
    this.logger.log("Initializing Exam Reaper Cron Job...");

    await this.reaperQueue.add(
      "reap",
      {},
      {
        repeat: {
          pattern: "* * * * *",
        },
        jobId: "exam-reaper-cron",
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
