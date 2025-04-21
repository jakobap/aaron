import { createCustomSearchRetriever } from '../retriever/customSearch';
import { createAI, createVertexAI } from '../genkitFactory';
import { gemini25ProPreview0325 } from '@genkit-ai/vertexai';
// import { gemini20Flash, gemini25ProPreview0325, gemini25FlashPreview0417 } from "@genkit-ai/googleai";


import { z } from "genkit";

// Create AI instance using the factory
// const ai = await createAI(gemini25FlashPreview0417);
const ai = await createVertexAI();


const customSearchRetriever = await createCustomSearchRetriever(ai);

export const researchFlow = ai.defineFlow(
    {
        name: "researchFlow",
        inputSchema: z.string(),
        outputSchema: z.object({
            summary: z.string(),
            docs: z.array(z.object({
              content: z.array(z.any()).optional(),
              metadata: z.record(z.string(), z.any()).optional()
            }))
          }),    },
    async (input: string) => {

        console.log("Running Research Flow on query: ", input)

        // retrieve relevant documents with all required parameters
        const docs = await ai.retrieve({
            retriever: customSearchRetriever,
            query: input,
            options: {
                k: 8
            },
        });

        const qaSummaryPrompt = ai.prompt('qaSummary');

        const { text } = await qaSummaryPrompt(
          {
            question: input
          },
          {
            docs: docs,
            model: gemini25ProPreview0325
          }
        );

        return { summary: text, docs: docs };
    }
);