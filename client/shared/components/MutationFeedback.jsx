import { useEffect } from 'react'
import { toast } from 'sonner'
// Action results are announced by useAction, including after dialogs close.
// This also handles local validation/upload errors outside an API mutation.
export function MutationFeedback({ error }) {
  useEffect(() => {
    if (error) toast.error(error.message, { id: error.message, duration: 7000 })
  }, [error])
  return null
}
