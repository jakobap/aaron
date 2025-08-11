'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import TopicList from '../components/AgentPanel/TopicList';

interface Topic {
    id: string;
    title: string;
    commentaries: string[];
}

const AgentPage = () => {
    const [status, setStatus] = useState('Please start the capture.');
    const [isCapturing, setIsCapturing] = useState(false);
    const [commentary, setCommentary] = useState<string[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const commentaryRef = useRef(commentary);
    commentaryRef.current = commentary;
    const playbackAudioRef = useRef<HTMLAudioElement>(null);
    const capturedStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

    const stopCapture = useCallback(() => {
        if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
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

        setStatus('🔴 Capture stopped. Ready to start again.');
        setIsCapturing(false);
    }, []);

    const handleDataAvailable = useCallback(async (event: BlobEvent) => {
        if (event.data.size > 0) {
            console.log("🎤 Got audio chunk, size:", event.data.size);
            try {
                const formData = new FormData();
                formData.append('audio', event.data);
                formData.append('commentary', commentaryRef.current.join('\n'));

                const response = await fetch('/api/audio-transcribe', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }

                const result = await response.json();

                if (result.status === 'success') {
                    if (result.commentary && result.commentary !== "Silence.") {
                        setCommentary(prev => [...prev, result.commentary]);

                        setTopics(prevTopics => {
                            const newTopics = [...prevTopics];
                            if (newTopics.length > 0) {
                                newTopics[newTopics.length - 1].commentaries.push(result.commentary);
                            }
                            return newTopics;
                        });
                    }

                    if (result.newTopic) {
                        setTopics(prev => [...prev, { id: Date.now().toString(), title: result.newTopic, commentaries: [] }]);
                    }
                } else {
                    console.error("API Error:", result.error);
                }
            } catch (error) {
                console.error("Error sending audio to backend:", error);
            }
        }
        
        if (mediaRecorderRef.current && intervalIdRef.current) {
            mediaRecorderRef.current.start();
        }
    }, [commentaryRef]);

    const startCapture = async () => {
        try {
            setStatus('Requesting permission... Please select a tab.');
            setCommentary([]);
            setTopics([]);

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
            } as any);

            const audioTracks = displayStream.getAudioTracks();
            audioTrackRef.current = audioTracks.length > 0 ? audioTracks[0] : null;

            if (audioTrackRef.current) {
                if (audioTrackRef.current.label.toLowerCase().includes('microphone')) {
                    setStatus("⚠️ Warning: Capturing microphone audio. Check selection for tab audio.");
                }
                capturedStreamRef.current = new MediaStream([audioTrackRef.current]);
                console.log("✅ Tab audio stream captured:", capturedStreamRef.current);
                console.log("Audio Track:", capturedStreamRef.current.getAudioTracks()[0]);
                console.log("Audio Track Label:", audioTrackRef.current.label);

                if (playbackAudioRef.current) {
                    playbackAudioRef.current.srcObject = capturedStreamRef.current;
                    playbackAudioRef.current.play().catch(e => console.error("Playback failed:", e));
                }

                const options = { mimeType: 'audio/webm' };
                mediaRecorderRef.current = new MediaRecorder(capturedStreamRef.current, options);
                mediaRecorderRef.current.ondataavailable = handleDataAvailable;
                
                mediaRecorderRef.current.start();
                setIsCapturing(true);
                setStatus('🟢 Capturing audio... Commentary will appear below.');

                intervalIdRef.current = setInterval(() => {
                    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                        mediaRecorderRef.current.stop();
                    }
                }, 4000);

                audioTrackRef.current.addEventListener('ended', stopCapture);

            } else {
                setStatus('⚠️ No audio track found. Please select a tab with audio and check "Share tab audio".');
                displayStream.getTracks().forEach(track => track.stop());
            }

        } catch (err: any) {
            console.error("Error during capture:", err);
            setStatus(`Error: ${err.message}`);
            if (err.name === 'NotAllowedError') {
                setStatus('Permission denied. Please try again and allow access.');
            }
        }
    };

    useEffect(() => {
        // Clean up tracks when the component unmounts
        return () => {
            stopCapture();
        };
    }, [stopCapture]);

    return (
        <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-6xl">
                <div className="md:col-span-2 bg-gray-800 p-8 rounded-2xl shadow-2xl text-center border border-gray-700">
                    <h1 className="text-3xl font-bold mb-2 text-cyan-400">Tab Audio Recorder</h1>
                    <p className="text-gray-400 mb-6">Select a tab to capture its audio output.</p>

                    <div className={`mb-6 p-4 rounded-lg bg-gray-700 text-gray-300 transition-all duration-300 ${isCapturing ? 'bg-green-800' : ''}`}>
                        {status}
                    </div>

                    <div className="flex justify-center space-x-4 mb-6">
                        <button
                            id="startButton"
                            onClick={startCapture}
                            disabled={isCapturing}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 w-1/2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Start Capture
                        </button>
                        <button
                            id="stopButton"
                            onClick={stopCapture}
                            disabled={!isCapturing}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 w-1/2 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Stop Capture
                        </button>
                    </div>

                    <div className="bg-gray-700 p-4 rounded-lg">
                        <label htmlFor="playback" className="block text-sm font-medium text-gray-400 mb-2">Live Audio Playback:</label>
                        <audio id="playback" ref={playbackAudioRef} controls className="w-full"></audio>
                    </div>

                    <div className="mt-6 bg-gray-700 p-4 rounded-lg h-64 overflow-y-auto">
                        <h2 className="text-lg font-semibold text-cyan-400 mb-2">Live Commentary</h2>
                        <div id="commentary" className="text-gray-300 space-y-2 text-left">
                            {commentary.map((text, index) => (
                                <p key={index}>- {text}</p>
                            ))}
                            {isCapturing && commentary.length === 0 && <p>Waiting for first audio chunk...</p>}
                            {!isCapturing && commentary.length === 0 && <p>Start capture to see live commentary.</p>}
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

export default AgentPage;