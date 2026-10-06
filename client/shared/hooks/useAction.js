import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, body } from '../lib/api'
import i18n from '../../i18n'
export function useAction(path, method = 'POST', onSuccess) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input) =>
      api(path, { method, ...(input === undefined ? {} : { body: body(input) }) }),
    onError: (error) => toast.error(error.message, { id: error.message, duration: 7000 }),
    onSuccess: (data) => {
      const message =
        path === '/contact'
          ? i18n.t('toast.sent')
          : path.endsWith('/renew')
            ? i18n.t('toast.renewed')
            : path.endsWith('/return')
              ? i18n.t('toast.returned')
              : method === 'POST' && /\/books\/[^/]+\/copies$/.test(path)
                ? i18n.t('toast.copyAdded')
                : path === '/reservations' && method === 'POST'
                  ? i18n.t('toast.reserved')
                  : i18n.t('toast.saved')
      // Server confirmations are in English; use the translated text unless the language is English.
      const responseMessage =
        i18n.language === 'en' &&
        data &&
        typeof data === 'object' &&
        'message' in data &&
        typeof data.message === 'string'
          ? data.message
          : message
      toast.success(responseMessage)
      void client.invalidateQueries()
      onSuccess?.(data)
    },
  })
}
