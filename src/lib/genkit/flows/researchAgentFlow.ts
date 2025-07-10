
import { createCustomSearchRetriever } from '../retriever/customSearch';
import { createVertexAI, createAI } from '../genkitFactory';
import { z } from "genkit";
import { Document } from 'genkit/retriever';

// Create AI instance using the factory
// const ai = await createVertexAI();
const ai = await createAI();

// Create the custom search retriever
const customSearchRetriever = await createCustomSearchRetriever(ai);

// Tool for the agent to rephrase a query for better search results
const queryRephraser = ai.defineTool(
    {
        name: 'queryRephraser',
        description: 'Takes a user query and rephrases it into three diverse and effective search queries.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ rephrasedQueries: z.array(z.string())}),
    },
    async ({ query }) => {
        const queryRephraserPrompt = ai.prompt('queryRephraser');
        const { output } = await queryRephraserPrompt({ query: query });
        return output;
    }
);

// Tool for the agent to perform a web search
const webSearcher = ai.defineTool(
    {
        name: 'webSearcher',
        description: 'Performs a web search using a given query and returns relevant documents.',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({
            docs: z.array(z.object({
                content: z.array(z.any()).optional(),
                metadata: z.record(z.string(), z.any()).optional()
            }))
        }),
    },
    async ({ query }) => {
        console.log(`Agent is searching for: "${query}"`);
        const docs = await ai.retrieve({
            retriever: customSearchRetriever,
            query: query,
            options: { k: 5 },
        });
        return { docs };
    }
);

// Define the flow that invokes the agent
export const researchAgentFlow = ai.defineFlow(
    {
        name: "researchAgentFlow",
        inputSchema: z.string(),
        outputSchema: z.object({
            summary: z.string(),
            docs: z.array(z.object({
                content: z.array(z.any()).optional(),
                metadata: z.record(z.string(), z.any()).optional()
            }))
        }),
    },
    async (question: string) => {
        console.log("Running Research Agent Flow on query: ", question);
        
        const researchAgent = ai.prompt('researchAgent');
        const response = await researchAgent(
            {
                question: question
            },
            {   
                tools: [queryRephraser, webSearcher],
                maxTurns: 3
            }
        );

        const docs = (response.request?.messages || [])
            .flatMap(m => m.content)
            .filter(p => p.toolResponse && p.toolResponse.name === 'webSearcher')
            .flatMap(p => (p.toolResponse?.output as { docs: Document[] })?.docs || []);

        console.log("Retrieved documents:", docs)

        return { summary: response.text, docs: docs };
    }
);
