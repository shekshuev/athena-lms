import { QuizAttemptStatus, QuizQuestionType } from "@athena/types";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { GetActiveExamHandler } from "./get-active-exam.handler";
import { QuizAttemptOrmEntity } from "../../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { GetActiveExamQuery } from "../get-active-exam.query";

const mockAttemptRepo = {
  findOne: jest.fn(),
};

describe("GetActiveExamHandler", () => {
  let handler: GetActiveExamHandler;

  const QUERY = new GetActiveExamQuery("user-1", "course-1", "lesson-1", "block-1");

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetActiveExamHandler,
        { provide: getRepositoryToken(QuizAttemptOrmEntity), useValue: mockAttemptRepo },
      ],
    }).compile();

    handler = module.get<GetActiveExamHandler>(GetActiveExamHandler);
    jest.clearAllMocks();
  });

  it("should return null if no active attempt exists", async () => {
    mockAttemptRepo.findOne.mockResolvedValue(null);

    const result = await handler.execute(QUERY);

    expect(result).toBeNull();
    expect(mockAttemptRepo.findOne).toHaveBeenCalledWith({
      where: { userId: QUERY.userId, blockId: QUERY.blockId, status: QuizAttemptStatus.IN_PROGRESS },
    });
  });

  it("should return active attempt WITHOUT secrets", async () => {
    mockAttemptRepo.findOne.mockResolvedValue({
      id: "attempt-1",
      blockId: QUERY.blockId,
      status: QuizAttemptStatus.IN_PROGRESS,
      timeLimitMinutes: 15,
      startedAt: new Date(),
      questionsSnapshot: [
        {
          id: "q-1",
          originalBlockId: "lib-1",
          type: QuizQuestionType.Single,
          question: { json: { text: "Q1" } },
          options: [
            { id: "opt-1", text: "A", isCorrect: true },
            { id: "opt-2", text: "B", isCorrect: false },
          ],
          explanation: "Because A",
          correctAnswerText: "A",
        },
      ],
    });

    const result = await handler.execute(QUERY);

    expect(result).not.toBeNull();
    expect(result!.id).toBe("attempt-1");

    const firstQuestion = result!.questions[0];
    expect(firstQuestion).not.toHaveProperty("explanation");
    expect(firstQuestion).not.toHaveProperty("correctAnswerText");
    expect(firstQuestion.options![0]).not.toHaveProperty("isCorrect");
    expect(firstQuestion.options![1]).not.toHaveProperty("isCorrect");
  });
});
