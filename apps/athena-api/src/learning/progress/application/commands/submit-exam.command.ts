import { SubmitExamResponse } from "@athena/types";
import { Command } from "@nestjs/cqrs";

import { SubmitExamDto } from "../dto/submit-exam.dto";

/**
 * @class SubmitExamCommand
 * @description
 * Command to evaluate a student's submission for an entire QuizExam block.
 *
 * Characteristics:
 * - Validation: Evaluates the submitted answers against the active QuizAttempt snapshot.
 * - Progress Synchronization: Automatically marks the exam block as COMPLETED in the StudentProgress aggregate if the score is >= passPercentage.
 * - State Management: Closes the active QuizAttempt and records the final score and completion time.
 *
 * Triggered by:
 * - ProgressController (when a student clicks "Submit Exam" or the timer runs out).
 */
export class SubmitExamCommand extends Command<SubmitExamResponse | void> {
  constructor(
    /**
     * The Student's Account ID.
     */
    public readonly userId: string,

    /**
     * The ID of the course containing the exam.
     */
    public readonly courseId: string,

    /**
     * The ID of the lesson containing the exam.
     */
    public readonly lessonId: string,

    /**
     * The ID of the QuizExam block.
     */
    public readonly blockId: string,

    /**
     * The student's submitted answers payload.
     */
    public readonly payload: SubmitExamDto,

    /**
     * Flag indicates if auto submit
     */
    public readonly isAutoSubmit: boolean = false,
  ) {
    super();
  }
}
