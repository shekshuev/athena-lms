import {
  QuizAttemptQuestionFullSnapshot,
  QuizAttemptQuestionSnapshot,
  QuizAttemptResponse,
  QuizAttemptStatus,
} from "@athena/types";
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { GetActiveExamQuery } from "../get-active-exam.query";

/**
 * @class GetActiveExamHandler
 * @description
 * Handles the retrieval of an active exam attempt, ensuring data security.
 *
 * Responsibilities:
 * - State Check: Queries PostgreSQL for an attempt with status `IN_PROGRESS` matching the user and block.
 * - Sanitization (Security): Strips sensitive data (`isCorrect`, `correctAnswerText`, `explanation`) from the `questionsSnapshot` to prevent cheating via browser DevTools.
 *
 * Use Case:
 * Called when a student visits a lesson containing an exam.
 * Returns the active attempt payload (to immediately resume the timer and UI player) or `null` (to show the "Start Exam" button).
 */
@QueryHandler(GetActiveExamQuery)
export class GetActiveExamHandler implements IQueryHandler<GetActiveExamQuery> {
  constructor(
    @InjectRepository(QuizAttemptOrmEntity)
    private readonly attemptRepo: Repository<QuizAttemptOrmEntity>,
  ) {}

  async execute(query: GetActiveExamQuery): Promise<QuizAttemptResponse | null> {
    const { userId, blockId } = query;

    const attempt = await this.attemptRepo.findOne({
      where: {
        userId,
        blockId,
        status: QuizAttemptStatus.IN_PROGRESS,
      },
    });

    if (!attempt) {
      return null;
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
