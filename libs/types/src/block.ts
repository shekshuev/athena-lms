import { SortOrder } from "./common";

export enum BlockType {
  Text = "text",
  Code = "code",
  QuizQuestion = "quiz_question",
  QuizExam = "quiz_exam",
}

export enum CodeExecutionMode {
  IoCheck = "io_check",
  UnitTest = "unit_test",
}

export enum ProgrammingLanguage {
  Python = "python",
  SQL = "sql",
}

export enum QuizQuestionType {
  Single = "single",
  Multiple = "multiple",
  Open = "open",
}

export interface TextBlockContent {
  json: Record<string, unknown>;
}

export interface CodeBlockContent {
  language: ProgrammingLanguage;
  taskText: TextBlockContent;
  initialCode?: string;
  executionMode: CodeExecutionMode;
  inputData?: string;
  outputData?: string;
  testCasesCode?: string;
  timeLimit?: number;
  memoryLimit?: number;
}

export enum BlockRequiredAction {
  VIEW = "view",
  INTERACT = "interact",
  SUBMIT = "submit",
  PASS = "pass",
}

export interface CreateBlockRequest {
  lessonId: string;
  type: BlockType;
  content: BlockContent;
  orderIndex?: number;
  requiredAction?: BlockRequiredAction;
}

export interface BlockDryRunRequest {
  content: CodeBlockContent;
  socketId: string;
  blockId: string;
}

export interface BlockResponse {
  id: string;
  lessonId: string;
  type: BlockType;
  requiredAction: BlockRequiredAction;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TextBlockResponse extends BlockResponse {
  content: TextBlockContent;
}

export interface CodeBlockResponse extends BlockResponse {
  content: CodeBlockContent;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionContent {
  question: TextBlockContent;
  type: QuizQuestionType;
  options?: QuizOption[];
  correctAnswerText?: string;
  explanation?: string;
}

export interface QuizExamSource {
  includeTags: string[];
  excludeTags?: string[];
  mandatoryTags?: string[];
  count: number;
}

export interface QuizExamContent {
  title: string;
  timeLimitMinutes?: number;
  passPercentage: number;
  source: QuizExamSource;
}

export interface QuizQuestionBlockResponse extends BlockResponse {
  content: QuizQuestionContent;
}

export interface QuizExamBlockResponse extends BlockResponse {
  content: QuizExamContent;
}

export interface LibraryBlockResponse {
  id: string;
  ownerId: string;
  type: BlockType;
  tags: string[];
  content: BlockContent;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLibraryBlockRequest {
  type: BlockType;
  tags: string[];
  content: BlockContent;
}

export type UpdateLibraryBlockRequest = Partial<CreateLibraryBlockRequest>;

export interface FilterLibraryBlockRequest {
  type?: BlockType;
  tags?: string[];
  search?: string;
  page: number;
  limit: number;
  sortBy: "type" | "createdAt" | "updatedAt";
  sortOrder: SortOrder;
}

export type UpdateBlockRequest = Partial<CreateBlockRequest>;

export type BlockContent = CodeBlockContent | TextBlockContent | QuizQuestionContent | QuizExamContent;

export interface CheckQuizQuestionRequest {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface CheckQuizQuestionResponse {
  isCorrect: boolean;
  explanation?: string;
}

export interface ExamQuestionAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface SubmitExamRequest {
  answers: ExamQuestionAnswer[];
}

export interface SubmitExamResponse {
  attemptId: string;
  score: number;
  passed: boolean;
  passPercentage: number;
  correctAnswers: number;
  totalQuestions: number;
}
