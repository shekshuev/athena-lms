import { MigrationInterface, QueryRunner } from "typeorm";

export class QuizAttempts1772692543916 implements MigrationInterface {
  name = "QuizAttempts1772692543916";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."quiz_attempts_status_enum" AS ENUM('IN_PROGRESS', 'COMPLETED')`);
    await queryRunner.query(
      `CREATE TABLE "quiz_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "block_id" uuid NOT NULL, "course_id" uuid NOT NULL, "lesson_id" uuid NOT NULL, "status" "public"."quiz_attempts_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "questions_snapshot" jsonb NOT NULL, "score" integer, "time_limit_minutes" integer, "started_at" TIMESTAMP NOT NULL DEFAULT now(), "finished_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a84a93fb092359516dc5b325b90" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "quiz_attempts__user_id__idx" ON "quiz_attempts" ("user_id") `);
    await queryRunner.query(`CREATE INDEX "quiz_attempts__block_id__idx" ON "quiz_attempts" ("block_id") `);
    await queryRunner.query(`CREATE INDEX "quiz_attempts__course_id__idx" ON "quiz_attempts" ("course_id") `);
    await queryRunner.query(
      `CREATE INDEX "quiz_attempts__user_block_status__idx" ON "quiz_attempts" ("user_id", "block_id", "status") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."quiz_attempts__user_block_status__idx"`);
    await queryRunner.query(`DROP INDEX "public"."quiz_attempts__course_id__idx"`);
    await queryRunner.query(`DROP INDEX "public"."quiz_attempts__block_id__idx"`);
    await queryRunner.query(`DROP INDEX "public"."quiz_attempts__user_id__idx"`);
    await queryRunner.query(`DROP TABLE "quiz_attempts"`);
    await queryRunner.query(`DROP TYPE "public"."quiz_attempts_status_enum"`);
  }
}
