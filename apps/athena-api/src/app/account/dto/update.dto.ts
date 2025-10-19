import { AccountRole } from "@athena-lms/shared";
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

/**
 * DTO for updating an account. All fields optional.
 * If password is provided, it will be re-hashed.
 */
export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  login?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
