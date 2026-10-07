import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet, apiList } from '@/lib/api';
import { cleanParams } from '@/lib/utils';
import type { Paginated } from '@/types/api';

/**
 * List-screen plumbing: filters live in the URL so a filtered view can be
 * shared or bookmarked, search is debounced, and changing a filter resets to
 * page one (otherwise you land on an empty page 4).
 */
export function useListState<F extends Record<string, string | undefined>>(
  filterDefaults: F,
  pageSize = 25,
) {
  const [params, setParams] = useSearchParams();

  const page = Number(params.get('page') ?? 1);
  const search = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(search);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Push the debounced term into the URL once it settles.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (current === debouncedSearch) return;
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('q', debouncedSearch);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true });
  }, [debouncedSearch, params, setParams]);

  const filters = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const key of Object.keys(filterDefaults)) {
      result[key] = params.get(key) ?? (filterDefaults as Record<string, string | undefined>)[key];
    }
    return result as F;
  }, [params, filterDefaults]);

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const setPage = useCallback(
    (value: number) => {
      const next = new URLSearchParams(params);
      if (value > 1) next.set('page', String(value));
      else next.delete('page');
      setParams(next);
    },
    [params, setParams],
  );

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== (filterDefaults as Record<string, unknown>)[key],
  ).length;

  const queryParams = cleanParams({
    ...filters,
    q: debouncedSearch || undefined,
    page,
    pageSize,
  });

  return {
    page,
    setPage,
    pageSize,
    search: searchInput,
    setSearch: setSearchInput,
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    queryParams,
  };
}

/** Paginated fetch that keeps the previous page visible while the next loads. */
export function usePaginatedQuery<T>(
  key: unknown[],
  url: string,
  params: Record<string, unknown>,
  options: { enabled?: boolean } = {},
) {
  return useQuery<Paginated<T>>({
    queryKey: [...key, params],
    queryFn: () => apiList<T>(url, params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Option lists for pickers, cached hard because they rarely change. */
export function useOptions<T>(key: string, url: string, enabled = true) {
  return useQuery<T>({
    queryKey: ['options', key],
    queryFn: () => apiGet<T>(url),
    staleTime: 5 * 60_000,
    enabled,
  });
}
