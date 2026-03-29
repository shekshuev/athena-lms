import { QuizAttemptStatus } from "@athena/types";
import { CommandBus } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Job } from "bullmq";

import { ExamReaperProcessor } from "./exam-reaper.processor";
import { QuizAttemptOrmEntity } from "../../infrastructure/persistence/entities/quiz-attempt.orm.entity";
import { SubmitExamCommand } from "../commands/submit-exam.command";

describe("ExamReaperProcessor", () => {
  let processor: ExamReaperProcessor;
  let commandBus: jest.Mocked<CommandBus>;

  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamReaperProcessor,
        {
          provide: getRepositoryToken(QuizAttemptOrmEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: CommandBus,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<ExamReaperProcessor>(ExamReaperProcessor);
    commandBus = module.get(CommandBus);

    jest.clearAllMocks();
  });

  it("should do nothing if no expired attempts found", async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await processor.process({} as Job);

    expect(mockQueryBuilder.where).toHaveBeenCalledWith("attempt.status = :status", {
      status: QuizAttemptStatus.IN_PROGRESS,
    });
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it("should dispatch SubmitExamCommand with isAutoSubmit=true for expired attempts", async () => {
    const mockAttempts = [
      { id: "attempt-1", userId: "u1", courseId: "c1", lessonId: "l1", blockId: "b1" },
      { id: "attempt-2", userId: "u2", courseId: "c2", lessonId: "l2", blockId: "b2" },
    ];
    mockQueryBuilder.getMany.mockResolvedValue(mockAttempts);

    await processor.process({} as Job);

    expect(commandBus.execute).toHaveBeenCalledTimes(2);

    expect(commandBus.execute).toHaveBeenNthCalledWith(
      1,
      new SubmitExamCommand("u1", "c1", "l1", "b1", { answers: [] }, true),
    );

    expect(commandBus.execute).toHaveBeenNthCalledWith(
      2,
      new SubmitExamCommand("u2", "c2", "l2", "b2", { answers: [] }, true),
    );
  });

  it("should continue processing if one attempt fails", async () => {
    const mockAttempts = [
      { id: "attempt-1", userId: "u1", courseId: "c1", lessonId: "l1", blockId: "b1" },
      { id: "attempt-2", userId: "u2", courseId: "c2", lessonId: "l2", blockId: "b2" },
    ];
    mockQueryBuilder.getMany.mockResolvedValue(mockAttempts);

    commandBus.execute.mockRejectedValueOnce(new Error("Database connection lost"));
    commandBus.execute.mockResolvedValueOnce({});

    await processor.process({} as Job);

    expect(commandBus.execute).toHaveBeenCalledTimes(2);
  });
});
