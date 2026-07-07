// The exam-documents bucket is PRIVATE (IDs, medical certificates), so files
// can't be linked directly. This turns each storage path into a short-lived
// signed URL the reviewer's browser can render; after the TTL the link dies,
// so a leaked/forwarded URL goes stale quickly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function attachSignedUrls(supabase: any, media: { storage_path: string }[]) {
  return Promise.all(
    media.map(async (m) => {
      const { data } = await supabase.storage
        .from('exam-documents')
        .createSignedUrl(m.storage_path, 60 * 10) // 10-min TTL
      return { ...m, signed_url: data?.signedUrl as string | undefined }
    })
  )
}
