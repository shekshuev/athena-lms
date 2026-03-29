import { BlockRequiredAction, BlockType, QuizQuestionContent, QuizQuestionType } from "@athena/types";
import { BadRequestException, Inject, Logger } from "@nestjs/common";
import { CommandHandler, EventPublisher, ICommandHandler } from "@nestjs/cqrs";

import { ContentService } from "../../../../../content/content.service";
import { PROGRESS_REPOSITORY, type IProgressRepository } from "../../../domain/repository/progress.repository";
import { SubmitQuizCommand } from "../submit-quiz.command";

@CommandHandler(SubmitQuizCommand)
export class SubmitQuizHandler implements ICommandHandler<SubmitQuizCommand> {
  private readonly logger = new Logger(SubmitQuizHandler.name);

  constructor(
    @Inject(PROGRESS_REPOSITORY)
    private readonly progressRepo: IProgressRepository,
    private readonly contentService: ContentService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: SubmitQuizCommand): Promise<{ isCorrect: boolean; explanation?: string }> {
    const { userId, courseId, lessonId, blockId, payload } = command;
    this.logger.log(`Executing SubmitQuizCommand | blockId=${blockId}, userId=${userId}`);

    const block = await this.contentService.getBlockInternal(blockId);

    if (block.type !== BlockType.QuizQuestion) {
      throw new BadRequestException("Block is not a quiz question");
    }

    const content = block.content as QuizQuestionContent;
    let isCorrect = false;

    switch (content.type) {
      case QuizQuestionType.Single:
      case QuizQuestionType.Multiple: {
        const correctIds = (content.options || []).filter(opt => opt.isCorrect).map(opt => opt.id);
        const selectedIds = payload.selectedOptionIds || [];

        if (correctIds.length > 0 && correctIds.length === selectedIds.length) {
          isCorrect = correctIds.every(id => selectedIds.includes(id));
        }
        break;
      }
      case QuizQuestionType.Open: {
        const expected = (content.correctAnswerText || "").trim().toLowerCase();
        const actual = (payload.textAnswer || "").trim().toLowerCase();
        isCorrect = expected === actual && expected.length > 0;
        break;
      }
    }

    if (isCorrect && block.requiredAction === BlockRequiredAction.SUBMIT) {
      const progress = await this.progressRepo.findByUserAndCourse(userId, courseId);

      if (progress) {
        try {
          const progressModel = this.publisher.mergeObjectContext(progress);

          const { totalBlocksInLesson, totalLessonsInCourse } = await this.contentService.getProgressStats(
            courseId,
            lessonId,
          );

          progressModel.completeBlockSync(blockId, lessonId, totalBlocksInLesson, totalLessonsInCourse, 100, payload);

          await this.progressRepo.save(progressModel);
          progressModel.commit();
        } catch (e) {
          this.logger.warn(`Could not auto-complete block ${blockId} for user ${userId}: ${(e as Error).message}`);
        }
      }
    }

    return {
      isCorrect,
      explanation: content.explanation,
    };
  }
}
