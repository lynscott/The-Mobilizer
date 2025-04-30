import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioPlayer() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize AudioContext (only once)
  useEffect(() => {
    // Check if window is defined (for SSR compatibility)
    if (typeof window !== 'undefined') {
        // iOS requires the context to be created *after* a user gesture
        // We'll try creating it here, but might need to resume later
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            setError("Audio playback not supported in this browser.");
        }
    }

    // Cleanup function to stop any playing audio and close context if needed
    return () => {
      sourceNodeRef.current?.stop();
      // Avoid closing the context immediately, let browser manage lifecycle unless absolutely necessary
      // audioContextRef.current?.close().catch(console.error);
    };
  }, []);

  // Function to fetch and play audio
  const playAudio = useCallback(async (text: string) => {
    if (!text || !audioContextRef.current) {
      console.log("Audio playback skipped: No text or AudioContext not ready.");
      return;
    }

    // Ensure AudioContext is running (might require user gesture)
    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        console.log("AudioContext resumed successfully.");
      } catch (resumeError) {
        console.error("Error resuming AudioContext:", resumeError);
        setError("Audio playback requires user interaction. Please click or tap.");
        // Display a UI element asking user to click to enable audio?
        return;
      }
    }

    // Stop any currently playing audio
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore errors if node already stopped
      }
      sourceNodeRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`useAudioPlayer: Fetching audio for: "${text}"`);
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Decode the audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Create a new source node
      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContextRef.current.destination);
      
      // Play the audio
      sourceNode.start();
      
      // Store the source node to allow stopping it later
      sourceNodeRef.current = sourceNode;

      // Handle cleanup when audio finishes playing
      sourceNode.onended = () => {
        sourceNodeRef.current = null;
        // Optional: Add any logic needed after playback finishes
      };

    } catch (err: any) {
      console.error("Error in useAudioPlayer:", err);
      setError(err.message || "Failed to play audio");
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependencies: none, relies on refs

  return { playAudio, isLoading, error };
} 