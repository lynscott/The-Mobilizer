import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
  PoseLandmarkerResult
} from "@mediapipe/tasks-vision";

console.log("Worker: Script loaded.");

// Define the structure of messages sent to/from the worker
interface WorkerRequest {
  type: "INIT" | "DETECT";
  modelAssetPath?: string;
  frame?: ImageBitmap; // Changed from HTMLVideoElement
  timestamp?: number;
}

interface WorkerResponse {
  type: "INITIALIZED" | "RESULT" | "ERROR";
  results?: PoseLandmarkerResult;
  latency?: number;
  message?: string;
}

let poseLandmarker: PoseLandmarker | null = null;
let lastProcessedTimestamp = -1;

const initialize = async (modelPath: string) => {
  try {
    console.log("Worker: Initializing MediaPipe Pose Landmarker...");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "GPU" // Use GPU if available
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false
    });
    console.log("Worker: Pose Landmarker initialized successfully.");
    self.postMessage({ type: "INITIALIZED" } as WorkerResponse);
  } catch (error: any) {
    console.error("Worker: Initialization failed:", error);
    self.postMessage({ type: "ERROR", message: error.message } as WorkerResponse);
  }
};

const detect = async (frameBitmap: ImageBitmap, timestamp: number) => { // Changed parameter name and type
  if (!poseLandmarker || timestamp <= lastProcessedTimestamp) {
    frameBitmap.close(); // Close the bitmap if we skip processing
    return; 
  }

  const startTime = performance.now();
  try {
    // Pass the ImageBitmap directly
    const results = await poseLandmarker.detectForVideo(frameBitmap, timestamp); 
    lastProcessedTimestamp = timestamp;
    const latency = performance.now() - startTime;
    self.postMessage({ type: "RESULT", results, latency } as WorkerResponse);
  } catch (error: any) {
    console.error("Worker: Detection failed:", error);
    self.postMessage({ type: "ERROR", message: `Detection failed: ${error.message}` } as WorkerResponse);
  } finally {
     // IMPORTANT: Close the ImageBitmap in the worker once processing is done
     // or if an error occurred during detection itself.
     // If postMessage fails, this might not be reached, but it covers most cases.
     frameBitmap.close(); 
  }
};

// Listen for messages from the main thread
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  console.log("Worker: Received message from main thread:", event.data);
  const { type, modelAssetPath, frame, timestamp } = event.data;

  if (type === "INIT" && modelAssetPath) {
    console.log("Worker: INIT message received. Calling initialize...");
    await initialize(modelAssetPath);
  } else if (type === "DETECT" && frame && timestamp) {
    await detect(frame, timestamp); // Pass the received frame (which is now an ImageBitmap)
  } else {
    console.warn("Worker: Received unknown message type or missing data", event.data);
  }
}; 