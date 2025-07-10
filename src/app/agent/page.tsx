'use client';

import { useState, useRef, useEffect } from 'react';

const AgentPage = () => {
    const [status, setStatus] = useState('Please start the capture.');
    const [isCapturing, setIsCapturing] = useState(false);
    const playbackAudioRef = useRef<HTMLAudioElement>(null);
    const capturedStreamRef = useRef<MediaStream | null>(null);

    const stopCapture = () => {
        if (capturedStreamRef.current) {
            capturedStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log("👋 Stream track stopped.");
            });
            capturedStreamRef.current = null;
        }

        if (playbackAudioRef.current) {
            playbackAudioRef.current.srcObject = null;
        }

        setStatus('🔴 Capture stopped. Ready to start again.');
        setIsCapturing(false);
    };

    const startCapture = async () => {
        try {
            setStatus('Requesting permission... Please select a tab.');

            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                    suppressLocalAudioPlayback: false
                },
            });

            const audioTracks = displayStream.getAudioTracks();

            if (audioTracks.length > 0) {
                capturedStreamRef.current = new MediaStream([audioTracks[0]]);
                console.log("✅ Tab audio stream captured:", capturedStreamRef.current);
                console.log("Audio Track:", capturedStreamRef.current.getAudioTracks()[0]);

                if (playbackAudioRef.current) {
                    playbackAudioRef.current.srcObject = capturedStreamRef.current;
                    playbackAudioRef.current.play().catch(e => console.error("Playback failed:", e));
                }
                
                setStatus('🟢 Capturing audio... Check the console for the stream object.');
                setIsCapturing(true);

                audioTracks[0].addEventListener('ended', stopCapture);

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
            if (capturedStreamRef.current) {
                stopCapture();
            }
        };
    }, []);

    return (
        <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center border border-gray-700">
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
                
                <div className="mt-6 text-xs text-gray-500">
                    <p><strong>Note:</strong> In the popup, choose a tab and ensure "Share tab audio" is checked.</p>
                </div>
            </div>
        </div>
    );
};

export default AgentPage;
