'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAssessmentStore } from '@/store/assessmentStore';
import { Movement, Pose } from '@/store/types';
import { Layout, Button, Heading, Text, Card } from '@/components';
import PoseCapture from '@/components/PoseCapture';
import { TOTAL_QUESTIONNAIRE_PAGES, TOTAL_ASSESSMENT_STEPS } from '@/config/questionnaire';

// Define the sequence of movements
const movementSequence: Movement[] = [
  'static-standing', 
  'sit-to-stand', 
  'back-scratcher', 
  'tech-neck', 
  'hamstring-hinge'
];

const movementInstructions: Record<Movement, string> = {
  'static-standing': "Stand tall, feet shoulder-width apart, arms relaxed at your sides. Look straight ahead.",
  'sit-to-stand': "Start seated in a chair, feet flat on the floor. Stand up straight without using your hands, then sit back down.",
  'back-scratcher': "Reach one hand over your shoulder and the other up your back. Try to touch your fingertips together. Repeat on the other side.",
  'tech-neck': "Sit or stand tall. Gently tuck your chin towards your chest, then return to neutral.",
  'hamstring-hinge': "Stand with feet hip-width apart, knees slightly bent. Hinge at your hips, keeping your back straight, and reach towards your toes."
};

// --- Local Type Definition (TODO: Move PoseDataBundle to @/store/types and share) ---
export interface PoseFrameData {
    pose: Pose;
    image: string; // base64 data URL
}

export interface PoseDataBundle {
    [movementName: string]: {
        [keyFrameName: string]: PoseFrameData;
    };
}
// --- End Local Type Definition ---

export default function MobilityAssessmentPage() {
  const router = useRouter();
  const assessmentStore = useAssessmentStore();

  const currentStep = TOTAL_QUESTIONNAIRE_PAGES + 1;
  const totalSteps = TOTAL_QUESTIONNAIRE_PAGES + 1;

  const handleAssessmentComplete = (allPoseData: PoseDataBundle) => {
    console.log("Assessment complete. Received data:", allPoseData);
    router.push('/results');
  };

  const movementTitle = "Mobility Assessment";

  return (
    <Layout 
      showProgress 
      currentStep={currentStep} 
      totalSteps={totalSteps}
    >
       <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
        <Heading level={2} className="text-center">
          {movementTitle}
        </Heading>

        <PoseCapture 
           onAssessmentComplete={handleAssessmentComplete}
        />

      </div>
    </Layout>
  );
} 