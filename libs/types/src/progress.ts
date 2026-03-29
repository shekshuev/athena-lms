import {
  ProgrammingLanguage,
  BlockType,
  BlockRequiredAction,
  QuizQuestionType,
  TextBlockContent,
  QuizOption,
} from "./block";

export enum ProgressStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  LOCKED = "LOCKED",
}

export enum GradingStatus {
  PENDING = "PENDING",
  GRADED = "GRADED",
  FAILED = "FAILED",
}

export interface StudentSubmissionRequest {
  code: string;
  language: ProgrammingLanguage;
  socketId: string;
}

export interface BaseBlockResult {
  score: number;
  completedAt: Date;
  status: GradingStatus;
  submissionData?: unknown;
  feedback?: string;
}

export interface StudentLessonProgress {
  status: ProgressStatus;
  completedBlocks: Record<string, BaseBlockResult>;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentCourseProgress {
  id: string;
  enrollmentId: string;
  courseId: string;
  studentId: string;
  status: ProgressStatus;
  lessons: Record<string, StudentLessonProgress>;
  currentScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockProgressState {
  status: GradingStatus;
  score: number;
  feedback?: string;
  submittedAt?: Date;
}

export interface SanitizedBlockView {
  blockId: string;
  type: BlockType;
  orderIndex: number;
  requiredAction: BlockRequiredAction;
  content: Record<string, unknown>;
  progress: BlockProgressState | null;
}

export interface StudentLessonView {
  lessonId: string;
  courseId: string;
  title: string;
  goals?: string | null;
  totalBlocks: number;
  visibleBlocksCount: number;
  blocks: SanitizedBlockView[];
}

export interface StudentDashboardLessonView {
  status: string;
  title: string;
  completedBlocks: Record<string, number>;
}

export interface StudentDashboardView {
  studentId: string;
  courseId: string;
  courseTitle: string;
  courseCoverUrl?: string;
  cohortName: string;
  instructorName: string;
  progressPercentage: number;
  totalScore: number;
  status: ProgressStatus;
  lessons: Record<string, StudentDashboardLessonView>;
  recentBadges: string[];
}

export enum QuizAttemptStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export interface QuizAttemptQuestionSnapshot {
  id: string;
  originalBlockId: string;
  type: QuizQuestionType;
  question: TextBlockContent;
  options?: Omit<QuizOption, "isCorrect">[];
}

export interface QuizAttemptQuestionFullSnapshot extends QuizAttemptQuestionSnapshot {
  options?: QuizOption[];
  correctAnswerText?: string;
  explanation?: string;
}

export interface QuizAttemptResponse {
  id: string;
  blockId: string;
  status: QuizAttemptStatus;
  questions: QuizAttemptQuestionSnapshot[];
  score?: number;
  timeLimitMinutes?: number;
  startedAt: Date;
  finishedAt?: Date;
}

export interface ExamForceClosedResult {
  userId: string;
  blockId: string;
  score: number;
  passed: boolean;
}
