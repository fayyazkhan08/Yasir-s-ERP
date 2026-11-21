import { useCallback, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../api/client';

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

interface UsePaginatedListOptions {
  endpoint: string;
  filters?: Record<string, any>;
  defaultSortBy?: string;
  defaultSortDir?: 'asc' | 'desc';
  limit?: number;
}

export function usePaginatedList<T>({
  endpoint,
  filters = {},
  defaultSortBy = 'id',
  defaultSortDir = 'desc',
  limit = 10,
}: UsePaginatedListOptions) {
  const [rows, setRows] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(endpoint, { params: { page, limit, sortBy, sortDir, ...filters } });
      setRows(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, sortBy, sortDir, filterKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  return { rows, pagination, page, setPage, sortBy, sortDir, handleSort, loading, error, refresh: fetchData };
}
