import { QuizAttemptResponse } from "@athena/types";
import { Command } from "@nestjs/cqrs";

/**
 * @class StartExamCommand
 * @description
 * Command to initiate a new Quiz Exam attempt or resume an existing one.
 *
 * Characteristics:
 * - Idempotent (Resume): If an 'IN_PROGRESS' attempt already exists for this block, it returns it.
 * - Dynamic Generation: Pulls questions randomly from the Library based on the exam's tag configuration.
 * - Security: Strips correct answers and explanations before sending the snapshot to the client.
 *
 * Triggered by:
 * - ProgressController (when a student clicks "Start Test" on an exam block).
 */
export class StartExamCommand extends Command<QuizAttemptResponse> {
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
     * The ID of the QuizExam block configuration.
     */
    public readonly blockId: string,
  ) {
    super();
  }
}
