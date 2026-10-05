/** The document id of a docs.google.com/document link, or null for anything else. */
export function parseGoogleDocLink(link: string): string | null {
  const m = /^(?:https?:\/\/)?docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([\w-]+)/i.exec(link.trim())
  return m ? m[1] : null
}
