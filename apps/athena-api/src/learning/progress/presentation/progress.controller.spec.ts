import { ProgrammingLanguage } from "@athena/types";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";

import { ProgressController } from "./progress.controller";
import { JwtAuthGuard } from "../../../identity/account/guards/jwt.guard";
import { AclGuard } from "../../../identity/acl/acl.guard";
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

const mockCommandBus = {
  execute: jest.fn(),
};

const mockQueryBus = {
  execute: jest.fn(),
};

describe("ProgressController", () => {
  let controller: ProgressController;

  const USER_ID = "user-123";
  const COURSE_ID = "course-123";
  const LESSON_ID = "lesson-1";
  const BLOCK_ID = "block-1";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: QueryBus, useValue: mockQueryBus },
      ],
    })

      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AclGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgressController>(ProgressController);

    jest.clearAllMocks();
  });

  describe("submitAssignment (POST .../submit)", () => {
    it("should dispatch SubmitAssignmentCommand and return pending status", async () => {
      const dto: StudentSubmissionDto = {
        code: "console.log('hi')",
        language: ProgrammingLanguage.Python,
        socketId: "socket-1",
      };

      const result = await controller.submitAssignment(COURSE_ID, LESSON_ID, BLOCK_ID, dto, USER_ID);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new SubmitAssignmentCommand(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID, dto),
      );
      expect(result).toEqual({ status: "pending" });
    });
  });

  describe("markAsViewed (POST .../view)", () => {
    it("should dispatch CompleteBlockSyncCommand with score 100", async () => {
      const result = await controller.markAsViewed(COURSE_ID, LESSON_ID, BLOCK_ID, USER_ID);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new CompleteBlockSyncCommand(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID, 100),
      );
      expect(result).toEqual({ status: "completed", score: 100 });
    });
  });

  describe("submitQuiz (POST .../quiz)", () => {
    it("should dispatch SubmitQuizCommand and return result", async () => {
      const dto: SubmitQuizDto = {
        selectedOptionIds: ["opt-1", "opt-2"],
      };

      const expectedResponse = { isCorrect: true, explanation: "Good job!" };
      mockCommandBus.execute.mockResolvedValue(expectedResponse);

      const result = await controller.submitQuiz(COURSE_ID, LESSON_ID, BLOCK_ID, dto, USER_ID);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new SubmitQuizCommand(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID, dto),
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("getMyDashboard (GET /)", () => {
    it("should execute GetStudentDashboardQuery", async () => {
      const mockResult = [{ title: "React" }];
      mockQueryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getMyDashboard(USER_ID);

      expect(mockQueryBus.execute).toHaveBeenCalledWith(new GetStudentDashboardQuery(USER_ID));
      expect(result).toEqual(mockResult);
    });
  });

  describe("getMyProgress (GET /:courseId)", () => {
    it("should execute GetStudentProgressQuery", async () => {
      const mockResult = { courseId: COURSE_ID, percentage: 50 };
      mockQueryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getMyProgress(COURSE_ID, USER_ID);

      expect(mockQueryBus.execute).toHaveBeenCalledWith(new GetStudentProgressQuery(USER_ID, COURSE_ID));
      expect(result).toEqual(mockResult);
    });
  });

  describe("getLesson (GET /:courseId/lesson/:lessonId)", () => {
    it("should execute GetStudentLessonQuery", async () => {
      const mockResult = { courseId: COURSE_ID };
      mockQueryBus.execute.mockResolvedValue(mockResult);

      const result = await controller.getLesson(COURSE_ID, LESSON_ID, USER_ID);

      expect(mockQueryBus.execute).toHaveBeenCalledWith(new GetStudentLessonQuery(USER_ID, COURSE_ID, LESSON_ID));
      expect(result).toEqual(mockResult);
    });
  });

  describe("startExam (POST .../exam/start)", () => {
    it("should dispatch StartExamCommand and return the attempt payload", async () => {
      const expectedResponse = { id: "attempt-1", status: "IN_PROGRESS", questions: [] };
      mockCommandBus.execute.mockResolvedValue(expectedResponse);

      const result = await controller.startExam(COURSE_ID, LESSON_ID, BLOCK_ID, USER_ID);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new StartExamCommand(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID),
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("submitExam (POST .../exam/submit)", () => {
    it("should dispatch SubmitExamCommand and return score result", async () => {
      const dto: SubmitExamDto = {
        answers: [{ questionId: "q-1", selectedOptionIds: ["opt-1"] }],
      };

      const expectedResponse = { passed: true, score: 100 };
      mockCommandBus.execute.mockResolvedValue(expectedResponse);

      const result = await controller.submitExam(COURSE_ID, LESSON_ID, BLOCK_ID, dto, USER_ID);

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new SubmitExamCommand(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID, dto),
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("getActiveExam (GET .../exam/active)", () => {
    it("should execute GetActiveExamQuery", async () => {
      const expectedResponse = { id: "attempt-1" };
      mockQueryBus.execute.mockResolvedValue(expectedResponse);

      const result = await controller.getActiveExam(COURSE_ID, LESSON_ID, BLOCK_ID, USER_ID);

      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        new GetActiveExamQuery(USER_ID, COURSE_ID, LESSON_ID, BLOCK_ID),
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
