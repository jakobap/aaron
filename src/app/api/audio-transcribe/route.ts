import { NextRequest, NextResponse } from 'next/server';
import { FunctionDeclaration, FunctionCallingConfigMode, GoogleGenAI, Type } from '@google/genai';

// --- Best Practice: Initialize the AI client once outside the handler ---
const ai = new GoogleGenAI({
    vertexai: true,
    project: 'poerschmann-aaron',
    location: 'europe-west1'
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioBlob = formData.get('audio') as Blob | null;
        const previousCommentary = formData.get('commentary') as string | null;

        if (!audioBlob) {
            return NextResponse.json({ error: 'Audio blob not found.', status: 'error' }, { status: 400 });
        }

        if (audioBlob.size === 0) {
            return NextResponse.json({ commentary: 'Received empty audio chunk.', status: 'success' });
        }

        const audioBuffer = await audioBlob.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        const mimeType = (audioBlob.type || 'audio/webm').split(';')[0];

        const audioPart = {
            inlineData: {
                mimeType: mimeType,
                data: audioBase64,
            },
        };

        const prompt = `You are a highly accurate audio analysis AI. Your primary task is to provide real-time commentary on an audio stream using the tools provided.\n\n**Your instructions:**\n1.  **Listen to the audio chunk.**\n2.  **Analyze the content and call the appropriate functions:**\n    *   You **MUST** always call the \`provideCommentary\` tool. The commentary should be a transcription of speech, a description of sounds, or "Silence." if there is no sound.\n    *   If a **new, distinct topic** of conversation begins, you **MUST ALSO** call the \`addNewTopic\` tool with a concise, descriptive name for that topic (e.g., "React Component Setup", "Database Migration Strategy"). You can call both tools in parallel.\n3.  **Provide commentary via the tool:** Do not output commentary as a text response. Use the \`provideCommentary\` tool.\n\n**Previous commentary for context:**\n${previousCommentary || 'No previous commentary.'}\n\nNow, analyze the new audio chunk and call the necessary tools.`;

        const functionDeclarations: FunctionDeclaration[] = [
            {
                name: 'provideCommentary',
                description: 'Provides commentary on the audio chunk. Must always be called.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        commentary: {
                            type: Type.STRING,
                            description: 'The transcription of speech, description of sounds, or "Silence."',
                        },
                    },
                    required: ['commentary'],
                },
            },
            {
                name: 'addNewTopic',
                description: 'Call this when a new, distinct topic of conversation begins.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        topic: {
                            type: Type.STRING,
                            description: 'A concise, descriptive name for the new topic.',
                        },
                    },
                    required: ['topic'],
                },
            }
        ];

        // --- Calling the Gemini API ---
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [prompt, audioPart],
            config: {
                tools: [{ functionDeclarations }],
                toolConfig: {
                    functionCallingConfig: {
                        mode: FunctionCallingConfigMode.ANY,
                    },
                },
            }
        });

        const functionCalls = result.functionCalls;
        let commentary = ''; // Default to empty string
        let newTopic = null;

        if (functionCalls) {
            for (const call of functionCalls) {
                if (call.name === 'addNewTopic' && call.args?.topic) {
                    newTopic = call.args.topic as string;
                    console.log(`✨ New Topic Identified: ${newTopic}`);
                }
                if (call.name === 'provideCommentary' && call.args?.commentary) {
                    commentary = call.args.commentary as string;
                    console.log(`🎤 Commentary: ${commentary}`);
                }
            }
        }

        // Fallback in case the model returns text instead of a function call
        if (!commentary && result.text) {
            commentary = result.text;
        }

        return NextResponse.json({
            commentary: commentary,
            newTopic: newTopic,
            status: 'success'
        });

    } catch (error) {
        console.error('Audio transcription error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio';
        return NextResponse.json({ error: errorMessage, status: 'error' }, { status: 500 });
    }
}