import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1760819621141 implements MigrationInterface {
  name = "Init1760819621141";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TYPE "public"."accounts_role_enum" AS ENUM('student', 'teacher', 'admin', 'superadmin')
        `);
    await queryRunner.query(`
            CREATE TABLE "accounts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "login" character varying NOT NULL,
                "password_hash" character varying NOT NULL,
                "role" "public"."accounts_role_enum" NOT NULL DEFAULT 'student',
                "isActive" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                CONSTRAINT "UQ_2b995c673f59534efe164ced42d" UNIQUE ("login"),
                CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."profile_records_data_type_enum" AS ENUM('string', 'number', 'boolean', 'date', 'json')
        `);
    await queryRunner.query(`
            CREATE TABLE "profile_records" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying NOT NULL,
                "value" text NOT NULL,
                "data_type" "public"."profile_records_data_type_enum" NOT NULL DEFAULT 'string',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "account_id" uuid,
                CONSTRAINT "PK_ec37342324b40a8f0f1c6e8a890" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_a67e900bd25b5b67b712cd70f2" ON "profile_records" ("account_id", "name")
        `);
    await queryRunner.query(`
            ALTER TABLE "profile_records"
            ADD CONSTRAINT "FK_aa06d6dcfe70f8edfaa3d02a10d" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "profile_records" DROP CONSTRAINT "FK_aa06d6dcfe70f8edfaa3d02a10d"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."IDX_a67e900bd25b5b67b712cd70f2"
        `);
    await queryRunner.query(`
            DROP TABLE "profile_records"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."profile_records_data_type_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "accounts"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."accounts_role_enum"
        `);
  }
}
