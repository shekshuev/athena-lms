import { BlockType, QuizAttemptStatus, QuizQuestionType } from "@athena/types";
import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { StartExamHandler } from "./start-exam.handler";
import { ContentService } from "../../../../../content/content.service";
import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { StartExamCommand } from "../start-exam.command";

const mockAttemptRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockContentService = {
  getBlockInternal: jest.fn(),
  generateExamQuestions: jest.fn(),
};

describe("StartExamHandler", () => {
  let handler: StartExamHandler;

  const CMD = new StartExamCommand("user-1", "course-1", "lesson-1", "block-1");

  const mockGeneratedQuestions = [
    {
      id: "q-1",
      originalBlockId: "lib-1",
      type: QuizQuestionType.Single,
      question: { json: { text: "Q1" } },
      options: [
        { id: "opt-1", text: "A", isCorrect: true },
        { id: "opt-2", text: "B", isCorrect: false },
      ],
      explanation: "Exp",
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartExamHandler,
        { provide: getRepositoryToken(QuizAttemptOrmEntity), useValue: mockAttemptRepo },
        { provide: ContentService, useValue: mockContentService },
      ],
    }).compile();

    handler = module.get<StartExamHandler>(StartExamHandler);
    jest.clearAllMocks();
  });

  it("should return existing active attempt WITHOUT secrets", async () => {
    mockAttemptRepo.findOne.mockResolvedValue({
      id: "attempt-1",
      blockId: CMD.blockId,
      status: QuizAttemptStatus.IN_PROGRESS,
      timeLimitMinutes: 15,
      startedAt: new Date(),
      questionsSnapshot: mockGeneratedQuestions,
    });

    const result = await handler.execute(CMD);

    expect(mockContentService.getBlockInternal).not.toHaveBeenCalled();
    expect(result.id).toBe("attempt-1");

    expect(result.questions[0].options?.[0]).not.toHaveProperty("isCorrect");
    expect(result.questions[0]).not.toHaveProperty("explanation");
  });

  it("should generate a new attempt if none exists, stripping secrets", async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);
    mockContentService.getBlockInternal.mockResolvedValue({
      type: BlockType.QuizExam,
      content: { timeLimitMinutes: 20, source: {} },
    });
    mockContentService.generateExamQuestions.mockResolvedValue(mockGeneratedQuestions);

    mockAttemptRepo.create.mockImplementation(ent => ({ ...ent, id: "new-attempt", startedAt: new Date() }));
    mockAttemptRepo.save.mockImplementation(ent => ent);

    const result = await handler.execute(CMD);

    expect(mockAttemptRepo.create).toHaveBeenCalled();
    expect(mockAttemptRepo.save).toHaveBeenCalled();
    expect(result.id).toBe("new-attempt");

    expect(result.questions[0].options?.[0]).not.toHaveProperty("isCorrect");
  });

  it("should throw BadRequestException if block is not an exam", async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);
    mockContentService.getBlockInternal.mockResolvedValue({ type: BlockType.Text });

    await expect(handler.execute(CMD)).rejects.toThrow(BadRequestException);
  });
});
