import { AccountRole } from "@athena-lms/shared";
import { Logger } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";

import { AccountService } from "./account.service";
import { FilterAccountDto } from "./dto/filter.dto";
import { Account } from "./entities/account.entity";

describe("AccountService.findAll", () => {
  let service: AccountService;

  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            createQueryBuilder: jest.fn(() => qb),
          },
        },
        { provide: Logger, useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get(AccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper for generating normal baseline filters.
   */
  const baseFilters = (): FilterAccountDto => ({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "ASC",
    search: undefined,
    role: undefined,
    isActive: undefined,
  });

  it("should return paginated accounts without filters", async () => {
    const entities = [
      Object.assign(new Account(), { id: "1", login: "john", role: AccountRole.Student }),
      Object.assign(new Account(), { id: "2", login: "anna", role: AccountRole.Teacher }),
    ];
    qb.getManyAndCount.mockResolvedValueOnce([entities, 2]);

    const result = await service.findAll(baseFilters());

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith("a.profileRecords", "r");
    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });

  it("should filter by search (ILIKE)", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    const filters = { ...baseFilters(), search: "john" };

    await service.findAll(filters);

    expect(qb.andWhere).toHaveBeenCalledWith("a.login ILIKE :search", { search: "%john%" });
  });

  it("should filter by role", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    const filters = { ...baseFilters(), role: AccountRole.Admin };

    await service.findAll(filters);

    expect(qb.andWhere).toHaveBeenCalledWith("a.role = :role", { role: AccountRole.Admin });
  });

  it("should filter by isActive", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    const filters = { ...baseFilters(), isActive: true };

    await service.findAll(filters);

    expect(qb.andWhere).toHaveBeenCalledWith("a.isActive = :isActive", { isActive: true });
  });

  it("should apply pagination and sorting", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    const filters = { ...baseFilters(), page: 2, limit: 5, sortBy: "login", sortOrder: "DESC" } as FilterAccountDto;

    await service.findAll(filters);

    expect(qb.orderBy).toHaveBeenCalledWith("a.login", "DESC");
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it("should handle database error gracefully", async () => {
    qb.getManyAndCount.mockRejectedValueOnce(new Error("db failure"));
    const filters = baseFilters();

    await expect(service.findAll(filters)).rejects.toThrow("Failed to fetch accounts");
  });

  it("should calculate total pages correctly", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 22]);
    const filters = { ...baseFilters(), limit: 10 };

    const result = await service.findAll(filters);

    expect(result.meta.pages).toBe(3);
  });

  it("should not modify valid filters when testing others", async () => {
    qb.getManyAndCount.mockResolvedValueOnce([[], 0]);
    const filters = { ...baseFilters(), search: "a" };

    await service.findAll(filters);

    expect(filters.limit).toBe(10);
    expect(filters.page).toBe(1);
    expect(filters.sortOrder).toBe("ASC");
  });
});
