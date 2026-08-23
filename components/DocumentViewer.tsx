'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { useEscapeKey } from '@/lib/useEscapeKey'

export interface ViewerMedia {
  id: string
  media_type: string
  file_name: string
  mime_type: string
  signed_url?: string
}

const isPdf = (m: ViewerMedia) =>
  m.mime_type === 'application/pdf' || /\.pdf(\?|$)/i.test(m.file_name || '')

/**
 * Grid of a request's uploaded documents (IDs, signatures, certificates,
 * receipts). Each image shows a preview thumbnail and opens in a fullscreen,
 * zoomable lightbox on click; PDFs / files that aren't images fall back to an
 * "Open original" link. All URLs are short-lived signed URLs — the storage
 * bucket is private (see lib/supabase/getSignedUrls.ts).
 */
export default function DocumentViewer({ media }: { media: ViewerMedia[] }) {
  // Holds the signed URL of the image being zoomed; null = lightbox closed.
  const [lightbox, setLightbox] = useState<string | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])
  useEscapeKey(closeLightbox, lightbox !== null)

  if (media.length === 0) {
    return <p className="text-sm ef-muted">No documents uploaded.</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {media.map((m) => (
          <DocCard key={m.id} m={m} onZoom={setLightbox} />
        ))}
      </div>

      {/* Lightbox — click the dark area or the ✕ to close */}
      {lightbox && (
        <div
          className="ef-overlay fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white text-xl leading-none backdrop-blur-sm transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="ef-dialog relative w-full max-w-3xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={lightbox} alt="Document preview" fill className="object-contain" unoptimized />
          </div>
        </div>
      )}
    </>
  )
}

// One document card. Rather than trusting mime_type (mobile uploads often leave
// it blank/wrong), we optimistically try to render the file as an image and
// only fall back to the file icon if it genuinely fails to load — so any real
// image previews and zooms, whatever its metadata says.
function DocCard({ m, onZoom }: { m: ViewerMedia; onZoom: (url: string) => void }) {
  const [failed, setFailed] = useState(false)
  const canPreview = !!m.signed_url && !isPdf(m) && !failed

  return (
    <div className="rounded-lg overflow-hidden border ef-border">
      <button
        type="button"
        onClick={() => canPreview && m.signed_url && onZoom(m.signed_url)}
        className="block w-full text-left"
        disabled={!canPreview}
      >
        <div className="relative h-28 w-full" style={{ background: 'var(--background)' }}>
          {canPreview ? (
            <Image
              src={m.signed_url!}
              alt={m.media_type}
              fill
              className="object-cover"
              unoptimized
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-3xl">📄</div>
          )}
          {canPreview && (
            <span className="absolute bottom-1 right-1 text-3xs bg-black/60 text-white px-1.5 py-0.5 rounded">
              click to zoom
            </span>
          )}
        </div>
      </button>
      <div className="px-2 py-1.5">
        <p className="text-xs font-medium capitalize truncate" style={{ color: 'var(--card-foreground)' }}>
          {m.media_type.replace(/_/g, ' ')}
        </p>
        {m.signed_url ? (
          <a href={m.signed_url} target="_blank" rel="noreferrer" className="text-2xs text-blue-600 dark:text-blue-400 hover:underline">
            Open original
          </a>
        ) : (
          <span className="text-2xs ef-muted">unavailable</span>
        )}
      </div>
    </div>
  )
}
