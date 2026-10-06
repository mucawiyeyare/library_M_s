import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
export function Modal({ title, description, open, onOpenChange, children, className = '' }) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal-content ${className}`}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description className="muted">{description}</Dialog.Description>
          <Dialog.Close className="icon-button modal-close" aria-label={t('ui.common.closeDialog')}>
            <X size={20} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
