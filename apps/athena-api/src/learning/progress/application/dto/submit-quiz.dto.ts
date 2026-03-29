import { CheckQuizQuestionRequest } from "@athena/types";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

/**
 * @class SubmitQuizDto
 * @description
 * Data Transfer Object for submitting an answer to a standalone QuizQuestion block.
 */
export class SubmitQuizDto implements CheckQuizQuestionRequest {
  /**
   * Array of selected option IDs (for Single or Multiple choice questions).
   */
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  selectedOptionIds?: string[];

  /**
   * Text answer provided by the student (for Open text questions).
   */
  @IsOptional()
  @IsString()
  textAnswer?: string;
}
