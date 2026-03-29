import { PostgresErrorCode } from "@athena/common";
import { Pageable, Permission, Policy } from "@athena/types";
import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository, DataSource } from "typeorm";

import { CreateRoleDto } from "./dto/create.dto";
import { FilterRoleDto } from "./dto/filter.dto";
import { ReadRoleDto } from "./dto/read.dto";
import { Role } from "./entities/role.entity";
import { BaseService } from "../../base/base.service";
import { OutboxService } from "../../outbox";
import { AthenaEvent, RoleDeletedEvent } from "../../shared/events/types";
import { isPostgresQueryError } from "../../shared/helpers/errors";

/**
 * @class RoleService
 * @description
 * Handles all operations related to system roles:
 * - creation,
 * - listing,
 * - updating permissions & policies,
 * - safe deletion with FK constraint handling.
 *
 * Extends `BaseService` to provide DTO serialization.
 *
 * ## Responsibilities
 * - CRUD for roles
 * - Protect against deleting roles referenced by accounts
 * - Enforce consistent DTO mapping
 */
@Injectable()
export class RoleService extends BaseService<Role> {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(Role)
    private readonly repo: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {
    super();
  }

  /**
   * Finds a role by its name.
   * Returns null if not found.
   */
  async findByName(name: string): Promise<ReadRoleDto | null> {
    this.logger.log(`findByName() | name=${name}`);

    const role = await this.repo.findOne({ where: { name } });
    if (!role) return null;

    return this.toDto(role, ReadRoleDto);
  }

  /**
   * Creates a new role.
   *
   * @throws ConflictException if name already exists
   */
  async create(dto: CreateRoleDto): Promise<ReadRoleDto> {
    this.logger.log(`create() | name=${dto.name}`);

    try {
      const role = this.repo.create({
        name: dto.name,
        permissions: dto.permissions ?? [],
        policies: dto.policies ?? {},
      });

      const saved = await this.repo.save(role);

      this.logger.log(`create() | Role created | id=${saved.id}`);
      return this.toDto(saved, ReadRoleDto);
    } catch (error: unknown) {
      this.logger.error(`create() | ${(error as Error).message}`, (error as Error).stack);
      if (error instanceof QueryFailedError) {
        this.handleRoleConstraintError(error);
      }
      throw new BadRequestException("Failed to create role");
    }
  }

