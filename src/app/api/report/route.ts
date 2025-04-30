import { NextResponse } from 'next/server';
import { AssessmentState, Keypoint } from '@/store/types'; // Use @ alias

// Define the expected request body structure
interface ReportRequestBody {
  assessments: AssessmentState['questionnaireAnswers'];
  poses: AssessmentState['poseData'];
}

// Define the structure of the AI-generated report
export interface MobilityReport {
  keyLimitations: string[];
  riskLevel: 'Low' | 'Medium' | 'High' | 'Unknown';
  recommendedDrills: {
    name: string;
    description: string;
  }[];
  summary: string;
}

// Placeholder for the actual AI call
async function generateAiReport(data: ReportRequestBody): Promise<MobilityReport> {
  console.log("Received data for AI report generation:", JSON.stringify(data, null, 2));

  // --- Placeholder Logic --- 
  const keyLimitations: string[] = [];
  let risk: MobilityReport['riskLevel'] = 'Low';
  let summary = "Overall mobility appears good based on the provided data.";

  const techNeckPose = data.poses['tech-neck'];
  if (techNeckPose && techNeckPose.keypoints.length > 0) {
    const nose = techNeckPose.keypoints.find((kp: Keypoint) => kp.name === 'nose');
    const leftEar = techNeckPose.keypoints.find((kp: Keypoint) => kp.name === 'left_ear');
    const rightEar = techNeckPose.keypoints.find((kp: Keypoint) => kp.name === 'right_ear');
    // Very basic check: if nose is significantly lower than ears, flag potential issue
    if (nose && leftEar && nose.y > (leftEar.y + 20)) { // Threshold is arbitrary
        keyLimitations.push("Potential forward head posture (Tech Neck).");
        risk = 'Medium';
    }
  }
  
  // Example: Check Hamstring Hinge
  const toeTouchDifficulty = data.assessments[2]; 
  if (typeof toeTouchDifficulty === 'number' && toeTouchDifficulty >= 3) { 
      keyLimitations.push("Limited hamstring flexibility.");
      // Adjust risk based on severity? For now, just adding limitation.
      if (risk === 'Low') risk = 'Medium';
  }

  if (keyLimitations.length > 1) {
    risk = 'High';
    summary = "Several potential mobility limitations identified. Consider focusing on the recommended drills.";
  } else if (keyLimitations.length === 1) {
     summary = "One potential mobility limitation identified. Regular practice of recommended drills can help.";
  }

  const recommendedDrills = [
    { name: "Chin Tucks", description: "Gently tuck your chin towards your chest, creating a double chin. Hold for 5 seconds, repeat 10 times." },
    { name: "Cat-Cow Stretch", description: "Start on hands and knees. Inhale, arching your back (cow). Exhale, rounding your spine (cat). Repeat 10 times." },
    { name: "Standing Hamstring Stretch", description: "Place one heel on a low surface, keep leg straight. Gently lean forward from hips until you feel a stretch. Hold 30s per leg." },
  ];

  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1500)); 

  return {
    keyLimitations,
    riskLevel: risk,
    recommendedDrills,
    summary,
  };
  // --- End Placeholder Logic ---
}

export async function POST(request: Request) {
  try {
    const body: ReportRequestBody = await request.json();

    // Basic validation
    if (!body || !body.assessments || !body.poses) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Generate the report using the (placeholder) AI function
    const report = await generateAiReport(body);

    return NextResponse.json(report);

  } catch (error) {
    console.error("Error generating report:", error);
    // Check if the error is due to JSON parsing
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON format in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 