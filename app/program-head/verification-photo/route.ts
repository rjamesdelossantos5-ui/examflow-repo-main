import { reviewableSession } from '@/lib/verificationReview'
import { getSessionDecision, photoUrl } from '@/lib/didit'
import { isVerificationPhoto } from '@/lib/verificationPhotos'

// Vercel refuses a function response over 4.5 MB (FUNCTION_PAYLOAD_TOO_LARGE —
// vercel.com/docs/functions/limitations). Stop a little under it and say why,
// rather than let the platform fail the request with no explanation.
const MAX_BYTES = 4 * 1024 * 1024

/** First bytes of the image formats Didit's photos can plausibly be. The type is
 *  read from the bytes rather than trusted from the upstream header. */
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

/**
 * One of the parent's verification photos, for the Program Head's manual check
 * at first approval: GET /program-head/verification-photo?req=<id>&photo=<kind>.
 *
 * Proxied through here instead of handing the browser Didit's own link:
 *  - The Content-Security-Policy (next.config.ts) only allows images from this
 *    site and Supabase, and it only applies in production. A direct Didit link
 *    would work in dev and break once deployed.
 *  - Didit's presigned links never reach a browser, and every photo load
 *    re-checks that this viewer may still see this request.
 *
 * `no-store` because this is a parent's ID and face: nothing should keep a copy.
 * proxy.ts already limits /program-head to Program Heads and admins; the check
 * in reviewableSession is the real one.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const requestId = params.get('req') ?? ''
  const photo = params.get('photo') ?? ''
  if (!requestId || !isVerificationPhoto(photo)) return new Response('Bad request', { status: 400 })

  const access = await reviewableSession(requestId)
  if (!access.ok) return new Response('Not available', { status: access.reason === 'unauthorized' ? 401 : 404 })
  if (!access.sessionId) return new Response('No verification on record', { status: 404 })

  const got = await getSessionDecision(access.sessionId)
  if (got.error) return new Response('Could not reach the verification service', { status: 502 })
  const src = photoUrl(got.decision, photo)
  if (!src) return new Response('Not available', { status: 404 })

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(15_000), cache: 'no-store' })
    if (!res.ok) {
      console.error('[verification-photo] upstream', res.status)
      return new Response('Could not load the photo', { status: 502 })
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) {
      console.error('[verification-photo] too large to send', bytes.byteLength)
      return new Response('Photo too large to display', { status: 502 })
    }
    const type = imageType(bytes)
    if (!type) {
      console.error('[verification-photo] not a recognised image', res.headers.get('content-type'))
      return new Response('Could not load the photo', { status: 502 })
    }
    return new Response(bytes, {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    console.error('[verification-photo]', err)
    return new Response('Could not load the photo', { status: 502 })
  }
}
