import { BlockRequiredAction, BlockType, QuizQuestionType } from "@athena/types";
import { BadRequestException } from "@nestjs/common";
import { EventPublisher } from "@nestjs/cqrs";
import { Test, TestingModule } from "@nestjs/testing";

import { SubmitQuizHandler } from "./submit-quiz.handler";
import { ContentService } from "../../../../../content/content.service";
import { PROGRESS_REPOSITORY } from "../../../domain/repository/progress.repository";
import { SubmitQuizCommand } from "../submit-quiz.command";

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

describe("SubmitQuizHandler", () => {
  let handler: SubmitQuizHandler;

  const CMD_BASE = {
    userId: "user-1",
    courseId: "course-1",
    lessonId: "lesson-1",
    blockId: "block-1",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitQuizHandler,
        { provide: PROGRESS_REPOSITORY, useValue: mockProgressRepo },
        { provide: ContentService, useValue: mockContentService },
        { provide: EventPublisher, useValue: mockPublisher },
      ],
    }).compile();

    handler = module.get<SubmitQuizHandler>(SubmitQuizHandler);

    jest.clearAllMocks();
  });

  it("should throw BadRequestException if block is not a quiz question", async () => {
    mockContentService.getBlockInternal.mockResolvedValue({ type: BlockType.Text });

    const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {});

    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  describe("Single/Multiple Choice evaluation", () => {
    const quizBlock = {
      type: BlockType.QuizQuestion,
      requiredAction: BlockRequiredAction.VIEW,
      content: {
        type: QuizQuestionType.Multiple,
        options: [
          { id: "opt-1", text: "A", isCorrect: true },
          { id: "opt-2", text: "B", isCorrect: false },
          { id: "opt-3", text: "C", isCorrect: true },
        ],
        explanation: "Because A and C.",
      },
    };

    beforeEach(() => {
      mockContentService.getBlockInternal.mockResolvedValue(quizBlock);
    });

    it("should return isCorrect: true for exact match", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        selectedOptionIds: ["opt-1", "opt-3"],
      });

      const result = await handler.execute(cmd);
      expect(result).toEqual({ isCorrect: true, explanation: "Because A and C." });
    });

    it("should return isCorrect: false if missing a correct option", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        selectedOptionIds: ["opt-1"],
      });

      const result = await handler.execute(cmd);
      expect(result.isCorrect).toBe(false);
    });

    it("should return isCorrect: false if including an incorrect option", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        selectedOptionIds: ["opt-1", "opt-2", "opt-3"],
      });

      const result = await handler.execute(cmd);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("Open Question evaluation", () => {
    const quizBlock = {
      type: BlockType.QuizQuestion,
      requiredAction: BlockRequiredAction.VIEW,
      content: {
        type: QuizQuestionType.Open,
        correctAnswerText: "  Hello World  ",
        explanation: "Basic greeting",
      },
    };

    beforeEach(() => {
      mockContentService.getBlockInternal.mockResolvedValue(quizBlock);
    });

    it("should return isCorrect: true and ignore case/spaces", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        textAnswer: "hello world",
      });

      const result = await handler.execute(cmd);
      expect(result.isCorrect).toBe(true);
    });

    it("should return isCorrect: false for wrong answer", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        textAnswer: "goodbye world",
      });

      const result = await handler.execute(cmd);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe("Progress Update Logic", () => {
    const quizBlock = {
      id: CMD_BASE.blockId,
      type: BlockType.QuizQuestion,
      requiredAction: BlockRequiredAction.SUBMIT,
      content: {
        type: QuizQuestionType.Single,
        options: [{ id: "opt-1", text: "A", isCorrect: true }],
      },
    };

    beforeEach(() => {
      mockContentService.getBlockInternal.mockResolvedValue(quizBlock);
      mockContentService.getProgressStats.mockResolvedValue({
        totalBlocksInLesson: 5,
        totalLessonsInCourse: 10,
      });
      mockProgressRepo.findByUserAndCourse.mockResolvedValue(mockAggregate);
    });

    it("should update progress and commit events if answer is correct", async () => {
      const payload = { selectedOptionIds: ["opt-1"] };
      const cmd = new SubmitQuizCommand(
        CMD_BASE.userId,
        CMD_BASE.courseId,
        CMD_BASE.lessonId,
        CMD_BASE.blockId,
        payload,
      );

      const result = await handler.execute(cmd);

      expect(result.isCorrect).toBe(true);
      expect(mockProgressRepo.findByUserAndCourse).toHaveBeenCalledWith(CMD_BASE.userId, CMD_BASE.courseId);
      expect(mockContentService.getProgressStats).toHaveBeenCalledWith(CMD_BASE.courseId, CMD_BASE.lessonId);

      expect(mockAggregate.completeBlockSync).toHaveBeenCalledWith(
        CMD_BASE.blockId,
        CMD_BASE.lessonId,
        5,
        10,
        100,
        payload,
      );

      expect(mockProgressRepo.save).toHaveBeenCalledWith(mockAggregate);
      expect(mockAggregate.commit).toHaveBeenCalled();
    });

    it("should NOT update progress if answer is incorrect", async () => {
      const cmd = new SubmitQuizCommand(CMD_BASE.userId, CMD_BASE.courseId, CMD_BASE.lessonId, CMD_BASE.blockId, {
        selectedOptionIds: ["wrong-id"],
      });

      const result = await handler.execute(cmd);

      expect(result.isCorrect).toBe(false);
      expect(mockProgressRepo.findByUserAndCourse).not.toHaveBeenCalled();
      expect(mockAggregate.completeBlockSync).not.toHaveBeenCalled();
    });
  });
});
