'use server';

import { genkit } from 'genkit';
import { genkit as genkitBeta } from "genkit/beta";
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import { genkitEval, GenkitMetric } from '@genkit-ai/evaluator';
// import {
//     gemini20Flash,
//     gemini25ProPreview0325,
//     gemini25FlashPreview0417,
// } from '@genkit-ai/googleai';

import { gemini20Flash, gemini25ProPreview0325, gemini25FlashPreview0417 } from '@genkit-ai/vertexai'

import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { VertexAI } from '@google-cloud/vertexai';
// import { anthropic, claude37Sonnet } from 'genkitx-anthropic';

// Define model types for better type safety
export type SupportedModel =
    | typeof gemini20Flash
    | typeof gemini25ProPreview0325
    | typeof gemini25FlashPreview0417
// | typeof claude37Sonnet


// Factory function to create GenKit instances with specific models
export async function createAI(modelString: string = 'gemini-2.5-flash') {
    enableFirebaseTelemetry();
    const model = googleAI.model(modelString);
    return genkit({
        plugins: [
            googleAI(),
            genkitEval({
                judge: googleAI.model('gemini-2.5-flash'),
                embedder: 'googleai/text-embedding-004',
                metrics: [GenkitMetric.MALICIOUSNESS, GenkitMetric.ANSWER_RELEVANCY, GenkitMetric.FAITHFULNESS],
            })
        ],
        model,
        promptDir: './src/lib/genkit/prompts'
    });
}

// Factory function to create GenKit instances with specific models
export async function createBetaAI(modelString: string = 'gemini-2.5-flash') {
    enableFirebaseTelemetry();
    const model = googleAI.model(modelString);
    return genkitBeta({
        plugins: [
            googleAI(),
            genkitEval({
                judge: googleAI.model('gemini-2.5-flash'),
                embedder: 'googleai/text-embedding-004',
                metrics: [GenkitMetric.MALICIOUSNESS, GenkitMetric.ANSWER_RELEVANCY, GenkitMetric.FAITHFULNESS],
            })
        ], model,
        promptDir: './src/lib/genkit/prompts'
    });
}

export async function createVertexAI(modelString: string = 'gemini-2.5-flash') {
    enableFirebaseTelemetry();
    const model = vertexAI.model(modelString);
    return genkit({
        plugins: [
            vertexAI({ location: 'us-central1' }),
            genkitEval({
                judge: vertexAI.model('gemini-2.5-flash'),
                embedder: 'vertexai/text-embedding-004',
                metrics: [GenkitMetric.MALICIOUSNESS, GenkitMetric.ANSWER_RELEVANCY, GenkitMetric.FAITHFULNESS]
            }),
        ],
        model,
        promptDir: './src/lib/genkit/prompts'
    });

}

// export async function createBetaAnthropicAI(model: SupportedModel) {
//     enableFirebaseTelemetry();
//     return genkitBeta({
//         plugins: [anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })],
//         model,
//         promptDir: './src/lib/genkit/prompts'
//     });
// }