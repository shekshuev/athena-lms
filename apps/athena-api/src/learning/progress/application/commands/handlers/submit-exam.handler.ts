import type { IEventBus } from "@athena/common";
import { BlockType, QuizAttemptStatus, QuizExamContent, QuizQuestionType } from "@athena/types";
import { BadRequestException, Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ContentService } from "../../../../../content/content.service";
import { PROGRESS_REPOSITORY, type IProgressRepository } from "../../../domain/repository/progress.repository";
import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { SubmitExamCommand } from "../submit-exam.command";

@CommandHandler(SubmitExamCommand)
export class SubmitExamHandler implements ICommandHandler<SubmitExamCommand> {
  private readonly logger = new Logger(SubmitExamHandler.name);

  private GRACED_DEADLINE_EPSILON_MS = 10000;

  constructor(
    @InjectRepository(QuizAttemptOrmEntity)
    private readonly attemptRepo: Repository<QuizAttemptOrmEntity>,
    @Inject(PROGRESS_REPOSITORY)
    private readonly progressRepo: IProgressRepository,
    private readonly contentService: ContentService,
    private readonly publisher: EventPublisher,
    @Inject("IEventBus") private readonly eventBus: IEventBus,
  ) {}

  async execute(command: SubmitExamCommand) {
    const { userId, courseId, lessonId, blockId, payload, isAutoSubmit } = command;
    this.logger.log(`Submitting exam | user=${userId}, block=${blockId}`);

    const attempt = await this.attemptRepo.findOne({
      where: { userId, blockId, status: QuizAttemptStatus.IN_PROGRESS },
    });

    if (!attempt) {
      if (isAutoSubmit) return;
      throw new BadRequestException("No active exam attempt found");
    }

    const block = await this.contentService.getBlockInternal(blockId);
    if (block.type !== BlockType.QuizExam) {
      throw new BadRequestException("Block is not an exam");
    }
    const examConfig = block.content as QuizExamContent;

    if (attempt.timeLimitMinutes && !isAutoSubmit) {
      const now = new Date();
      const deadline = new Date(attempt.startedAt.getTime() + attempt.timeLimitMinutes * 60000);
      const graceDeadline = new Date(deadline.getTime() + this.GRACED_DEADLINE_EPSILON_MS);

      if (now > graceDeadline) {
        this.logger.warn(`Attempt ${attempt.id} submitted late. Processing anyway to close it.`);
      }
    }

    let correctAnswersCount = 0;
    const totalQuestions = attempt.questionsSnapshot.length;

    for (const question of attempt.questionsSnapshot) {
      const studentAnswer = payload.answers.find(a => a.questionId === question.id);
      if (!studentAnswer) continue;

      let isCorrect = false;

      if (question.type === QuizQuestionType.Single || question.type === QuizQuestionType.Multiple) {
        const correctIds = (question.options || []).filter(o => o.isCorrect).map(o => o.id);
        const selectedIds = studentAnswer.selectedOptionIds || [];

        if (correctIds.length > 0 && correctIds.length === selectedIds.length) {
          isCorrect = correctIds.every(id => selectedIds.includes(id));
        }
      } else if (question.type === QuizQuestionType.Open) {
        const expected = (question.correctAnswerText || "").trim().toLowerCase();
        const actual = (studentAnswer.textAnswer || "").trim().toLowerCase();
        isCorrect = expected === actual && expected.length > 0;
      }

      if (isCorrect) correctAnswersCount++;
    }

    const score = Math.round((correctAnswersCount / totalQuestions) * 100);
    const passed = score >= examConfig.passPercentage;

    attempt.status = QuizAttemptStatus.COMPLETED;
    attempt.score = score;
    attempt.finishedAt = new Date();
    await this.attemptRepo.save(attempt);

    if (passed) {
      const progress = await this.progressRepo.findByUserAndCourse(userId, courseId);

      if (progress) {
        const progressModel = this.publisher.mergeObjectContext(progress);
        const { totalBlocksInLesson, totalLessonsInCourse } = await this.contentService.getProgressStats(
          courseId,
          lessonId,
        );

        progressModel.completeBlockSync(blockId, lessonId, totalBlocksInLesson, totalLessonsInCourse, score, {
          attemptId: attempt.id,
          score,
        });

        await this.progressRepo.save(progressModel);
        progressModel.commit();
      }
    }

    return {
      attemptId: attempt.id,
      score,
      passed,
      passPercentage: examConfig.passPercentage,
      correctAnswers: correctAnswersCount,
      totalQuestions,
    };
  }
}
