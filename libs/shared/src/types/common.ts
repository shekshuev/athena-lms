/**
 * Generic pagination response wrapper.
 */
export interface Pageable<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
