
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
        const { output } = await queryRephraserPrompt({ input: query });
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
            options: { k: 3 },
        });
        return { docs };
    }
);

// Define the Research Agent
const researchAgent = ai.definePrompt(
    {
        name: 'researchAgent',
        // model: 'gemini-2.5-pro',
        model: 'googleai/gemini-2.5-pro',
        // config: {},
        system: `
        You are a highly intelligent and diligent research assistant. Your primary goal is to provide a comprehensive, accurate, and well-supported answer to the user's question.

        To achieve this, you must follow a rigorous, iterative research and validation process:

        **Phase 1: Information Gathering (Iterative Loop)**
        1.  **Analyze the Request:** Start with the user's initial 'question'.
        2.  **Formulate an Initial Query:** Use the 'queryRephraser' tool to create an effective search query.
        3.  **Search:** The 'queryRephraser' tool will return a list of three queries. You MUST run the 'webSearcher' tool for EACH of these three queries to gather a comprehensive set of sources.
        4.  **Evaluate Sources:** Critically review the search results. Ask yourself:
            *   Is the information sufficient to begin answering the user's question?
            *   Are the sources reliable and diverse?
            *   Do I need to explore a different angle or a sub-topic to get a complete picture?
        5.  **Decide and Iterate:**
            *   **If the information is insufficient or requires more depth,** repeat the process. Formulate a new, more specific query with 'queryRephraser' and search again with 'webSearcher'. You must repeat this loop until you are confident you have enough high-quality information.
            *   **If the information is sufficient,** proceed to Phase 2.

        **Phase 2: Synthesis and Self-Correction**
        1.  **Synthesize a Draft Answer:** Combine all the information you have gathered into a single, coherent, and well-structured draft answer.
        2.  **Validate the Draft:** Now, critically compare your draft answer against the **original user question**. Ask yourself:
            *   Does my answer fully and directly address all parts of the user's question?
            *   Is the answer complete, or are there gaps in the explanation?
            *   Could the answer be improved with more detail or evidence?
        3.  **Final Decision:**
            *   **If the answer is incomplete or could be improved,** you MUST return to Phase 1 to gather more information. Formulate new queries to fill the specific gaps you identified.
            *   **If the answer is complete, accurate, and thorough,** proceed to the final step.

        **Final Output:**
        Present the final, validated answer to the user.

        **IMPORTANT:** Output ONLY the final, synthesized answer. Do not narrate your internal thought process, the steps you took, or mention the tools you used.
      `,
        input: {
            schema: z.object({
                question: z.string(),
            }),
        },
        prompt: 'Here is the original user question to research and answer according to the logic mentioned above: {{question}}.?',
        tools: [queryRephraser, webSearcher],
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

        const response = await researchAgent(
            {
                question: question
            },
            {
                maxTurns: 10
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
