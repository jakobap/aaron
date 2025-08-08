import { NextRequest, NextResponse } from 'next/server';
import { FunctionDeclaration, FunctionCallingConfigMode, GoogleGenAI, Type } from '@google/genai';

// --- Best Practice: Initialize the AI client once outside the handler ---
const ai = new GoogleGenAI({
    vertexai: true,
    project: 'poerschmann-aaron',
    location: 'europe-west1'
});

export async function POST(request: NextRequest) {
    console.log("Triggered Commentary API")
    try {
        const formData = await request.formData();
        const audioBlob = formData.get('audio') as Blob | null;
        const previousCommentary = formData.get('commentary') as string | null;
        const previousTopics = formData.get('topics') as string | null;

        if (!audioBlob) {
            return NextResponse.json({ error: 'Audio blob not found.', status: 'error' }, { status: 400 });
        }

        if (audioBlob.size === 0) {
            return NextResponse.json({ commentary: 'Received empty audio chunk.', status: 'success' });
        }

        const audioBuffer = await audioBlob.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        const mimeType = audioBlob.type || 'audio/webm;codecs=opus';

        const audioPart = {
            inlineData: {
                mimeType: mimeType,
                data: audioBase64,
            },
        };

        const prompt = `You are an expert meeting summarizer and topic analyst. Your task is to listen to an ongoing audio stream and provide high-level, concise commentary about what is being discussed. You are not a transcriber; you are a summarizer.

                        **Your instructions:**
                        1.  **Listen to the audio chunk.**
                        2.  **Analyze the content in the context of the previous commentary and the identified topics.**
                        3.  **Call the appropriate functions:**
                            *   You **MUST** always call the 
                        provideCommentary
                        tool. The commentary should be a **high-level summary** of what was just said or what happened. It should not be a direct transcription. If there is no sound, use "Silence.".
                            *   If a **new, major topic** emerges that is distinct from the **existing list of topics**, you **MUST ALSO** call the 
                        addNewTopic
                        tool with a concise name for the new topic (e.g., "Q3 Financial Review", "Marketing Campaign Brainstorm"). You can call both tools in parallel.
                        4.  **Ensure continuity:** Your commentary should flow logically from the previous statements, creating a running summary of the meeting.

                        **Identified topics for context:**
                        ${previousTopics || 'No topics have been identified yet.'}

                        **Previous commentary for context:**
                        ${previousCommentary || 'This is the beginning of the conversation.'}

                        Now, analyze the new audio chunk and provide your summary and any new topics via the tools.`;

        const functionDeclarations: FunctionDeclaration[] = [
            {
                name: 'provideCommentary',
                description: 'Provides commentary on the audio chunk. Must always be called.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        commentary: {
                            type: Type.STRING,
                            description: 'The commentary of speech, description of sounds, or "Silence."',
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
