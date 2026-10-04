import { useEffect, useState } from "react"

/** A scannable QR code for the live app — the library only loads once a URL is configured. */
export function LiveUrlQr({ url }: { url: string }) {
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import("qrcode")
      .then((qr) => qr.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0b1f2a", light: "#ffffff" } }))
      .then((dataUrl) => {
        if (!cancelled) setImage(dataUrl)
      })
      .catch(() => {
        // No QR code is better than a broken one; the link next to it still works.
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <a href={url} className="group flex items-center gap-3">
      {image ? (
        <img src={image} alt={`QR code for ${url}`} width={80} height={80} className="h-20 w-20 rounded-lg border border-ink-200 bg-white p-1" />
      ) : (
        <span className="h-20 w-20 rounded-lg border border-ink-200 bg-ink-50" aria-hidden="true" />
      )}
      <span className="text-xs text-ink-500">
        <span className="block font-semibold text-ink-700">Open the live demo</span>
        <span className="break-all text-teal-600 group-hover:underline">{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
      </span>
    </a>
  )
}
