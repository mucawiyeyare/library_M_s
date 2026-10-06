import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
export const defaultLibrary = {
  name: 'Garbaharey Public Library',
  email: '',
  phone: '',
  address: '',
  hours: '',
  timezone: 'Africa/Mogadishu',
}
export function useLibrarySettings() {
  return useQuery({
    queryKey: ['library-settings'],
    queryFn: () => api('/library/settings'),
  })
}
