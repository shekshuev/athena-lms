import { QuizAttemptStatus, type QuizAttemptQuestionFullSnapshot } from "@athena/types";
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * @class QuizAttemptOrmEntity
 * @description
 * Represents a single attempt by a student to pass a QuizExam.
 * Stored in PostgreSQL (Write Model) to guarantee consistency during the exam
 * and prevent document bloat in MongoDB.
 */
@Entity("quiz_attempts")
@Index("quiz_attempts__user_block_status__idx", ["userId", "blockId", "status"])
export class QuizAttemptOrmEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("quiz_attempts__user_id__idx")
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Index("quiz_attempts__block_id__idx")
  @Column({ type: "uuid", name: "block_id" })
  blockId!: string;

  @Index("quiz_attempts__course_id__idx")
  @Column({ type: "uuid", name: "course_id" })
  courseId!: string;

  @Column({ type: "uuid", name: "lesson_id" })
  lessonId!: string;

  @Column({
    type: "enum",
    enum: QuizAttemptStatus,
    default: QuizAttemptStatus.IN_PROGRESS,
  })
  status!: QuizAttemptStatus;

  /**
   * The snapshot of questions generated for this specific attempt.
   * Includes the full structure (with correct answers) for validation upon submission.
   * Note: The correct answers MUST be stripped before sending to the client.
   */
  @Column({ type: "jsonb", name: "questions_snapshot" })
  questionsSnapshot!: QuizAttemptQuestionFullSnapshot[];

  @Column({ type: "int", nullable: true })
  score?: number;

  @Column({ type: "int", name: "time_limit_minutes", nullable: true })
  timeLimitMinutes?: number;

  @Column({ type: "timestamp", name: "started_at", default: () => "CURRENT_TIMESTAMP" })
  startedAt!: Date;

  @Column({ type: "timestamp", name: "finished_at", nullable: true })
  finishedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
