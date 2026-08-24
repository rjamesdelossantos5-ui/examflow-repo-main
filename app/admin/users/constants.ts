// Plain module (NOT 'use server') — a "use server" file may only export async
// functions, so this constant lives here and is imported by both the server
// action and the client uploader.

/**
 * Rows per import request. Creating an auth user is one API call each and can't
 * be batched, so the client sends sequential chunks this size — small enough to
 * finish well inside a serverless timeout, and it gives a real progress bar.
 */
export const IMPORT_CHUNK_SIZE = 20
