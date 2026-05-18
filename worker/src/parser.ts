export interface PropertyDetails {
  address: string | null;
  price: string | null;
}

/**
 * Extracts property title/address and current price from raw markdown.
 */
export function parsePropertyDetails(markdown: string): PropertyDetails {
  const address = extractAddress(markdown);
  const price = extractPrice(markdown);
  return { address, price };
}

function extractAddress(markdown: string): string | null {
  // Try the first H1 heading as the property title/address
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback: first H2
  const h2Match = markdown.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return h2Match[1].trim();
  }

  return null;
}

function extractPrice(markdown: string): string | null {
  // Match common price patterns: $1,234,567 / €1.234.567 / £1,234,567 / 1.234.567 TL etc.
  const pricePattern = /[$€£]\s?[\d.,]+[\d]|[\d.,]+[\d]\s?(?:TL|EUR|USD|GBP|₺|€|\$|£)/i;
  const match = markdown.match(pricePattern);
  if (match) {
    return match[0].trim();
  }

  // Try "Price: ..." or "Fiyat: ..." patterns
  const labelPattern = /(?:price|fiyat|asking|liste)\s*[:\-]\s*(.+)/i;
  const labelMatch = markdown.match(labelPattern);
  if (labelMatch) {
    return labelMatch[1].trim().slice(0, 100);
  }

  return null;
}
