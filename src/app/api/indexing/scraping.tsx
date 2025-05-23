// src/app/api/indexing/scraping.ts
import { load } from 'cheerio';

export interface DocumentMetadata {
  title: string;
  lastUpdated?: string;
  section?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: DocumentMetadata & {
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface ScraperResult {
  rawHTML: string;
  cleanHTML: string;
}

export class DocumentScraper {

  async scrapeUrl(url: string): Promise<ScraperResult> {
    const response = await fetch(url);
    const html = await response.text();

    // Use cheerio for lightweight HTML parsing
    const $ = load(html);

    // Target GCP doc specific structure
    const content = $('.devsite-article-body')
      .find('p, ul, ol, pre, h1, h2, h3, h4, h5, h6')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('\n\n');

    // Clean and validate content immediately after scraping
    const cleanedContent = this.cleanHtmlContent(content);

    return {
      rawHTML: html,
      cleanHTML: cleanedContent
    };
  }

  private cleanHtmlContent(html: string): string {
    if (!html) return '';

    return html
      // First remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove style tags and their content
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Remove meta tags
      .replace(/<meta\b[^>]*>/gi, '')
      // Remove link tags
      .replace(/<link\b[^>]*>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Convert header tags to newlines with text
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n\n')
      // Convert paragraph tags to newlines with text
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
      // Convert breaks to newlines
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove all remaining tags
      .replace(/<[^>]+>/g, ' ')
      // Fix whitespace
      .replace(/\s+/g, ' ')
      // Fix multiple newlines
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

}
