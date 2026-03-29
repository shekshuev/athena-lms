import { BlockRequiredAction, Policy } from "@athena/types";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { v4 as uuid } from "uuid";

import { OutboxService } from "../../outbox";
import { SubmissionQueueService } from "../../submission-queue";
import { CreateBlockDto } from "./dto/create.dto";
import { BlockDryRunDto } from "./dto/dry-run.dto";
import { ReadBlockDto } from "./dto/read.dto";
import { ReorderBlockDto, UpdateBlockDto } from "./dto/update.dto";
import { Block } from "./entities/block.entity";
import { BaseService } from "../../base/base.service";
import { IdentityService } from "../../identity";
import { validateBlockContentPayload } from "./utils/block-validator";
import {
  AthenaEvent,
  BlockCreatedEvent,
  BlockDeletedEvent,
  BlockReorderedEvent,
  BlockUpdatedEvent,
} from "../../shared/events/types";
import { Lesson } from "../lesson/entities/lesson.entity";

/**
 * @class BlockService
 * @description
 * Business logic for managing Content Blocks within a Lesson.
 *
 * Responsibilities:
 * - CRUD for blocks
 * - Polymorphic content validation based on BlockType
 * - Managing order via double precision indexing
 * - ACL enforcement via IdentityService (cascading from Course)
 * - DTO transformation via BaseService
 */
@Injectable()
export class BlockService extends BaseService<Block> {
  private readonly logger = new Logger(BlockService.name);

  constructor(
    @InjectRepository(Block)
    private readonly blockRepo: Repository<Block>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    private readonly identityService: IdentityService,
    private readonly submissionQueue: SubmissionQueueService,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {
    super();
  }

  /**
   * Creates a new content block with Outbox Event.
   */
  async create(dto: CreateBlockDto, userId: string): Promise<ReadBlockDto> {
    this.logger.log(`create() | lessonId=${dto.lessonId}, type=${dto.type}, userId=${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const lesson = await manager.findOne(Lesson, {
        where: { id: dto.lessonId },
        relations: ["course"],
      });

      if (!lesson) throw new NotFoundException(`Lesson with ID ${dto.lessonId} not found`);
      if (lesson.course.ownerId !== userId) throw new ForbiddenException("You can only add blocks to your own courses");

      await validateBlockContentPayload(dto.type, dto.content);

      let orderIndex = dto.orderIndex;
      if (orderIndex === undefined) {
        const maxOrderBlock = await manager.findOne(Block, {
          where: { lessonId: dto.lessonId },
          order: { orderIndex: "DESC" },
        });
        orderIndex = maxOrderBlock ? maxOrderBlock.orderIndex + 1024 : 1024;
      }

      const block = manager.create(Block, {
        lessonId: lesson.id,
        type: dto.type,
        content: dto.content,
        orderIndex,
        requiredAction: dto.requiredAction ?? BlockRequiredAction.VIEW,
      });

      const savedBlock = await manager.save(Block, block);

      const event = new BlockCreatedEvent(
        savedBlock.id,
        savedBlock.lessonId,
        savedBlock.type,
        savedBlock.content,
        savedBlock.orderIndex,
        savedBlock.requiredAction,
      );
      await this.outboxService.save(manager, AthenaEvent.BLOCK_CREATED, event);

      await queryRunner.commitTransaction();
      return this.toDto(savedBlock, ReadBlockDto);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`create() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to create block");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Retrieves all blocks for a given lesson.
   * Verifies read access to the lesson/course.
   */
  async findAllByLesson(lessonId: string, userId: string, appliedPolicies: Policy[] = []): Promise<ReadBlockDto[]> {
    this.logger.log(`findAllByLesson() | lessonId=${lessonId}, userId=${userId}`);

    try {
      const lesson = await this.lessonRepo.findOne({
        where: { id: lessonId },
        relations: ["course"],
      });

      if (!lesson) {
        throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
      }

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, lesson.course)) {
          throw new ForbiddenException("You are not allowed to view blocks in this lesson");
        }
      }

      const blocks = await this.blockRepo.find({
        where: { lessonId },
        order: { orderIndex: "ASC" },
      });

      return this.toDtoArray(blocks, ReadBlockDto);
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`findAllByLesson() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to fetch blocks");
    }
  }

  /**
   * Retrieves a single block by UUID.
   * Verifies read access.
   */
  async findOne(id: string, userId: string, appliedPolicies: Policy[] = []): Promise<ReadBlockDto> {
    this.logger.log(`findOne() | id=${id}, userId=${userId}`);

    try {
      const block = await this.blockRepo.findOne({
        where: { id },
        relations: ["lesson", "lesson.course"],
      });

      if (!block) {
        throw new NotFoundException(`Block with ID ${id} not found`);
      }

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, block.lesson.course)) {
          throw new ForbiddenException("You are not allowed to view this block");
        }
      }

      return this.toDto(block, ReadBlockDto);
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`findOne() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to fetch block");
    }
  }

