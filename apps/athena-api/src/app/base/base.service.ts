import { plainToInstance } from "class-transformer";

/**
 * BaseService
 *
 * Generic base class providing helper methods for mapping entities to DTOs
 * using `class-transformer`. Ensures only `@Expose()` fields are included
 * and supports nested DTO transformation.
 */
export abstract class BaseService<TEntity, TDto> {
  /**
   * Maps a single entity to the given DTO class.
   *
   * @param entity - The source entity (TypeORM or plain object)
   * @param dtoClass - The DTO class constructor (with @Expose decorators)
   */
  protected toDto(entity: TEntity, dtoClass: new () => TDto): TDto {
    return plainToInstance(dtoClass, entity, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Maps an array of entities to DTOs.
   *
   * @param entities - Array of entities
   * @param dtoClass - The DTO class constructor
   */
  protected toDtoArray(entities: TEntity[], dtoClass: new () => TDto): TDto[] {
    return entities.map(e => this.toDto(e, dtoClass));
  }
}
