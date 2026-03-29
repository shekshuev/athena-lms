import { Pageable, Policy } from "@athena/types";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { OutboxService } from "../../outbox";
import { CreateEnrollmentDto } from "./dto/create.dto";
import { FilterEnrollmentDto } from "./dto/filter.dto";
import { ReadEnrollmentDto } from "./dto/read.dto";
import { UpdateEnrollmentDto } from "./dto/update.dto";
import { Enrollment } from "./entities/enrollment.entity";
import { BaseService } from "../../base/base.service";
import { IdentityService } from "../../identity";
import { AthenaEvent, EnrollmentCreatedEvent, EnrollmentDeletedEvent } from "../../shared/events/types";
import { Cohort } from "../cohort/entities/cohort.entity";

/**
 * @class EnrollmentService
 * @description
 * Business logic for managing Student Enrollments.
 *
 * Responsibilities:
 * - Enrolling students into cohorts
 * - Managing enrollment status (active, expelled, completed)
 * - Policy-based access control (Student sees own, Admin sees all)
 * - Safe serialization using BaseService
 */
@Injectable()
export class EnrollmentService extends BaseService<Enrollment> {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    @InjectRepository(Enrollment)
    private readonly repo: Repository<Enrollment>,
    private readonly identityService: IdentityService,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {
    super();
  }

  /**
   * Returns paginated list of enrollments.
   * Supports filtering by cohort, student owner, or status.
   */
  async findAll(
    filters: FilterEnrollmentDto,
    userId: string,
    appliedPolicies: Policy[] = [],
  ): Promise<Pageable<ReadEnrollmentDto>> {
    const { page, limit, cohortId, ownerId, status, sortBy, sortOrder } = filters;
    this.logger.log(`findAll() | user=${userId}, cohort=${cohortId}`);

    try {
      const qb = this.repo.createQueryBuilder("e");

      this.identityService.applyPoliciesToQuery(qb, userId, appliedPolicies, "e");

      if (cohortId) {
        qb.andWhere("e.cohortId = :cId", { cId: cohortId });
      }
      if (ownerId) {
        qb.andWhere("e.ownerId = :oId", { oId: ownerId });
      }
      if (status) {
        qb.andWhere("e.status = :status", { status });
      }

      qb.orderBy(`e.${sortBy}`, sortOrder.toUpperCase() as "ASC" | "DESC");
      qb.skip((page - 1) * limit).take(limit);

      const [entities, total] = await qb.getManyAndCount();

      return {
        data: this.toDtoArray(entities, ReadEnrollmentDto),
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.logger.error(`findAll error: ${(error as Error).message}`);
      throw new BadRequestException("Failed to fetch enrollments");
    }
  }

  /**
   * Returns a single enrollment by UUID.
   */
  async findOne(id: string, userId: string, appliedPolicies: Policy[] = []): Promise<ReadEnrollmentDto> {
    try {
      const enrollment = await this.repo.findOne({ where: { id } });

      if (!enrollment) {
        throw new NotFoundException("Enrollment not found");
      }

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, enrollment)) {
          throw new ForbiddenException("Access denied");
        }
      }

      return this.toDto(enrollment, ReadEnrollmentDto);
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) throw err;
      throw new BadRequestException("Failed to fetch enrollment");
    }
  }

  /**
   * Creates a new enrollment transactionally and emits an event via Outbox.
   *
   * Flow:
   * 1. Start Transaction.
   * 2. Find Cohort to retrieve Course ID (needed for Progress).
   * 3. Create Enrollment record.
   * 4. Write ENROLLMENT_CREATED event to Outbox.
   * 5. Commit.
   */
  async create(dto: CreateEnrollmentDto): Promise<ReadEnrollmentDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const cohort = await manager.findOne(Cohort, { where: { id: dto.cohortId } });

      if (!cohort) {
        throw new NotFoundException(`Cohort with id ${dto.cohortId} not found`);
      }

      const entity = manager.create(Enrollment, {
        cohortId: dto.cohortId,
        ownerId: dto.ownerId,
        status: dto.status,
      });

      const saved = await manager.save(Enrollment, entity);

      const event = new EnrollmentCreatedEvent(saved.id, saved.ownerId, saved.cohortId, cohort.courseId);

      await this.outboxService.save(manager, AthenaEvent.ENROLLMENT_CREATED, event);

      await queryRunner.commitTransaction();
      this.logger.log(`Enrollment created and event staged | id=${saved.id}`);
      return this.toDto(saved, ReadEnrollmentDto);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`create error: ${(error as Error).message}`, (error as Error).stack);

      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException("Failed to enroll student");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates an enrollment (e.g., changing status).
   */
  async update(
    id: string,
    dto: UpdateEnrollmentDto,
    ownerId: string,
    appliedPolicies: Policy[] = [],
  ): Promise<ReadEnrollmentDto> {
    try {
      const enrollment = await this.repo.findOne({ where: { id } });
      if (!enrollment) throw new NotFoundException("Enrollment not found");

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, ownerId, enrollment)) {
          throw new ForbiddenException("You are not allowed to update this enrollment");
        }
      }

      if (dto.status) enrollment.status = dto.status;

      const updated = await this.repo.save(enrollment);
      return this.toDto(updated, ReadEnrollmentDto);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      throw new BadRequestException("Failed to update enrollment");
    }
  }

  /**
   * Deletes an enrollment.
   */
  async delete(id: string, ownerId: string, appliedPolicies: Policy[] = []): Promise<void> {
    const enrollment = await this.repo.findOne({ where: { id }, relations: ["cohort"] });
    if (!enrollment) throw new NotFoundException("Enrollment not found");

    for (const policy of appliedPolicies) {
      if (!this.identityService.checkAbility(policy, ownerId, enrollment)) {
        throw new ForbiddenException("You are not allowed to delete this enrollment");
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const event = new EnrollmentDeletedEvent(
        enrollment.id,
        enrollment.ownerId,
        enrollment.cohortId,
        enrollment.cohort.courseId,
      );

      await manager.remove(Enrollment, enrollment);

      await this.outboxService.save(manager, AthenaEvent.ENROLLMENT_DELETED, event);

      await queryRunner.commitTransaction();
      this.logger.log(`Enrollment deleted and event staged | id=${id}`);
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`delete() | ${(err as Error).message}`, (err as Error).stack);
      throw new BadRequestException("Failed to delete enrollment");
    } finally {
      await queryRunner.release();
    }
  }
}
