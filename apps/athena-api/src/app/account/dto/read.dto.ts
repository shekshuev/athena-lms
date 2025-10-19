import { AccountRole } from "@athena-lms/shared";
import { Expose } from "class-transformer";

/**
 * ReadAccountDto
 * Used for safely returning account data without exposing sensitive fields.
 */
export class ReadAccountDto {
  @Expose()
  id!: string;

  @Expose()
  login!: string;

  @Expose()
  role!: AccountRole;

  @Expose()
  isActive!: boolean;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
