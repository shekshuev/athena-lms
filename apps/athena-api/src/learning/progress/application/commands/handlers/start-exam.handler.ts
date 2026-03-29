import {
  BlockType,
  QuizAttemptQuestionFullSnapshot,
  QuizAttemptQuestionSnapshot,
  QuizAttemptResponse,
  QuizAttemptStatus,
  QuizExamContent,
} from "@athena/types";
import { BadRequestException, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { ContentService } from "../../../../../content/content.service";
import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { StartExamCommand } from "../start-exam.command";

@CommandHandler(StartExamCommand)
export class StartExamHandler implements ICommandHandler<StartExamCommand> {
  private readonly logger = new Logger(StartExamHandler.name);

  constructor(
    @InjectRepository(QuizAttemptOrmEntity)
    private readonly attemptRepo: Repository<QuizAttemptOrmEntity>,
    private readonly contentService: ContentService,
  ) {}

  async execute(command: StartExamCommand): Promise<QuizAttemptResponse> {
    const { userId, courseId, lessonId, blockId } = command;
    this.logger.log(`Starting exam | user=${userId}, block=${blockId}`);

    let attempt = await this.attemptRepo.findOne({
      where: {
        userId,
        blockId,
        status: QuizAttemptStatus.IN_PROGRESS,
      },
    });

    if (!attempt) {
      const block = await this.contentService.getBlockInternal(blockId);
      if (block.type !== BlockType.QuizExam) {
        throw new BadRequestException("Block is not an exam");
      }

      const content = block.content as QuizExamContent;

      const questions = await this.contentService.generateExamQuestions(content.source);

      if (questions.length === 0) {
        throw new BadRequestException("Not enough questions in the library to start the exam");
      }

      attempt = this.attemptRepo.create({
        userId,
        blockId,
        courseId,
        lessonId,
        status: QuizAttemptStatus.IN_PROGRESS,
        questionsSnapshot: questions,
        timeLimitMinutes: content.timeLimitMinutes,
      });

      attempt = await this.attemptRepo.save(attempt);
    }

    return {
      id: attempt.id,
      blockId: attempt.blockId,
      status: attempt.status,
      questions: this.stripSecrets(attempt.questionsSnapshot),
      timeLimitMinutes: attempt.timeLimitMinutes,
      startedAt: attempt.startedAt,
    };
  }

  private stripSecrets(questions: QuizAttemptQuestionFullSnapshot[]): QuizAttemptQuestionSnapshot[] {
    return questions.map(q => {
      const sanitizedOptions = q.options?.map(opt => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isCorrect, ...rest } = opt;
        return rest;
      });

      return {
        id: q.id,
        originalBlockId: q.originalBlockId,
        type: q.type,
        question: q.question,
        options: sanitizedOptions,
      };
    });
  }
}
