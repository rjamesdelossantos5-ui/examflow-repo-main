import type { MetadataRoute } from 'next'

// EXAMFLOW is a login-gated internal school system — there is nothing a search
// engine should index (the only public page is the login screen). This also
// fixes the Lighthouse "robots.txt is not valid" error: without this file,
// crawlers requesting /robots.txt got an HTML page back.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  }
}