  /**
   * Updates an existing block with Outbox Event.
   */
  async update(id: string, dto: UpdateBlockDto, userId: string, appliedPolicies: Policy[] = []): Promise<ReadBlockDto> {
    this.logger.log(`update() | id=${id}, userId=${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const block = await manager.findOne(Block, {
        where: { id },
        relations: ["lesson", "lesson.course"],
      });

      if (!block) throw new NotFoundException(`Block with ID ${id} not found`);

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, block.lesson.course)) {
          throw new ForbiddenException("You are not allowed to update this block");
        }
      }

      const targetType = dto.type || block.type;
      const targetContent = dto.content || block.content;

      if (dto.content || dto.type) {
        await validateBlockContentPayload(targetType, targetContent);
      }

      Object.assign(block, dto);
      if (dto.content) block.content = dto.content;
      if (dto.requiredAction) block.requiredAction = dto.requiredAction;

      const savedBlock = await manager.save(Block, block);

      const event = new BlockUpdatedEvent(
        savedBlock.id,
        savedBlock.lessonId,
        savedBlock.type,
        savedBlock.content,
        savedBlock.requiredAction,
      );
      await this.outboxService.save(manager, AthenaEvent.BLOCK_UPDATED, event);

      await queryRunner.commitTransaction();
      return this.toDto(savedBlock, ReadBlockDto);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      )
        throw error;
      this.logger.error(`update() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to update block");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates the order index with Outbox Event.
   */
  async reorder(
    id: string,
    dto: ReorderBlockDto,
    userId: string,
    appliedPolicies: Policy[] = [],
  ): Promise<ReadBlockDto> {
    this.logger.log(`reorder() | id=${id}, userId=${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const block = await manager.findOne(Block, {
        where: { id },
        relations: ["lesson", "lesson.course"],
      });

      if (!block) throw new NotFoundException(`Block with ID ${id} not found`);

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, block.lesson.course)) {
          throw new ForbiddenException("You are not allowed to reorder this block");
        }
      }

      block.orderIndex = dto.newOrderIndex;

      const savedBlock = await manager.save(Block, block);

      const event = new BlockReorderedEvent(savedBlock.id, savedBlock.lessonId, savedBlock.orderIndex);
      await this.outboxService.save(manager, AthenaEvent.BLOCK_REORDERED, event);

      await queryRunner.commitTransaction();
      return this.toDto(savedBlock, ReadBlockDto);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`reorder() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to reorder block");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Removes a block permanently with Outbox Event.
   */
  async remove(id: string, userId: string, appliedPolicies: Policy[] = []): Promise<void> {
    this.logger.log(`remove() | id=${id}, userId=${userId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const block = await manager.findOne(Block, {
        where: { id },
        relations: ["lesson", "lesson.course"],
      });

      if (!block) throw new NotFoundException(`Block with ID ${id} not found`);

      for (const policy of appliedPolicies) {
        if (!this.identityService.checkAbility(policy, userId, block.lesson.course)) {
          throw new ForbiddenException("You are not allowed to delete this block");
        }
      }

      await manager.remove(Block, block);

      const event = new BlockDeletedEvent(id, block.lessonId);
      await this.outboxService.save(manager, AthenaEvent.BLOCK_DELETED, event);

      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`remove() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to delete block");
    } finally {
      await queryRunner.release();
    }
  }

  async dryRun(dto: BlockDryRunDto, userId: string): Promise<void> {
    this.logger.log(`dryRun() | userId=${userId}`);
    try {
      await this.submissionQueue.sendForExecution({
        submissionId: uuid(),
        content: dto.content,
        metadata: {
          socketId: dto.socketId,
          blockId: dto.blockId,
        },
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) throw error;
      this.logger.error(`dryRun() | ${(error as Error).message}`, (error as Error).stack);
      throw new BadRequestException("Failed to initiate dry run");
    }
  }

  /**
   * Retrieves a single block by UUID for internal module use (bypasses ACL).
   */
  async findOneInternal(id: string): Promise<Block> {
    const block = await this.blockRepo.findOne({ where: { id } });
    if (!block) {
      throw new NotFoundException(`Block with ID ${id} not found`);
    }
    return block;
  }
}
