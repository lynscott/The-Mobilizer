import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Ensure you have your OpenAI API key set in environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not set.");
        return NextResponse.json({ error: 'Server configuration error: Missing API key' }, { status: 500 });
    }


    console.log(`API Route: Generating speech for text: "${text}"`);

    // Request speech synthesis from OpenAI
    // Model 'tts-1' is generally faster (lower latency) than 'tts-1-hd'
    // Voice 'alloy' is one of the available options. Others include echo, fable, onyx, nova, shimmer.
    const mp3Response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy", // Choose a voice
      input: text,
      response_format: "mp3", // Other options: opus, aac, flac
      // speed: 1.0 // Optional: Adjust speed (0.25 to 4.0)
    });

    // Check if the response is valid and contains audio data
    if (!mp3Response.ok) {
        const errorBody = await mp3Response.text();
        console.error("OpenAI API Error:", errorBody);
        return NextResponse.json({ error: `Failed to generate speech: ${mp3Response.statusText}` }, { status: mp3Response.status });
    }

    // Get the audio data as ArrayBuffer
    const arrayBuffer = await mp3Response.arrayBuffer();

    // Return the audio data directly
    return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
            'Content-Type': 'audio/mpeg', // Correct MIME type for MP3
        },
    });

  } catch (error: any) {
    console.error("Error in TTS API route:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || 'Unknown error'}` }, { status: 500 });
  }
} 