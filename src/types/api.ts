/** 云函数统一响应 */
export interface CloudResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** 带分页的列表响应 */
export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}
