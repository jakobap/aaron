import {
    CommonRetrieverOptionsSchema,
} from 'genkit/retriever';
import { z } from 'genkit';
import type { Genkit } from 'genkit';
import fetch from 'node-fetch';
import { scrapeUrlAction } from '@/lib/actions/scraperAction';
import { Document } from 'genkit/retriever';

// Update this schema to include necessary Google Custom Search parameters
const customSearchRetrieverOptionsSchema = CommonRetrieverOptionsSchema.extend({
    k: z.number().optional().default(10),
});

// Define interface for search result items
interface SearchResultItem {
    link?: string;
    title?: string;
    snippet?: string;
    displayLink?: string;
}

interface GoogleSearchResponse {
    items?: SearchResultItem[];
    error?: {
        message: string;
    };
}

interface CleanedSearchResultItem {
    cleanedHtmlContent: string;
    link: string;
    title?: string;
    snippet?: string;
    displayLink?: string;
}

// Export a factory function to create the custom search retriever
export async function createCustomSearchRetriever(ai: Genkit) {
    return ai.defineSimpleRetriever(
        {
            name: `customSearchRetriever`,
            configSchema: customSearchRetrieverOptionsSchema,
            // Specify how to get the main text content from the Document object
            content: (doc: Document) => doc.text,
            // Specify how to get metadata from the Document object
            metadata: (doc: Document) => ({ ...doc.metadata }), // Include all metadata from the action
        },
        async (input, options) => {
            // Construct the search URL with query parameters
            const query = encodeURIComponent(typeof input === 'object' && input.text ? input.text : String(input));
            const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${process.env.CUSTOM_SEARCH_API_KEY}&cx=${process.env.CUSTOM_SEARCH_ENGINE_ID}&q=${query}`;

            try {
                // Make request to Google Custom Search API
                const response = await fetch(searchUrl);
                const data = (await response.json()) as GoogleSearchResponse;

                if (!response.ok) {
                    console.error('Google Search API error:', data);
                    throw new Error(`Search API returned error: ${data.error?.message || response.statusText}`);
                }

                // Parse the search results
                const results = data.items || [];
                const topKResults = results.slice(0, options.k); // Slice here before fetching content

                // Fetch content for each result
                const cleanedResults: CleanedSearchResultItem[] = (
                    await Promise.all(
                        topKResults.map(async (item: SearchResultItem) => {
                            if (!item.link) {
                                return null;
                            }

                            let cleanedHtmlContent = '';
                            try {
                                console.log(`Fetching content from: ${item.link}`);
                                const scraperResult = await scrapeUrlAction(item.link);
                                cleanedHtmlContent = scraperResult.cleanHTML;
                            } catch (error) {
                                console.error(`Error fetching content from ${item.link}:`, error);
                            }

                            return {
                                ...item,
                                link: item.link,
                                cleanedHtmlContent: cleanedHtmlContent || '',
                            };
                        })
                    )
                ).filter((result): result is CleanedSearchResultItem => result !== null);

                const resultDocs: Document[] = cleanedResults.map(item => {
                    const content = item.cleanedHtmlContent || item.snippet || item.title || 'Content unavailable';
                    return Document.fromText(content, {
                        title: item.title,
                        snippet: item.snippet,
                        link: item.link,
                        displayLink: item.displayLink,
                    });
                });

                // Return the top K results based on options
                return resultDocs;
            } catch (error) {
                console.error('Error searching Google API:', error);
                throw error;
            }
        }
    );
}