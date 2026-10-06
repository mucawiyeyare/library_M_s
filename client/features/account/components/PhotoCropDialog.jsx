import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../../../shared/components/Modal'
import { Button } from '../../../shared/components/primitives/button'
export default function PhotoCropDialog({ file, onClose, onSave }) {
  const { t } = useTranslation()
  const [source, setSource] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [frame, setFrame] = useState(280)
  const [saving, setSaving] = useState(false)
  const stage = useRef(null)
  const photo = useRef(null)
  const drag = useRef(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      setFrame(element.clientWidth)
      setOffset({ x: 0, y: 0 })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const scale = dimensions.width
    ? Math.max(frame / dimensions.width, frame / dimensions.height) * zoom
    : 1
  const bound = (next, factor = scale) => ({
    x: Math.max(
      -(dimensions.width * factor - frame) / 2,
      Math.min((dimensions.width * factor - frame) / 2, next.x),
    ),
    y: Math.max(
      -(dimensions.height * factor - frame) / 2,
      Math.min((dimensions.height * factor - frame) / 2, next.y),
    ),
  })
  const crop = async () => {
    if (!photo.current || !dimensions.width) return
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 640
      const context = canvas.getContext('2d')
      if (!context) throw new Error(t('profile.cropUnavailable'))
      context.drawImage(
        photo.current,
        (dimensions.width - frame / scale) / 2 - offset.x / scale,
        (dimensions.height - frame / scale) / 2 - offset.y / scale,
        frame / scale,
        frame / scale,
        0,
        0,
        640,
        640,
      )
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error(t('profile.cropFailed')))),
          'image/webp',
          0.9,
        ),
      )
      onSave(new File([blob], 'profile.webp', { type: 'image/webp' }))
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      className="photo-crop-dialog"
      title={t('profile.adjust')}
      description={t('profile.adjustIntro')}
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
    >
      <div className="photo-crop-layout">
        <div
          ref={stage}
          className="photo-crop-stage"
          role="group"
          aria-label={t('profile.cropPreview')}
          tabIndex={0}
          onKeyDown={(event) => {
            const move = {
              ArrowLeft: [-10, 0],
              ArrowRight: [10, 0],
              ArrowUp: [0, -10],
              ArrowDown: [0, 10],
            }[event.key]
            if (move && dimensions.width) {
              event.preventDefault()
              setOffset((old) => bound({ x: old.x + move[0], y: old.y + move[1] }))
            }
          }}
          onPointerDown={(event) => {
            if (!dimensions.width) return
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY }
          }}
          onPointerMove={(event) => {
            if (!drag.current) return
            const dx = event.clientX - drag.current.x
            const dy = event.clientY - drag.current.y
            drag.current = { x: event.clientX, y: event.clientY }
            setOffset((old) => bound({ x: old.x + dx, y: old.y + dy }))
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
        >
          {source && (
            <img
              ref={photo}
              src={source}
              alt={t('profile.selectedPhoto')}
              draggable={false}
              onError={() => {
                toast.error(t('profile.unreadable'))
                onClose()
              }}
              onLoad={(event) => {
                const image = event.currentTarget
                if (image.naturalWidth * image.naturalHeight > 25000000) {
                  toast.error(t('profile.tooLarge'))
                  onClose()
                  return
                }
                setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
              }}
              style={{
                width: dimensions.width * scale,
                height: dimensions.height * scale,
                left: (frame - dimensions.width * scale) / 2 + offset.x,
                top: (frame - dimensions.height * scale) / 2 + offset.y,
              }}
            />
          )}
          <div className="photo-crop-mask" aria-hidden="true" />
        </div>
        <label className="photo-zoom">
          <ZoomOut size={18} aria-hidden="true" />
          <span className="sr-only">{t('profile.zoom')}</span>
          <input
            aria-label={t('profile.zoom')}
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            disabled={!dimensions.width || saving}
            onChange={(event) => {
              const next = Number(event.target.value)
              setOffset(bound(offset, (scale / zoom) * next))
              setZoom(next)
            }}
          />
          <ZoomIn size={18} aria-hidden="true" />
        </label>
        <div className="photo-crop-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setZoom(1)
              setOffset({ x: 0, y: 0 })
            }}
          >
            <RotateCcw size={16} />
            {t('profile.reset')}
          </Button>
          <div className="button-row">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              {t('staffContent.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!dimensions.width || saving}
              onClick={() => void crop()}
            >
              {saving ? t('profile.preparing') : t('profile.savePhoto')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
