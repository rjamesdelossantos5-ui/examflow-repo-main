import type { MetadataRoute } from 'next'

// ⚠️ TEMPORARY — crawlers ALLOWED for external scanning (PowerMapper). This is
// NOT the normal state. Revert to `disallow: '/'` once testing is done so the
// login-gated system is closed to crawlers again (it will hold real student
// data). See the original "disallow all" version to restore.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  }
}
