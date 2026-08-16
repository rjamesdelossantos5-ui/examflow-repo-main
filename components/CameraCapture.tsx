'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Live camera capture for the parent ID (front) and the parent selfie.
 *
 * Integration note: the captured photo is written into a hidden
 * <input type="file"> via DataTransfer, so the existing server action keeps
 * receiving a plain File in FormData — submitRequest() needs no changes at all,
 * and the 5 MB / MIME validation it already does still applies.
 *
 * There is ALWAYS an upload fallback. A school PC may have no webcam, a user may
 * refuse the permission, and iOS blocks getUserMedia inside some in-app browsers
 * (Messenger, Instagram) — a camera-only flow would dead-end all three.
 *
 * Requires `Permissions-Policy: camera=(self)` in next.config.ts. The default
 * `camera=()` is an EMPTY allowlist and blocks the camera on your own origin.
 */

const MAX_EDGE = 1280 // downscale before upload — a raw phone frame is 3–8 MB
const JPEG_QUALITY = 0.85

type Facing = 'user' | 'environment'

export default function CameraCapture({
  name,
  label,
  facing,
  hint,
  required = false,
  onCaptured,
}: {
  /** Form field name — must match what the server action reads from FormData. */
  name: string
  label: string
  /** 'user' = front camera (selfie), 'environment' = rear camera (ID card). */
  facing: Facing
  hint?: string
  required?: boolean
  onCaptured?: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Releasing the tracks is not optional: without it the camera indicator light
  // stays on after the user navigates away, which reads as spyware.
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsOpen(false)
  }, [])

  useEffect(() => stopStream, [stopStream])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  async function openCamera() {
    setError(null)

    // getUserMedia is undefined (not just failing) on http:// origins other than
    // localhost, so this check gives a real explanation instead of a TypeError.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser can only use the camera over a secure (https) connection. Use “Upload a photo instead” below.')
      return
    }

    setIsStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setIsOpen(true)
      // The <video> only exists after isOpen renders it, so attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
    } catch (err) {
      // Name the actual failure and the actual fix — a generic message here
      // leaves the user with no idea whether to change a setting or give up.
      const n = (err as DOMException)?.name
      if (n === 'NotAllowedError' || n === 'SecurityError') {
        setError('Camera access was blocked. Allow camera permission for this site in your browser settings, then try again — or use “Upload a photo instead”.')
      } else if (n === 'NotFoundError' || n === 'OverconstrainedError') {
        setError('No camera was found on this device. Use “Upload a photo instead” below.')
      } else if (n === 'NotReadableError') {
        setError('Another app is already using the camera. Close it (for example Zoom or Messenger), then try again.')
      } else {
        setError('The camera could not be started on this device. Use “Upload a photo instead” below.')
      }
    } finally {
      setIsStarting(false)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('The camera is still warming up — wait a moment and tap Capture again.')
      return
    }

    // Downscale on the way out. A full-resolution phone frame is several MB,
    // which would trip the 5 MB server limit and make the upload crawl on
    // mobile data; 1280px is far more than a face match needs.
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.round(video.videoWidth * scale)
    const h = Math.round(video.videoHeight * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('This browser could not process the photo. Use “Upload a photo instead” below.')
      return
    }
    ctx.drawImage(video, 0, 0, w, h)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('The photo could not be saved. Try again, or use “Upload a photo instead”.')
          return
        }
        const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' })

        // Hand the File to the real <input type="file"> so the form submits it
        // exactly like a picked file — no server-side change needed.
        const dt = new DataTransfer()
        dt.items.add(file)
        if (fileInputRef.current) fileInputRef.current.files = dt.files

        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(file)
        })
        onCaptured?.(file)
        stopStream()
      },
      'image/jpeg',
      JPEG_QUALITY,
    )
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    onCaptured?.(file)
  }

  const isSelfie = facing === 'user'

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1.5">
        <span className="block text-sm font-medium" style={{ color: 'var(--card-foreground)' }}>
          {label}
        </span>
        {/* Asterisk AND the word "required" — an asterisk alone is a color/symbol
            cue that screen readers and colour-blind users can miss. */}
        {required && (
          <span className="text-2xs ef-muted">
            <span aria-hidden="true" style={{ color: 'var(--status-danger)' }}>*</span> required
          </span>
        )}
      </div>
      {hint && <p className="text-2xs ef-muted mt-0.5">{hint}</p>}

      {/* The real form field. Kept in the DOM at all times so both the camera
          path and the manual-upload path write to the same input. */}
      <input
        ref={fileInputRef}
        type="file"
        name={name}
        accept="image/jpeg,image/png"
        capture={isSelfie ? 'user' : 'environment'}
        onChange={onFilePicked}
        className="sr-only"
        aria-label={`${label} — choose a photo`}
      />

      <div className="mt-2 rounded-xl border ef-border overflow-hidden">
        {isOpen ? (
          <div className="relative bg-black">
            <video
              ref={videoRef}
              playsInline   /* required — iOS Safari otherwise forces fullscreen */
              muted
              autoPlay
              className="w-full aspect-[4/3] object-cover"
              // Mirror the selfie preview only: an unmirrored front camera feels
              // backwards to line your face up with. The saved file is NOT
              // mirrored, since a flipped face harms the comparison.
              style={isSelfie ? { transform: 'scaleX(-1)' } : undefined}
            />

            {/* Framing guide — a plain outline, no motion, so it costs nothing
                on a low-end phone and needs no reduced-motion handling. */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 m-auto border-2 border-dashed ${
                isSelfie ? 'w-[55%] h-[70%] rounded-full' : 'w-[86%] h-[62%] rounded-xl'
              }`}
              style={{ borderColor: 'rgba(255,255,255,0.75)' }}
            />

            <div className="absolute inset-x-0 bottom-0 p-3 flex gap-2 bg-gradient-to-t from-black/70 to-transparent">
              <button
                type="button"
                onClick={stopStream}
                className="ef-press flex-1 py-2.5 rounded-lg text-sm font-semibold bg-white/15 text-white hover:bg-white/25 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="ef-press flex-1 py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
              >
                Capture photo
              </button>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, nothing for the image optimizer to do */}
            <img
              src={previewUrl}
              alt={`Captured photo for ${label}`}
              className="w-full aspect-[4/3] object-cover bg-black"
            />
            <div className="p-2.5 flex items-center gap-2">
              <span className="text-2xs font-medium flex items-center gap-1" style={{ color: 'var(--status-success)' }}>
                {/* Icon + word, never colour alone. */}
                <span aria-hidden="true">✓</span> Photo ready
              </span>
              <button
                type="button"
                onClick={() => { setPreviewUrl(null); openCamera() }}
                className="ef-press ml-auto px-3 py-1.5 rounded-lg text-2xs font-semibold border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
                style={{ color: 'var(--card-foreground)' }}
              >
                Retake
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 text-center">
            <p className="text-2xs ef-muted mb-3">
              {isSelfie
                ? 'Face the camera in good lighting. Remove hats, masks, and sunglasses.'
                : 'Lay the ID flat and fill the frame. Avoid glare from direct light.'}
            </p>
            <button
              type="button"
              onClick={openCamera}
              disabled={isStarting}
              className="ef-press w-full py-2.5 rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: 'var(--sti-gold)', color: 'var(--sti-navy)' }}
            >
              {isStarting ? 'Starting camera…' : isSelfie ? 'Open camera for selfie' : 'Open camera for ID'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ef-press mt-2 w-full py-2.5 rounded-lg text-sm font-semibold border ef-border hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors"
              style={{ color: 'var(--card-foreground)' }}
            >
              Upload a photo instead
            </button>
          </div>
        )}
      </div>

      {/* Inline, next to the field that failed — never a page-level banner. */}
      {error && (
        <p role="alert" className="mt-2 text-2xs flex items-start gap-1.5" style={{ color: 'var(--status-danger)' }}>
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
