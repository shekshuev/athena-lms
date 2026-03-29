import { ExamQuestionAnswer, SubmitExamRequest } from "@athena/types";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

/**
 * @class ExamQuestionAnswerDto
 * @description
 * Data Transfer Object for a single answer submitted within an exam attempt.
 */
export class ExamQuestionAnswerDto implements ExamQuestionAnswer {
  /**
   * The unique generated ID of the question from the attempt's snapshot.
   */
  @IsString()
  questionId!: string;

  /**
   * Array of selected option IDs (for Single or Multiple choice questions).
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  /**
   * Text answer provided by the student (for Open text questions).
   */
  @IsOptional()
  @IsString()
  textAnswer?: string;
}

/**
 * @class SubmitExamDto
 * @description
 * Data Transfer Object for submitting an entire exam attempt.
 * Contains a collection of answers provided by the student.
 */
export class SubmitExamDto implements SubmitExamRequest {
  /**
   * The array of answers submitted by the student.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionAnswerDto)
  answers!: ExamQuestionAnswerDto[];
}
