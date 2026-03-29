import { QuizAttemptStatus } from "@athena/types";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "bullmq";
import { Repository } from "typeorm";

import { QuizAttemptOrmEntity } from "../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { SubmitExamCommand } from "../commands/submit-exam.command";

@Processor("exam-reaper")
export class ExamReaperProcessor extends WorkerHost {
  private readonly logger = new Logger(ExamReaperProcessor.name);

  constructor(
    @InjectRepository(QuizAttemptOrmEntity)
    private readonly attemptRepo: Repository<QuizAttemptOrmEntity>,
    private readonly commandBus: CommandBus,
  ) {
    super();
  }

  async process(_job: Job) {
    this.logger.debug("Running Exam Reaper job...");

    const expiredAttempts = await this.attemptRepo
      .createQueryBuilder("attempt")
      .where("attempt.status = :status", { status: QuizAttemptStatus.IN_PROGRESS })
      .andWhere("attempt.timeLimitMinutes IS NOT NULL")
      .andWhere(
        "attempt.started_at + (attempt.time_limit_minutes * interval '1 minute') + interval '10 seconds' < NOW()",
      )
      .getMany();

    if (expiredAttempts.length === 0) return;

    this.logger.log(`Found ${expiredAttempts.length} expired exam attempts. Auto-submitting...`);

    for (const attempt of expiredAttempts) {
      try {
        await this.commandBus.execute(
          new SubmitExamCommand(
            attempt.userId,
            attempt.courseId,
            attempt.lessonId,
            attempt.blockId,
            { answers: [] },
            true,
          ),
        );
      } catch (error) {
        this.logger.error(`Failed to auto-submit attempt ${attempt.id}: ${(error as Error).message}`);
      }
    }
  }
}
