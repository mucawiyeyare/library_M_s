import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
export function usePagedList(key, path, filters = '') {
  const [cursor, setCursor] = useState({ filters, page: 1 })
  const page = cursor.filters === filters ? cursor.page : 1
  const result = useQuery({
    queryKey: [key, 'paged', page, filters],
    queryFn: () => api(`${path}?page=${page}&limit=25${filters ? `&${filters}` : ''}`),
  })
  return {
    ...result,
    data: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    pages: result.data?.pages ?? 1,
    page,
    setPage: (next) => setCursor({ filters, page: next }),
  }
}
