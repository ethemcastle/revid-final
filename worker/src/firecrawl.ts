const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";

type FirecrawlExtractResult = {
  markdown: string;
};

export async function scrapeMarkdown(url: string): Promise<FirecrawlExtractResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY is required");
  }

  const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firecrawl scrape failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: { markdown?: string };
  };

  const markdown = payload.data?.markdown;
  if (!markdown) {
    throw new Error("Firecrawl response did not contain markdown");
  }

  return { markdown };
}

