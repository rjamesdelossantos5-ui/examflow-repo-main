'use client'

import { useState } from 'react'
import Image from 'next/image'

export interface ViewerMedia {
  id: string
  media_type: string
  file_name: string
  mime_type: string
  signed_url?: string
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)(\?|$)/i

// Decide whether a file is a viewable image. mime_type is the primary signal,
// but some (mostly mobile) uploads arrive with an empty or wrong type, so we
// fall back to the file name / URL extension. PDFs stay non-image.
function isImageMedia(m: ViewerMedia): boolean {
  if (m.mime_type?.startsWith('image/')) return true
  if (m.mime_type === 'application/pdf' || /\.pdf(\?|$)/i.test(m.file_name)) return false
  return IMAGE_EXT.test(m.file_name || '') || IMAGE_EXT.test(m.signed_url || '')
}

/**
 * Grid of a request's uploaded documents (IDs, signatures, certificates) for
 * reviewers. Images open in a fullscreen lightbox; PDFs/other files fall back
 * to an "Open original" link. All URLs are short-lived signed URLs — the
 * storage bucket is private (see lib/supabase/getSignedUrls.ts).
 */
export default function DocumentViewer({ media }: { media: ViewerMedia[] }) {
  // Holds the signed URL of the image being zoomed; null = lightbox closed.
  const [lightbox, setLightbox] = useState<string | null>(null)

  if (media.length === 0) {
    return <p className="text-sm ef-muted">No documents uploaded.</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {media.map((m) => {
          const isImage = isImageMedia(m)
          return (
            <div key={m.id} className="rounded-lg overflow-hidden border ef-border">
              <button
                type="button"
                onClick={() => isImage && m.signed_url && setLightbox(m.signed_url)}
                className="block w-full text-left"
                disabled={!isImage}
              >
                <div className="relative h-28 w-full" style={{ background: 'var(--background)' }}>
                  {isImage && m.signed_url ? (
                    <Image src={m.signed_url} alt={m.media_type} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full flex items-center justify-center text-3xl">📄</div>
                  )}
                  {isImage && (
                    <span className="absolute bottom-1 right-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
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
                  <a href={m.signed_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                    Open original
                  </a>
                ) : (
                  <span className="text-[11px] ef-muted">unavailable</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white text-xl leading-none backdrop-blur-sm transition-colors"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="relative w-full max-w-3xl h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={lightbox} alt="Document preview" fill className="object-contain" unoptimized />
          </div>
        </div>
      )}
    </>
  )
}
