import { AccountRole } from "@athena-lms/shared";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/**
 * DTO for filtering/pagination of accounts list.
 * Supports: search (by login ILIKE), role, isActive, page/limit, sorting.
 */
export class FilterAccountDto {
  /** Full-text search by login (ILIKE %search%). */
  @IsOptional()
  @IsString()
  search?: string;

  /** Filter by role. */
  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

  /** Filter by active flag. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const v = String(value).toLowerCase();
    if (["true", "1", "yes"].includes(v)) return true;
    if (["false", "0", "no"].includes(v)) return false;
    return value; // даст валидации упасть, если мусор
  })
  @IsBoolean()
  isActive?: boolean;

  /** Page number (1-based). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** Page size. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Sort field. */
  @IsOptional()
  @IsIn(["login", "role", "isActive", "createdAt", "updatedAt"])
  sortBy: "login" | "role" | "isActive" | "createdAt" | "updatedAt" = "createdAt";

  /** Sort order. */
  @IsOptional()
  @IsIn(["ASC", "DESC", "asc", "desc"])
  sortOrder: "ASC" | "DESC" | "asc" | "desc" = "DESC";
}
