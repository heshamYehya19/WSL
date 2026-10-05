/** The largest file the server accepts for any upload (mirrors server/screening.ts). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** A file's contents as base64, the form the API takes uploads in. */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
