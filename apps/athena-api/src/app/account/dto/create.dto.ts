import { AccountRole } from "@athena-lms/shared";
import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

/**
 * DTO used from the admin panel to create a new account.
 * Password is provided in plain text and gets hashed in the service.
 */
export class CreateAccountDto {
  @IsString()
  @MinLength(3)
  login!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
