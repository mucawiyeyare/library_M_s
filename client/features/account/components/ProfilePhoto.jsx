import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../../shared/lib/api'
import UserAvatar from '../../../shared/components/UserAvatar'
import { useAuth } from '../../auth/providers/AuthProvider'
import PhotoCropDialog from './PhotoCropDialog'
export default function ProfilePhoto({ editing, onUploading }) {
  const { t } = useTranslation()
  const { user, updateUser } = useAuth()
  const input = useRef(null)
  const [selected, setSelected] = useState(null)
  const queries = useQueryClient()
  const upload = useMutation({
    mutationFn: (file) =>
      api('/me/avatar', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      }),
    onSuccess: (updated) => {
      updateUser(updated)
      void queries.invalidateQueries()
      toast.success(t('profile.photoUpdated'))
    },
    onError: (error) => toast.error(error.message),
  })
  useEffect(() => {
    onUploading(upload.isPending)
  }, [upload.isPending, onUploading])
  return (
    <div className="profile-photo-section">
      <div className="profile-photo">
        <UserAvatar user={user} large />
        {editing && (
          <button
            type="button"
            className="profile-camera"
            aria-label={t('profile.changePhoto')}
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            <Camera size={19} aria-hidden="true" />
          </button>
        )}
      </div>
      {editing && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            className="sr-only"
            tabIndex={-1}
            aria-label={t('profile.photoFile')}
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                if (
                  !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                  file.size > 5 * 1024 * 1024
                )
                  toast.error(t('ui.settings.logoInvalid'))
                else setSelected(file)
              }
              event.target.value = ''
            }}
          />
        </>
      )}
      {selected && (
        <PhotoCropDialog
          file={selected}
          onClose={() => setSelected(null)}
          onSave={(file) => {
            setSelected(null)
            upload.mutate(file)
          }}
        />
      )}
    </div>
  )
}
