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

export default function DocumentViewer({ media }: { media: ViewerMedia[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null)

  if (media.length === 0) {
    return <p className="text-sm ef-muted">No documents uploaded.</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {media.map((m) => {
          const isImage = m.mime_type.startsWith('image/')
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
            className="absolute top-4 right-4 text-white text-2xl"
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
