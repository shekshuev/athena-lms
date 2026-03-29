/**
 * @class GetActiveExamQuery
 * @description
 * Request to retrieve an ongoing, incomplete exam attempt for a specific student and block.
 *
 * Use Case:
 * - Opening a lesson page that contains a `QuizExam` block.
 * - State recovery to prevent losing exam progress on page refresh (F5) or cross-device opening.
 *
 * Data Source:
 * - Write Model (PostgreSQL): Fetches from `quiz_attempts` table.
 * - Requires strict consistency to prevent starting duplicate concurrent exams.
 */
export class GetActiveExamQuery {
  constructor(
    /**
     * The ID of the student requesting the exam attempt.
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
  ) {}
}
