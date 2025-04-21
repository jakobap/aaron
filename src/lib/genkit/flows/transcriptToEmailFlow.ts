'use server';

import { createAI, createVertexAI } from '../genkitFactory';
// import { gemini20Flash, gemini25ProPreview0325, gemini25FlashPreview0417 } from "@genkit-ai/googleai";
import { z } from "genkit";
import { createSimpleFirestoreVSRetriever } from '../retriever/simpleSearchRetriever';
import { gemini25ProPreview0325 } from '@genkit-ai/vertexai';

// Create AI instance & retriever using the factory
// const ai = await createAI(gemini25FlashPreview0417);
const ai = await createVertexAI();

await createSimpleFirestoreVSRetriever(ai);

// STEP 1: Task Extraction
const TaskSchema = z.object({
    description: z.string(),
});

const TaskArraySchema = ai.defineSchema(
    'TaskArraySchema',
    z.array(TaskSchema)
);

export const taskExtractionFlow = ai.defineFlow(
    {
        name: "taskExtractionFlow",
        inputSchema: z.string(),
        outputSchema: TaskArraySchema,
    },
    async (transcript) => {

        console.log("Running Task Extraction Flow on transcript...");

        const taskExtractionPrompt = ai.prompt('taskExtraction');

        const { output } = await taskExtractionPrompt(
            {
                transcript: transcript,
            },
            {
                model: gemini25ProPreview0325,
                output: { schema: TaskArraySchema }
            }
        );

        return output;
    }
);


// STEP 2: Task Research
const TaskResearchResponse = ai.defineSchema(
    'TaskResearchResponse',
    z.object({
        answer: z.string(),
        caveats: z.array(z.string()),
        docReferences: z.array(z.object({
            title: z.string(),
            url: z.string(),
            relevantContent: z.string().optional(),
        })),
    })
);

const TaskResearchResponseArray = ai.defineSchema(
    'TaskResearchResponseArray',
    z.array(TaskResearchResponse)
);

export const taskReseachFlow = ai.defineFlow(
    {
        name: "taskReseachFlow",
        inputSchema: TaskArraySchema,
        outputSchema: TaskResearchResponseArray,
    },
    async (tasks) => {

        console.log("Running Task Research Flow on transcript...");

        // 1. Retrieve relevant documents for each task in parallel
        const retrievalPromises = tasks.map(task => {
            return ai.retrieve({
                retriever: 'simpleFirestoreVSRetriever',
                query: task.description, // Use task description as query
                options: { limit: 10 }
            });
        });

        const taskDocsArray = await Promise.all(retrievalPromises);

        // 2. Parallel task research generation
        const taskResearchPrompt = ai.prompt('taskResearch');
        const generationPromises = tasks.map(async (task, index) => {
            const docs = taskDocsArray[index];
            const { output } = await taskResearchPrompt(
                {
                    question: task.description
                },
                {
                    docs: docs,
                    output: { schema: TaskResearchResponse }
                }
            );

            return output;
        });
        const researchResults = await Promise.all(generationPromises);

        return researchResults;
    }
);


// STEP 3: Email Generation based on research
export const emailAggregationFlow = ai.defineFlow(
    {
        name: "emailAggregationFlow",
        inputSchema: z.object({
            tasks: TaskArraySchema,
            researchResults: TaskResearchResponseArray
        }),
        outputSchema: z.string(),
    },
    async (input) => {

        const emailGenerationPrompt = ai.prompt('emailGeneration');

        const { output } = await emailGenerationPrompt({
            tasks: JSON.stringify(input.tasks, null, 2),
            research: JSON.stringify(input.researchResults, null, 2)
        },
            {
                model: gemini25ProPreview0325,
            });

        return output.email;
    }
);


// Aggregated Orchestration Flow
export const transcriptToEmailFlow = ai.defineFlow(
    {
        name: "transcriptToEmailFlow",
        inputSchema: z.string(),
        outputSchema: z.object({
            tasks: TaskArraySchema,
            research: TaskResearchResponseArray,
            email: z.string(),
        })
    },
    async (transcript) => {

        const extractedTasks = await taskExtractionFlow(transcript);

        const taskResearchResults = await taskReseachFlow(extractedTasks);

        const email = await emailAggregationFlow({
            tasks: extractedTasks,
            researchResults: taskResearchResults
        });

        return {
            tasks: extractedTasks,
            research: taskResearchResults,
            email: email
        };
    }
);

