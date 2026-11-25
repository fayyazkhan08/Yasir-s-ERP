import { useCallback, useEffect, useState } from 'react';
import { portalApi } from '../api/portalClient';
import { apiErrorMessage } from '../api/client';

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

interface Options {
  endpoint: string;
  filters?: Record<string, any>;
  limit?: number;
}

/** Paginated list for portal endpoints. Also returns the optional `summary` block some endpoints send. */
export function usePortalList<T, S = any>({ endpoint, filters = {}, limit = 10 }: Options) {
  const [rows, setRows] = useState<T[]>([]);
  const [summary, setSummary] = useState<S | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = JSON.stringify(filters);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await portalApi.get(endpoint, { params: { page, limit, ...filters } });
      setRows(res.data.data);
      setPagination(res.data.pagination);
      setSummary(res.data.summary ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, limit, filterKey]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [filterKey]);

  return { rows, summary, pagination, page, setPage, loading, error, refresh: fetchData };
}