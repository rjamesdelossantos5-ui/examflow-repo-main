// The Didit photos the Program Head compares by hand at first approval: the
// face printed on the parent's ID next to the live selfie, plus both sides of
// the ID. Shared by the PH queue (a client component) and the photo route, so
// this file must stay free of secrets and server-only imports.
//
// Each value doubles as the caption DocumentViewer prints (it swaps "_" for a
// space and capitalises each word), which is why "ID" is written in capitals.
export const VERIFICATION_PHOTOS = ['face_on_ID', 'live_selfie', 'ID_front', 'ID_back'] as const

export type VerificationPhoto = (typeof VERIFICATION_PHOTOS)[number]

export function isVerificationPhoto(value: string): value is VerificationPhoto {
  return (VERIFICATION_PHOTOS as readonly string[]).includes(value)
}

/** Where the browser loads one photo from — app/program-head/verification-photo/route.ts. */
export function verificationPhotoSrc(requestId: string, photo: VerificationPhoto): string {
  return `/program-head/verification-photo?req=${encodeURIComponent(requestId)}&photo=${photo}`
}
