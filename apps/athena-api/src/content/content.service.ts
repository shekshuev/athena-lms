import { BlockType, QuizAttemptQuestionFullSnapshot, QuizExamSource } from "@athena/types";
import { BadRequestException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

import { BlockLibraryService } from "./block/block.library.service";
import { BlockService } from "./block/block.service";
import { CodeBlockContentDto } from "./block/dto/content-payload.dto";
import { Block } from "./block/entities/block.entity";
import { CourseService } from "./course/course.service";
import { CreateCourseDto } from "./course/dto/create.dto";
import { ReadCourseDto } from "./course/dto/read.dto";
import { Lesson } from "./lesson/entities/lesson.entity";
import { LessonService } from "./lesson/lesson.service";
import { LessonView } from "./lesson/schemas/lesson-view.schema";

@Injectable()
export class ContentService {
  constructor(
    private readonly courseService: CourseService,
    private readonly blockService: BlockService,
    private readonly blockLibraryService: BlockLibraryService,
    private readonly lessonService: LessonService,
    private readonly dataSource: DataSource,
  ) {}

  async createCourse(dto: CreateCourseDto, ownerId: string): Promise<ReadCourseDto> {
    return this.courseService.create(dto, ownerId);
  }

  async getCourseById(id: string, userId: string): Promise<ReadCourseDto> {
    return this.courseService.findOne(id, userId);
  }

  async getCodeBlockContext(blockId: string, userId: string): Promise<CodeBlockContentDto> {
    const block = await this.blockService.findOne(blockId, userId);

    if (block.type !== BlockType.Code) {
      throw new BadRequestException(`Block ${blockId} is not a CODE block`);
    }

    return block.content as CodeBlockContentDto;
  }

  async getProgressStats(
    courseId: string,
    lessonId: string,
  ): Promise<{ totalBlocksInLesson: number; totalLessonsInCourse: number }> {
    const result = await this.dataSource.query(
      `
      SELECT
        (
          SELECT COUNT(*)::int 
          FROM blocks 
          WHERE lesson_id = $1
        ) as "blocksCount",
        (
          SELECT COUNT(*)::int 
          FROM lessons 
          WHERE course_id = $2 
          AND deleted_at IS NULL 
          AND is_draft = false
        ) as "lessonsCount"
      `,
      [lessonId, courseId],
    );

    const row = result[0];

    return {
      totalBlocksInLesson: +row.blocksCount || 0,
      totalLessonsInCourse: +row.lessonsCount || 0,
    };
  }

  getLessonViewInternal(lessonId: string): Promise<LessonView> {
    return this.lessonService.findOneInternal(lessonId);
  }

  getLessonsByCourseId(courseId: string): Promise<Lesson[]> {
    return this.lessonService.findAllInternal(courseId);
  }

  getBlockInternal(blockId: string): Promise<Block> {
    return this.blockService.findOneInternal(blockId);
  }

  generateExamQuestions(source: QuizExamSource): Promise<QuizAttemptQuestionFullSnapshot[]> {
    return this.blockLibraryService.generateExamQuestions(source);
  }
}
