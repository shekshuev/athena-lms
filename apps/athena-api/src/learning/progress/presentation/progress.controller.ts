import { Permission } from "@athena/types";
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";

import { JwtAuthGuard } from "../../../identity/account/guards/jwt.guard";
import { AclGuard } from "../../../identity/acl/acl.guard";
import { RequirePermission } from "../../../identity/acl/decorators/require-permission.decorator";
import { CurrentUser } from "../../../shared/decorators/current-user.decorator";
import { CompleteBlockSyncCommand } from "../application/commands/complete-block-sync.command";
import { StartExamCommand } from "../application/commands/start-exam.command";
import { SubmitAssignmentCommand } from "../application/commands/submit-assignment.command";
import { SubmitExamCommand } from "../application/commands/submit-exam.command";
import { SubmitQuizCommand } from "../application/commands/submit-quiz.command";
import { StudentSubmissionDto } from "../application/dto/student-submission.dto";
import { SubmitExamDto } from "../application/dto/submit-exam.dto";
import { SubmitQuizDto } from "../application/dto/submit-quiz.dto";
import { GetActiveExamQuery } from "../application/queries/get-active-exam.query";
import { GetStudentDashboardQuery } from "../application/queries/get-student-dashboard.query";
import { GetStudentLessonQuery } from "../application/queries/get-student-lesson.query";
import { GetStudentProgressQuery } from "../application/queries/get-student-progress.query";

/**
 * @class ProgressController
 * @description
 * The HTTP entry point for Student Progress operations.
 *
 * Architecture Role:
 * - Acts as an Adapter layer.
 * - Converts HTTP Requests -> Domain Commands/Queries.
 * - Delegates all logic to the CQRS CommandBus/QueryBus.
 *
 * Security:
 * - Protected by JWT (Authentication).
 * - Protected by ACL (Authorization via `ENROLLMENTS_READ` permission).
 */
@Controller("progress")
@UseGuards(JwtAuthGuard, AclGuard)
export class ProgressController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Async Submission (Code Challenge).
   * Returns 202 Accepted because the grading happens in the background (Saga -> Runner).
   */
  @Post(":courseId/lessons/:lessonId/blocks/:blockId/submit")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async submitAssignment(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @Body() dto: StudentSubmissionDto,
    @CurrentUser("sub") userId: string,
  ): Promise<{ status: string }> {
    await this.commandBus.execute(new SubmitAssignmentCommand(userId, courseId, lessonId, blockId, dto));
    return { status: "pending" };
  }

  /**
   * Sync Completion (Video, Text).
   * Returns 200 OK because the score is calculated immediately (100%).
   */
  @Post(":courseId/lessons/:lessonId/blocks/:blockId/view")
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async markAsViewed(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @CurrentUser("sub") userId: string,
  ): Promise<{ status: string; score: number }> {
    const score = 100;

    await this.commandBus.execute(new CompleteBlockSyncCommand(userId, courseId, lessonId, blockId, score));

    return { status: "completed", score };
  }

  /**
   * Submit Quiz Question Answer
   * Returns 200 OK with isCorrect flag and explanation
   */
  @Post(":courseId/lessons/:lessonId/blocks/:blockId/quiz")
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async submitQuiz(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser("sub") userId: string,
  ) {
    return this.commandBus.execute(new SubmitQuizCommand(userId, courseId, lessonId, blockId, dto));
  }

  /**
   * Submits an active Quiz Exam attempt.
   * Calculates score and syncs with Progress if passed.
   */
  @Post(":courseId/lessons/:lessonId/blocks/:blockId/exam/submit")
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async submitExam(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @Body() dto: SubmitExamDto,
    @CurrentUser("sub") userId: string,
  ) {
    return this.commandBus.execute(new SubmitExamCommand(userId, courseId, lessonId, blockId, dto));
  }

  /**
   * Fetches the main dashboard (List of enrolled courses with high-level stats).
   */
  @Get()
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async getMyDashboard(@CurrentUser("sub") userId: string) {
    return this.queryBus.execute(new GetStudentDashboardQuery(userId));
  }

  /**
   * Fetches the detailed map of a specific course (Lessons, Blocks, Statuses).
   */
  @Get(":courseId")
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async getMyProgress(@Param("courseId", new ParseUUIDPipe()) courseId: string, @CurrentUser("sub") userId: string) {
    return this.queryBus.execute(new GetStudentProgressQuery(userId, courseId));
  }

  /**
   * Fetches the detailed map of a specific course (Lessons, Blocks, Statuses).
   */
  @Get(":courseId/lesson/:lessonId")
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async getLesson(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.queryBus.execute(new GetStudentLessonQuery(userId, courseId, lessonId));
  }

  /**
   * Gets an active Quiz Exam attempt if it exists.
   * Returns null if there is no active attempt (meaning the student hasn't started or already finished).
   */
  @Get(":courseId/lessons/:lessonId/blocks/:blockId/exam/active")
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async getActiveExam(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.queryBus.execute(new GetActiveExamQuery(userId, courseId, lessonId, blockId));
  }

  /**
   * Starts a new Quiz Exam attempt or returns an existing active one.
   */
  @Post(":courseId/lessons/:lessonId/blocks/:blockId/exam/start")
  @HttpCode(HttpStatus.OK)
  @RequirePermission(Permission.ENROLLMENTS_READ)
  async startExam(
    @Param("courseId", new ParseUUIDPipe()) courseId: string,
    @Param("lessonId", new ParseUUIDPipe()) lessonId: string,
    @Param("blockId", new ParseUUIDPipe()) blockId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.commandBus.execute(new StartExamCommand(userId, courseId, lessonId, blockId));
  }
}
