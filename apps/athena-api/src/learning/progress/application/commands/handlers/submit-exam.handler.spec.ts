import { BlockType, QuizAttemptStatus, QuizQuestionType } from "@athena/types";
import { BadRequestException } from "@nestjs/common";
import { EventPublisher } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { SubmitExamHandler } from "./submit-exam.handler";
import { ContentService } from "../../../../../content/content.service";
import { AthenaEvent } from "../../../../../shared/events/types";
import { PROGRESS_REPOSITORY } from "../../../domain/repository/progress.repository";
import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { SubmitExamCommand } from "../submit-exam.command";

const mockAttemptRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockProgressRepo = {
  findByUserAndCourse: jest.fn(),
  save: jest.fn(),
};

const mockContentService = {
  getBlockInternal: jest.fn(),
  getProgressStats: jest.fn(),
};

const mockPublisher = {
  mergeObjectContext: jest.fn(obj => obj),
};

const mockAggregate = {
  completeBlockSync: jest.fn(),
  commit: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

describe("SubmitExamHandler", () => {
  let handler: SubmitExamHandler;

  const CMD_BASE = {
    userId: "user-1",
    courseId: "course-1",
    lessonId: "lesson-1",
    blockId: "block-1",
  };

  const mockQuestionsSnapshot = [
    {
      id: "q-1",
      type: QuizQuestionType.Single,
      options: [
        { id: "opt-1", isCorrect: true },
        { id: "opt-2", isCorrect: false },
      ],
    },
    {
      id: "q-2",
      type: QuizQuestionType.Open,
      correctAnswerText: "SQL",
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitExamHandler,
        { provide: getRepositoryToken(QuizAttemptOrmEntity), useValue: mockAttemptRepo },
        { provide: PROGRESS_REPOSITORY, useValue: mockProgressRepo },
        { provide: ContentService, useValue: mockContentService },
        { provide: EventPublisher, useValue: mockPublisher },
        { provide: "IEventBus", useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<SubmitExamHandler>(SubmitExamHandler);
    jest.clearAllMocks();
  });

  it("should throw BadRequestException if no active attempt exists", async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);
    const cmd = new SubmitExamCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
      answers: [],
    });
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it("should ignore missing attempt if isAutoSubmit is true", async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);
    const cmd = new SubmitExamCommand(
      CMD_BASE.userId,
      CMD_BASE.courseId,
      CMD_BASE.lessonId,
      CMD_BASE.blockId,
      { answers: [] },
      true,
    );

    const result = await handler.execute(cmd);

    expect(result).toBeUndefined();
  });

  it("should fail the student automatically if time limit exceeded by more than 10 seconds", async () => {
    const pastDate = new Date(Date.now() - 20 * 60000);
    mockAttemptRepo.findOne.mockResolvedValue({
      id: "attempt-1",
      timeLimitMinutes: 10,
      startedAt: pastDate,
      questionsSnapshot: mockQuestionsSnapshot,
    });
    mockContentService.getBlockInternal.mockResolvedValue({
      type: BlockType.QuizExam,
      content: { passPercentage: 80 },
    });

    const cmd = new SubmitExamCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
      answers: [],
    });
    const result = (await handler.execute(cmd)) as any;

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(mockAttemptRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: QuizAttemptStatus.COMPLETED, score: 0 }),
    );
    expect(mockProgressRepo.findByUserAndCourse).not.toHaveBeenCalled();
  });

  it("should calculate score correctly and sync progress if passed", async () => {
    const recentDate = new Date();
    mockAttemptRepo.findOne.mockResolvedValue({
      id: "attempt-1",
      timeLimitMinutes: 10,
      startedAt: recentDate,
      questionsSnapshot: mockQuestionsSnapshot,
    });
    mockContentService.getBlockInternal.mockResolvedValue({
      type: BlockType.QuizExam,
      content: { passPercentage: 50 },
    });
    mockProgressRepo.findByUserAndCourse.mockResolvedValue(mockAggregate);
    mockContentService.getProgressStats.mockResolvedValue({ totalBlocksInLesson: 5, totalLessonsInCourse: 10 });

    const cmd = new SubmitExamCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
      answers: [
        { questionId: "q-1", selectedOptionIds: ["opt-1"] },
        { questionId: "q-2", textAnswer: "  sql " },
      ],
    });

    const result = (await handler.execute(cmd)) as any;

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.correctAnswers).toBe(2);

    expect(mockAttemptRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: QuizAttemptStatus.COMPLETED, score: 100 }),
    );

    expect(mockAggregate.completeBlockSync).toHaveBeenCalledWith(CMD_BASE.blockId, CMD_BASE.lessonId, 5, 10, 100, {
      attemptId: "attempt-1",
      score: 100,
    });
    expect(mockProgressRepo.save).toHaveBeenCalledWith(mockAggregate);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("should NOT sync progress if score is below passPercentage", async () => {
    const recentDate = new Date();
    mockAttemptRepo.findOne.mockResolvedValue({
      id: "attempt-1",
      timeLimitMinutes: 10,
      startedAt: recentDate,
      questionsSnapshot: mockQuestionsSnapshot,
    });
    mockContentService.getBlockInternal.mockResolvedValue({
      type: BlockType.QuizExam,
      content: { passPercentage: 100 },
    });

    const cmd = new SubmitExamCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
      answers: [
        { questionId: "q-1", selectedOptionIds: ["opt-1"] },
        { questionId: "q-2", textAnswer: "java" },
      ],
    });

    const result = (await handler.execute(cmd)) as any;

    expect(result.passed).toBe(false);
    expect(result.score).toBe(50);

    expect(mockAttemptRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: QuizAttemptStatus.COMPLETED, score: 50 }),
    );
    expect(mockProgressRepo.findByUserAndCourse).not.toHaveBeenCalled();
  });
});
