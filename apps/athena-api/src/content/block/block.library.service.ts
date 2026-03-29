import {
  BlockType,
  Pageable,
  Policy,
  QuizAttemptQuestionFullSnapshot,
  QuizExamSource,
  QuizQuestionContent,
} from "@athena/types";
import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuid } from "uuid";

import { CreateLibraryBlockDto } from "./dto/create.library.dto";
import { FilterLibraryBlockDto } from "./dto/filter.library.dto";
import { ReadLibraryBlockDto } from "./dto/read.library.dto";
import { UpdateLibraryBlockDto } from "./dto/update.library.dto";
import { LibraryBlock } from "./entities/library-block.entity";
import { validateBlockContentPayload } from "./utils/block-validator";
import { BaseService } from "../../base/base.service";
import { IdentityService } from "../../identity";

/**
 * @class BlockLibraryService
 * @description
 * Business logic for managing Library Blocks within a Lesson.
 *
 */
@Injectable()
export class BlockLibraryService extends BaseService<LibraryBlock> {
  private readonly logger = new Logger(BlockLibraryService.name);

  constructor(
    @InjectRepository(LibraryBlock)
    private readonly libraryRepo: Repository<LibraryBlock>,
    private readonly identityService: IdentityService,
  ) {
    super();
  }

  /**
   * Saves a block as a template in the library.
   */
  async createLibraryBlock(dto: CreateLibraryBlockDto, userId: string): Promise<ReadLibraryBlockDto> {
    this.logger.log(`createLibraryBlock() | type=${dto.type}, userId=${userId}`);

    await validateBlockContentPayload(dto.type, dto.content);

    const template = this.libraryRepo.create({
      ownerId: userId,
      type: dto.type,
      tags: dto.tags,
      content: dto.content,
    });

    const savedTemplate = await this.libraryRepo.save(template);
    return this.toDto(savedTemplate, ReadLibraryBlockDto);
  }

  /**
   * Retrieves templates with pagination and GIN-indexed tag filtering.
   */
  async findLibraryBlocks(dto: FilterLibraryBlockDto, userId: string): Promise<Pageable<ReadLibraryBlockDto>> {
    this.logger.log(`findLibraryBlocks() | userId=${userId}`);

    const qb = this.libraryRepo.createQueryBuilder("lib");

    qb.andWhere("lib.owner_id = :userId", { userId });

    if (dto.type) {
      qb.andWhere("lib.type = :type", { type: dto.type });
    }

    if (dto.tags && dto.tags.length > 0) {
      qb.andWhere("lib.tags @> :tags", { tags: dto.tags });
    }

    if (dto.search) {
      // TODO: improve search here
      qb.andWhere("lib.content::text ILIKE :search", { search: `%${dto.search}%` });
    }

    qb.orderBy(`lib.${dto.sortBy}`, dto.sortOrder.toUpperCase() as "ASC" | "DESC");
    qb.skip((dto.page - 1) * dto.limit).take(dto.limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: this.toDtoArray(items, ReadLibraryBlockDto),
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        pages: Math.ceil(total / dto.limit),
      },
    };
  }

  /**
   * Retrieves a single library block by ID.
   */
  async findOneLibraryBlock(id: string, userId: string, appliedPolicies: Policy[] = []): Promise<ReadLibraryBlockDto> {
    const template = await this.libraryRepo.findOne({ where: { id } });

    if (!template) throw new NotFoundException(`Library Block with ID ${id} not found`);

    for (const policy of appliedPolicies) {
      if (!this.identityService.checkAbility(policy, userId, template)) {
        throw new ForbiddenException("You are not allowed to access this template");
      }
    }

    return this.toDto(template, ReadLibraryBlockDto);
  }

  /**
   * Updates a library block template.
   */
  async updateLibraryBlock(
    id: string,
    dto: UpdateLibraryBlockDto,
    userId: string,
    appliedPolicies: Policy[] = [],
  ): Promise<ReadLibraryBlockDto> {
    const template = await this.libraryRepo.findOne({ where: { id } });

    if (!template) throw new NotFoundException(`Library Block with ID ${id} not found`);

    for (const policy of appliedPolicies) {
      if (!this.identityService.checkAbility(policy, userId, template)) {
        throw new ForbiddenException("You are not allowed to edit this template");
      }
    }

    const targetType = dto.type || template.type;
    const targetContent = dto.content || template.content;

    if (dto.content || dto.type) {
      await validateBlockContentPayload(targetType, targetContent);
    }

    Object.assign(template, dto);
    if (dto.content) template.content = dto.content;

    const updatedTemplate = await this.libraryRepo.save(template);
    return this.toDto(updatedTemplate, ReadLibraryBlockDto);
  }

  /**
   * Deletes a library block template.
   */
  async removeLibraryBlock(id: string, userId: string, appliedPolicies: Policy[] = []): Promise<void> {
    const template = await this.libraryRepo.findOne({ where: { id } });

    if (!template) throw new NotFoundException(`Library Block with ID ${id} not found`);

    for (const policy of appliedPolicies) {
      if (!this.identityService.checkAbility(policy, userId, template)) {
        throw new ForbiddenException("You are not allowed to delete this template");
      }
    }

    await this.libraryRepo.remove(template);
  }

  /**
   * Generates a snapshot of questions for a QuizExam based on tag rules.
   * Internal method used by the Progress module when starting an exam.
   */
  async generateExamQuestions(source: QuizExamSource): Promise<QuizAttemptQuestionFullSnapshot[]> {
    const { includeTags, excludeTags = [], mandatoryTags = [], count } = source;

    let mandatoryBlocks: LibraryBlock[] = [];
    if (mandatoryTags.length > 0) {
      const qb = this.libraryRepo
        .createQueryBuilder("lb")
        .where("lb.type = :type", { type: BlockType.QuizQuestion })
        .andWhere("lb.tags && :mandatoryTags", { mandatoryTags });

      if (excludeTags.length > 0) {
        qb.andWhere("NOT (lb.tags && :excludeTags)", { excludeTags });
      }

      mandatoryBlocks = await qb.limit(count).getMany();
    }

    const remainingCount = count - mandatoryBlocks.length;
    let randomBlocks: LibraryBlock[] = [];

    if (remainingCount > 0 && includeTags.length > 0) {
      const qb = this.libraryRepo
        .createQueryBuilder("lb")
        .where("lb.type = :type", { type: BlockType.QuizQuestion })
        .andWhere("lb.tags && :includeTags", { includeTags });

      if (excludeTags.length > 0) {
        qb.andWhere("NOT (lb.tags && :excludeTags)", { excludeTags });
      }

      if (mandatoryBlocks.length > 0) {
        const mandatoryIds = mandatoryBlocks.map(b => b.id);
        qb.andWhere("lb.id NOT IN (:...mandatoryIds)", { mandatoryIds });
      }

      randomBlocks = await qb.orderBy("RANDOM()").limit(remainingCount).getMany();
    }

    const allBlocks = [...mandatoryBlocks, ...randomBlocks];
    const shuffled = allBlocks.sort(() => Math.random() - 0.5);

    return shuffled.map(block => {
      const content = block.content as QuizQuestionContent;
      return {
        id: uuid(),
        originalBlockId: block.id,
        type: content.type,
        question: content.question,
        options: content.options,
        correctAnswerText: content.correctAnswerText,
        explanation: content.explanation,
      };
    });
  }
}
