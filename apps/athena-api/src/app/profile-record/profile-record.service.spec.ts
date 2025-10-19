import { Test, TestingModule } from "@nestjs/testing";

import { ProfileRecordService } from "./profile-record.service";

describe("ProfileRecordService", () => {
  let service: ProfileRecordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfileRecordService],
    }).compile();

    service = module.get<ProfileRecordService>(ProfileRecordService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