  /**
   * Returns paginated list of roles with search & sorting.
   *
   * Supports:
   * - search by role name (ILIKE)
   * - pagination
   * - sorting
   *
   * @param filters - DTO with pagination/filter options
   */
  async findAll(filters: FilterRoleDto): Promise<Pageable<ReadRoleDto>> {
    const { page, limit, sortBy, sortOrder, search } = filters;

    this.logger.log(
      `findAll() | page=${page}, limit=${limit}, search="${search}", sortBy=${sortBy}, sortOrder=${sortOrder}`,
    );

    try {
      const qb = this.repo.createQueryBuilder("r");

      if (search?.trim()) {
        qb.where("r.name ILIKE :search", { search: `%${search.trim()}%` });
      }

      qb.orderBy(`r.${sortBy}`, sortOrder.toUpperCase() as "ASC" | "DESC");
      qb.skip((page - 1) * limit).take(limit);

      const [entities, total] = await qb.getManyAndCount();
      const data = this.toDtoArray(entities, ReadRoleDto);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error: unknown) {
      this.logger.error(`findAll() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to fetch roles");
    }
  }

  /**
   * Gets role by ID.
   *
   * @throws NotFoundException if not exists
   */
  async findById(id: string): Promise<ReadRoleDto> {
    this.logger.log(`findById() | id=${id}`);

    const role = await this.repo.findOne({ where: { id } });

    if (!role) {
      this.logger.warn(`findById() | Role not found | id=${id}`);
      throw new NotFoundException("Role not found");
    }

    return this.toDto(role, ReadRoleDto);
  }

  /**
   * Updates a role's name, permissions or policies.
   *
   * @throws ConflictException if name already exists
   */
  async update(id: string, data: Partial<CreateRoleDto>): Promise<ReadRoleDto> {
    this.logger.log(`update() | id=${id}`);

    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException("Role not found");

    if (data.name !== undefined) existing.name = data.name;
    if (data.permissions !== undefined) existing.permissions = data.permissions;
    if (data.policies !== undefined) existing.policies = data.policies;

    try {
      const saved = await this.repo.save(existing);
      this.logger.log(`update() | Role updated | id=${saved.id}`);
      return this.toDto(saved, ReadRoleDto);
    } catch (error: unknown) {
      this.logger.error(`update() | ${(error as Error).message}`, (error as Error).stack);
      if (error instanceof QueryFailedError) {
        this.handleRoleConstraintError(error);
      }
      throw new BadRequestException("Failed to update role");
    }
  }

  /**
   * Deletes a role by ID.
   * Handles foreign-key constraints (accounts referencing a role).
   *
   * @throws ConflictException if role is used by accounts
   */
  async delete(id: string): Promise<void> {
    this.logger.log(`delete() | id=${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const role = await manager.findOne(Role, { where: { id } });

      if (!role) {
        this.logger.warn(`delete() | Role not found | id=${id}`);
        throw new NotFoundException("Role not found");
      }

      await manager.remove(Role, role);

      const event = new RoleDeletedEvent(role.name);
      await this.outboxService.save(manager, AthenaEvent.ROLE_DELETED, event);
      await queryRunner.commitTransaction();

      this.logger.log(`delete() | Role deleted | id=${id}`);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`delete() | ${(error as Error).message}`, (error as Error).stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        this.handleRoleConstraintError(error);
      }
      throw new BadRequestException("Failed to delete role");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Maps low-level PostgreSQL database constraint violations
   * to domain-specific HTTP exceptions.
   *
   * Handles:
   * - unique constraint on role name
   * - FK constraint from accounts.role_id
   */
  private handleRoleConstraintError(error: QueryFailedError): never {
    if (isPostgresQueryError(error)) {
      const { code, constraint } = error;

      if (code === PostgresErrorCode.UNIQUE_VIOLATION && constraint === "roles__name__uk") {
        throw new ConflictException("Role name already in use");
      }

      if (code === PostgresErrorCode.FOREIGN_KEY_VIOLATION && constraint === "accounts__role_id__fk") {
        throw new ConflictException("Cannot delete role: it is used by existing accounts");
      }
    }

    throw new BadRequestException("Failed to persist role");
  }

  /**
   * Updates the permission list of a specific role.
   *
   * This method fully replaces the existing permission set with the
   * provided array. It does not validate whether the permissions belong
   * to a known enum — this responsibility lies in DTO validation.
   *
   * @param id - Role ID
   * @param permissions - New permission list
   *
   * @throws NotFoundException if the role does not exist
   */
  async updatePermissions(id: string, permissions: Permission[]): Promise<ReadRoleDto> {
    this.logger.log(`updatePermissions() | id=${id}`);
    const role = await this.repo.findOne({ where: { id } });
    if (!role) {
      this.logger.warn(`updatePermissions() | Role not found | id=${id}`);
      throw new NotFoundException("Role not found");
    }

    role.permissions = permissions;
    try {
      const saved = await this.repo.save(role);
      return this.toDto(saved, ReadRoleDto);
    } catch (error: unknown) {
      this.logger.error(`updatePermissions() | ${(error as Error).message}`, (error as Error).stack);

      throw new BadRequestException("Failed to update policy");
    }
  }

  /**
   * Updates object-level policies for a role.
   *
   * @param id - Role ID
   * @param policies - Map of permission → list of policies
   *
   * @throws NotFoundException if the role does not exist
   */
  async updatePolicies(id: string, policies: Partial<Record<Permission, Policy[]>>): Promise<ReadRoleDto> {
    this.logger.log(`updatePolicies() | id=${id}`);

    const role = await this.repo.findOne({ where: { id } });
    if (!role) {
      this.logger.warn(`updatePolicies() | Role not found | id=${id}`);
      throw new NotFoundException("Role not found");
    }

    role.policies = policies;
    try {
      const saved = await this.repo.save(role);
      return this.toDto(saved, ReadRoleDto);
    } catch (error: unknown) {
      this.logger.error(`updatePolicies() | ${(error as Error).message}`, (error as Error).stack);

      throw new BadRequestException("Failed to update policy");
    }
  }
}
