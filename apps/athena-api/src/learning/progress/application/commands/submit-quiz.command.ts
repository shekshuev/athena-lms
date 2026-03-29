import { Command } from "@nestjs/cqrs";

import { SubmitQuizDto } from "../dto/submit-quiz.dto";

/**
 * @class SubmitQuizCommand
 * @description
 * Command to evaluate a student's answer for a standalone QuizQuestion block.
 *
 * Characteristics:
 * - Validation: Evaluates the submitted answer (single/multiple choice or open text) against the original block.
 * - Progress Synchronization: Automatically marks the block as COMPLETED in the StudentProgress aggregate if correct.
 * - Immediate Feedback: Returns the boolean result and an explanation.
 *
 * Triggered by:
 * - ProgressController (when a student clicks "Check" on an atomic quiz question).
 */
export class SubmitQuizCommand extends Command<{ isCorrect: boolean; explanation?: string }> {
  constructor(
    /**
     * The Student's Account ID.
     */
    public readonly userId: string,

    /**
     * The ID of the course containing the question.
     */
    public readonly courseId: string,

    /**
     * The ID of the lesson containing the question.
     */
    public readonly lessonId: string,

    /**
     * The ID of the standalone QuizQuestion block.
     */
    public readonly blockId: string,

    /**
     * The student's submitted answer payload.
     */
    public readonly payload: SubmitQuizDto,
  ) {
    super();
  }
}
