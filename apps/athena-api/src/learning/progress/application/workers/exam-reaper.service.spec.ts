import { getQueueToken } from "@nestjs/bullmq";
import { Test, TestingModule } from "@nestjs/testing";
import { Queue } from "bullmq";

import { ExamReaperService } from "./exam-reaper.service";

describe("ExamReaperService", () => {
  let service: ExamReaperService;
  let queue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamReaperService,
        {
          provide: getQueueToken("exam-reaper"),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ExamReaperService>(ExamReaperService);
    queue = module.get(getQueueToken("exam-reaper"));

    jest.clearAllMocks();
  });

  it("should add repeating job to the queue on module init", async () => {
    await service.onModuleInit();

    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith(
      "reap",
      {},
      {
        repeat: { pattern: "* * * * *" },
        jobId: "exam-reaper-cron",
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  });
});
