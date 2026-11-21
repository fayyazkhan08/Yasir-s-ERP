import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  keyField?: keyof T;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
  onPageChange?: (page: number) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  keyField = 'id' as keyof T,
  sortBy,
  sortDir,
  onSort,
  emptyIcon = '📄',
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search or filters.',
  pagination,
  onPageChange,
}: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.sortable ? 'sortable' : ''}
                style={{ width: col.width, textAlign: col.align || 'left' }}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                {col.header} {col.sortable && sortBy === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key}><div className="skeleton" style={{ height: 14, width: '70%' }} /></td>
                ))}
              </tr>
            ))}

          {!loading &&
            rows.map((row) => (
              <tr key={String(row[keyField])}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>

      {!loading && rows.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>{emptyIcon}</div>
          <h3>{emptyTitle}</h3>
          <p className="text-muted">{emptyMessage}</p>
        </div>
      )}

      {pagination && pagination.total > 0 && (
        <div className="pagination">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
