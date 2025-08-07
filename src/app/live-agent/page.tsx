'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    GoogleGenAI,
    Session,
    LiveServerMessage,
    Modality,
    Type,
    Behavior
} from '@google/genai';
import TopicList from '../components/AgentPanel/TopicList';
import { AudioRecorder } from '@/lib/AudioStream/AudioRecorder';

interface Topic {
    id: string;
    title: string;
    commentaries: string[];
}

const newTopicFunction = {
    name: 'addNewTopic',
    behavior: Behavior.NON_BLOCKING,
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


const LiveAgentPage = () => {
    const [status, setStatus] = useState('Please start the capture.');
    const [isCapturing, setIsCapturing] = useState(false);
    const [commentary, setCommentary] = useState<string[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [liveTranscript, setLiveTranscript] = useState(''); // Holds the in-progress sentence

    // Refs for mutable state that doesn't trigger re-renders
    const isCapturingRef = useRef(isCapturing);
    isCapturingRef.current = isCapturing;
    const sessionRef = useRef<Session | null>(null);
    const audioRecorderRef = useRef<AudioRecorder | null>(null);
    const capturedStreamRef = useRef<MediaStream | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);

    // UI Refs
    const playbackAudioRef = useRef<HTMLAudioElement | null>(null);

    const flushLiveTranscript = useCallback(() => {
        setLiveTranscript(prevTranscript => {
            const transcriptToFlush = prevTranscript.trim();
            if (transcriptToFlush) {
                const sentences = transcriptToFlush.split(/(?<=[.!?])\s*/).filter(s => s.trim().length > 0);
                if (sentences.length > 0) {
                    setCommentary(prev => [...prev, ...sentences]);
                    setTopics(prevTopics => {
                        const newTopics = [...prevTopics];
                        if (newTopics.length > 0) {
                            newTopics[newTopics.length - 1].commentaries.push(...sentences);
                        } else {
                            return [{ id: 'initial-topic', title: "General Discussion", commentaries: [...sentences] }];
                        }
                        return newTopics;
                    });
                }
            }
            return ''; // Reset live transcript
        });
    }, []);

    const handleModelResponse = (message: LiveServerMessage) => {
        if (!message.serverContent?.modelTurn?.parts) {
            return;
        }

        const handleCommentary = (newCommentary: string) => {
            if (!newCommentary || newCommentary.toLowerCase().trim() === "silence.") {
                return;
            }
            setLiveTranscript(prev => {
                const updatedTranscript = (prev + newCommentary).trim();
                const sentences = updatedTranscript.split(/(?<=[.!?])\s*/).filter(s => s.trim().length > 0);

                if (sentences.length > 1) {
                    const completeSentences = sentences.slice(0, -1);
                    const remainingTranscript = sentences.slice(-1)[0] || '';

                    setCommentary(prevCommentary => [...prevCommentary, ...completeSentences]);

                    setTopics(prevTopics => {
                        const newTopics = [...prevTopics];
                        if (newTopics.length > 0) {
                            newTopics[newTopics.length - 1].commentaries.push(...completeSentences);
                        } else if (completeSentences.length > 0) {
                            return [{ id: 'initial-topic', title: "General Discussion", commentaries: [...completeSentences] }];
                        }
                        return newTopics;
                    });

                    return remainingTranscript;
                } else {
                    return updatedTranscript;
                }
            });
        };

        for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) {
                console.log("Handling Commentary: ", part.text)
                handleCommentary(part.text);
            }

            if (part.functionCall) {
                console.log("Handling Function Call: ", part.functionCall)
                const { name, args } = part.functionCall;
                if (name === 'addNewTopic' && args?.topic) {
                    const newTopicTitle = args.topic as string;
                    console.log(`✨ New Topic Identified: ${newTopicTitle}`);

                    flushLiveTranscript();

                    setTopics(prev => {
                        if (prev.some(t => t.title === newTopicTitle)) {
                            return prev; // Avoid adding duplicate topics
                        }
                        return [...prev, { id: Date.now().toString(), title: newTopicTitle, commentaries: [] }];
                    });
                }
            }
        }
    };

    const stopCapture = useCallback(() => {
        console.log("Stopping capture...");
        setIsCapturing(false);
        isCapturingRef.current = false;

        audioRecorderRef.current?.stop();
        audioRecorderRef.current = null;

        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
            console.log("🚀 Live session closed.");
        }

        if (capturedStreamRef.current) {
            capturedStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log("👋 Stream track stopped.");
            });
            capturedStreamRef.current = null;
        }

        if (audioTrackRef.current) {
            audioTrackRef.current.removeEventListener('ended', stopCapture);
            audioTrackRef.current = null;
        }

        if (playbackAudioRef.current) {
            playbackAudioRef.current.srcObject = null;
        }

        flushLiveTranscript();

        setStatus('🔴 Capture stopped. Ready to start again.');
    }, [flushLiveTranscript]);

    const startCapture = async () => {
        try {
            setStatus('Requesting permission... Please select a tab.');
            setCommentary([]);
            setTopics([]);
            setLiveTranscript('');

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            });

            const audioTracks = displayStream.getAudioTracks();
            if (audioTracks.length === 0) {
                setStatus('⚠️ No audio track found. Please select a tab with audio and check "Share tab audio".');
                displayStream.getTracks().forEach(track => track.stop());
                return;
            }

            audioTrackRef.current = audioTracks[0];
            capturedStreamRef.current = new MediaStream([audioTrackRef.current]);

            setStatus('Initializing live session...');

            const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables.");
            }
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `You are an expert meeting summarizer and topic analyst.
                        Your task is to listen to an ongoing audio stream and provide high-level, concise commentary about what is being discussed.
                        You are not a transcriber; you are a summarizer.

                        **Your instructions:**
                        1.  **Listen to the audio chunk.**
                        2.  **Analyze the content in the context of the previous commentary and the identified topics.**
                        3.  **Provide Commentary on the current chunk in the context of previous commentary.**
                            The commentary should be a **high-level summary** of what was just said or what happened. It should not be a direct transcription. If there is no sound, use "Silence.".
                        4.  **Decide whether a new topic should be opened based on the current chunk. Call the appropriate tool if necessary.**
                            If a **new, major topic** emerges that is distinct from the **existing list of topics**, you **MUST** call the addNewTopic tool with a concise name for the new topic (e.g., "Q3 Financial Review", "Marketing Campaign Brainstorm", "News about Climate Change", "The Weather" etc.).
                        5.  **Ensure continuity:** Your commentary should flow logically from the previous statements, creating a running summary of the meeting.
                        6.  **Ensure full sentence:** Always make sure to return full sentences as your reponse. It's crucial that you NEVER return partial sentences.

                        Now, analyze the new audio chunk and provide your summary and any new topics via the tools.`;

            sessionRef.current = await ai.live.connect({
                model: 'models/gemini-2.5-flash-live-preview',
                config: {
                    systemInstruction: { role: 'user', parts: [{ text: prompt }] },
                    temperature: 0.3,
                    responseModalities: [Modality.TEXT],
                    tools: [
                        { functionDeclarations: [newTopicFunction] }
                    ]
                },
                callbacks: {
                    onopen: () => console.log('🚀 Live session opened'),
                    onmessage: handleModelResponse,
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e.message);
                        setStatus(`Error: ${e.message}`);
                        stopCapture();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Live session closed:', e.reason);
                        if (isCapturingRef.current) stopCapture();
                    },
                },
            });

            // Initialize and start the audio recorder
            audioRecorderRef.current = new AudioRecorder();
            audioRecorderRef.current.on('data', (base64Audio: string) => {
                if (sessionRef.current && isCapturingRef.current) {
                    console.log("sending new cunk...")
                    sessionRef.current.sendRealtimeInput({
                        audio: {
                            data: base64Audio,
                            mimeType: 'audio/pcm;rate=16000',
                        }
                    });
                }
            });

            await audioRecorderRef.current.start(capturedStreamRef.current);

            setIsCapturing(true);
            isCapturingRef.current = true;
            setStatus('🟢 Capturing audio... Commentary will appear below.');

            audioTrackRef.current.addEventListener('ended', stopCapture);

        } catch (err: any) {
            console.error("Error during capture setup:", err);
            setStatus(`Error: ${err.message}`);
            if (err.name === 'NotAllowedError') {
                setStatus('Permission denied. Please try again and allow access.');
            }
            stopCapture();
        }
    };

    useEffect(() => {
        return () => {
            if (isCapturingRef.current) {
                stopCapture();
            }
        };
    }, [stopCapture]);

    return (
        <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-6xl">
                <div className="md:col-span-2 bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-700">
                    <h1 className="text-3xl font-bold mb-2 text-purple-400">Gemini Live Agent</h1>
                    <p className="text-gray-400 mb-6">Select a tab to capture and analyze its audio in real-time.</p>

                    <div className={`mb-6 p-4 rounded-lg bg-gray-700 text-gray-300 transition-all duration-300 ${isCapturing ? 'bg-green-800' : ''}`}>
                        {status}
                    </div>

                    <div className="flex justify-center space-x-4 mb-6">
                        <button
                            onClick={startCapture}
                            disabled={isCapturing}
                            className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 w-1/2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Start Capture
                        </button>
                        <button
                            onClick={stopCapture}
                            disabled={!isCapturing}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 w-1/2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Stop Capture
                        </button>
                    </div>

                    <div className="mt-6 bg-gray-700 p-4 rounded-lg h-64 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-purple-400 mb-2">Live Commentary</h2>
                        <div id="commentary" className="text-gray-300 space-y-2 text-left">
                            {commentary.map((text, index) => (
                                <p key={index}>- {text}</p>
                            ))}
                            {isCapturing && liveTranscript && (
                                <p className="text-gray-400">- {liveTranscript}</p>
                            )}
                            {isCapturing && commentary.length === 0 && !liveTranscript && <p>Waiting for first commentary...</p>}
                            {!isCapturing && commentary.length === 0 && !liveTranscript && <p>Start capture to see live commentary.</p>}
                        </div>
                    </div>

                    <div className="mt-6 text-xs text-gray-500">
                        <p><strong>Note:</strong> In the popup, choose a tab and ensure &quot;Share tab audio&quot; is checked.</p>
                    </div>
                </div>
                <div className="md:col-span-1">
                    <TopicList topics={topics} />
                </div>
            </div>
        </div>
    );
};

export default LiveAgentPage;

