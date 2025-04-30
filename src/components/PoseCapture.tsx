'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Button from './Button';
import { Text } from './Typography';
import { Pose, Keypoint as AppKeypoint } from '@/store/types';
import { PoseLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { SpeakerLoudIcon, SpeakerOffIcon } from '@radix-ui/react-icons';

// --- Local Type Definition (TODO: Move PoseDataBundle to @/store/types) ---
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

// --- Audio Prompts Map ---
const audioPrompts: Record<string, Record<string, string>> = {
    initial: {
        welcome: "Welcome to the Mobilizer assessment. Please stand facing the camera."
    },
    static_standing: {
        standing_front: "Hold this pose. Standing, facing front.",
        standing_side: "Now, turn 90 degrees to your right and hold.",
    },
    sit_to_stand: {
        seated_start: "Please sit comfortably in a chair, feet flat.",
        mid_point: "", // No specific audio for mid-point usually
        standing_peak: "Stand up straight and hold.",
    },
    back_scratcher: {
        right_arm_reach: "Reach your right hand down your back, left hand up. Hold the pose.",
        left_arm_reach: "Now switch. Reach your left hand down, right hand up. Hold the pose.",
    },
    tech_neck: {
        neck_neutral: "Look straight ahead, relax your shoulders.",
        neck_flexion: "Gently tuck your chin towards your chest and hold.",
    },
    hamstring_hinge: {
        hinge_start: "Stand tall, feet hip-width apart.",
        hinge_peak: "Keeping your back straight, hinge at your hips and reach down. Hold the position.",
    },
    final: {
        complete: "Assessment complete. Thank you."
    }
};

// --- Configuration for Auto-Capture ---
type KeyFrameName = string;
type MovementName = string;

interface KeyFrameDefinition {
    name: KeyFrameName;
    checkFunction: (landmarks: NormalizedLandmark[]) => boolean; // Placeholder for analysis logic
    delaySeconds: number; // Delay after condition met before capture
}

interface MovementDefinition {
    name: MovementName;
    keyFrames: KeyFrameDefinition[];
}

// Define the sequence and checks (using placeholders for now)
const MOVEMENTS_TO_CAPTURE: MovementDefinition[] = [
    {
        name: "static_standing",
        keyFrames: [
            { name: "standing_front", checkFunction: (lm) => checkStandingFront(lm), delaySeconds: 1 },
            { name: "standing_side", checkFunction: (lm) => checkStandingSide(lm), delaySeconds: 1 },
        ]
    },
    {
        name: "sit_to_stand",
        keyFrames: [
            { name: "seated_start", checkFunction: (lm) => checkSeatedStart(lm), delaySeconds: 1 },
            { name: "mid_point", checkFunction: (lm) => checkSitStandMid(lm), delaySeconds: 0 }, // Capture immediately
            { name: "standing_peak", checkFunction: (lm) => checkStandingPeak(lm), delaySeconds: 0.5 },
        ]
    },
    {
        name: "back_scratcher",
        keyFrames: [
            { name: "right_arm_reach", checkFunction: (lm) => checkBackScratcherRight(lm), delaySeconds: 1 },
            { name: "left_arm_reach", checkFunction: (lm) => checkBackScratcherLeft(lm), delaySeconds: 1 },
        ]
    },
    {
        name: "tech_neck",
        keyFrames: [
            { name: "neck_neutral", checkFunction: (lm) => checkNeckNeutral(lm), delaySeconds: 1 },
            { name: "neck_flexion", checkFunction: (lm) => checkNeckFlexion(lm), delaySeconds: 0.5 },
        ]
    },
    {
        name: "hamstring_hinge",
        keyFrames: [
            { name: "hinge_start", checkFunction: (lm) => checkHingeStart(lm), delaySeconds: 1 },
            { name: "hinge_peak", checkFunction: (lm) => checkHingePeak(lm), delaySeconds: 0.5 },
        ]
    },
];

// --- Pose Analysis Constants ---
const STABILITY_THRESHOLD = 0.01; // Max average normalized displacement between frames
const LEVEL_TOLERANCE_Y = 0.05; // Max normalized Y difference for shoulders/hips to be level
const VERTICAL_ALIGNMENT_TOLERANCE_X = 0.1; // Max normalized X difference for vertical alignment
const ANGLE_STRAIGHT_TOLERANCE_DEG = 20; // Max deviation from 180 degrees for straight lines
const SIDE_VIEW_Z_THRESHOLD = 0.1; // Min normalized Z difference for side view detection
const KNEE_ANGLE_THRESHOLD_DEG = 20; // Tolerance for 90 or 180 degree knee angles
const HIP_KNEE_LEVEL_TOLERANCE_Y = 0.1; // Max normalized Y diff for hips/knees to be level (mid-stand)
const UPRIGHT_TORSO_ANGLE_THRESHOLD_DEG = 150; // Minimum angle for torso considered upright
const BACKSCRATCHER_ELBOW_ACUTE_DEG = 100; // Max angle for the reaching elbow (generous)
const BACKSCRATCHER_ELBOW_OBTUSE_DEG = 120; // Min angle for the other elbow
const NECK_NEUTRAL_OFFSET_TOLERANCE = 0.05; // Max normalized horizontal ear/shoulder offset for neutral
const NECK_FLEXION_Y_THRESHOLD = 0.05; // Min normalized Y distance nose must be below shoulders for flexion
const KNEE_STRAIGHT_HINGE_THRESHOLD_DEG = 150; // Min angle for knees to be considered straight during hinge
const HIP_HINGE_THRESHOLD_DEG = 120; // Max hip angle (Shoulder-Hip-Knee) to be considered hinged

// --- Pose Analysis Helper Functions ---

// Helper to check if a landmark is visible
const isVisible = (lm: NormalizedLandmark | undefined): lm is NormalizedLandmark => {
    return !!lm && (lm.visibility ?? 0) > MIN_VISIBILITY;
};

// Helper to get average point from two landmarks
const getAveragePoint = (p1: NormalizedLandmark, p2: NormalizedLandmark): NormalizedLandmark | null => {
    if (!isVisible(p1) || !isVisible(p2)) return null;
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2,
        visibility: (p1.visibility! + p2.visibility!) / 2 // Assert non-null with !
    };
}

// Stability Check (Requires storing previous landmarks)
const previousLandmarksRef = React.createRef<NormalizedLandmark[] | null>(); // Use createRef outside component for static ref
const isStable = (currentLandmarks: NormalizedLandmark[]): boolean => {
    const prevLandmarks = previousLandmarksRef.current;
    if (!prevLandmarks || prevLandmarks.length !== currentLandmarks.length) {
        previousLandmarksRef.current = currentLandmarks; // Store first frame
        // console.log('Stability: Storing first frame');
        return false; // Not stable on first frame or if lengths differ
    }

    const keyIndices = [7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]; // Ears, Shoulders, Elbows, Wrists, Hips, Knees, Ankles
    let totalDisplacement = 0;
    let visibleCount = 0;

    for (const i of keyIndices) {
        const current = currentLandmarks[i];
        const prev = prevLandmarks[i];
        if (isVisible(current) && isVisible(prev)) {
            const dx = current.x - prev.x;
            const dy = current.y - prev.y;
            // Optional: include dz if Z is reliable enough
            // const dz = (current.z ?? 0) - (prev.z ?? 0);
            totalDisplacement += Math.sqrt(dx*dx + dy*dy /* + dz*dz */);
            visibleCount++;
        }
    }

    // Update previous landmarks for the next frame
    previousLandmarksRef.current = currentLandmarks;

    if (visibleCount < keyIndices.length / 2) { // Require at least half the points visible
        // console.log('Stability: Not enough visible points', visibleCount);
        return false;
    }

    const avgDisplacement = totalDisplacement / visibleCount;
    const stable = avgDisplacement < STABILITY_THRESHOLD;
    // if (!stable) console.log('Stability Check: Unstable', avgDisplacement.toFixed(4));
    // else console.log('Stability Check: Stable', avgDisplacement.toFixed(4));
    return stable;
};

// Check: Standing Front
const checkStandingFront = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // Visibility Checks
    if (![leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftEar, rightEar].every(isVisible)) {
        return false;
    }

    // 1. Level Shoulders & Hips
    const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y) < LEVEL_TOLERANCE_Y;
    const hipLevel = Math.abs(leftHip.y - rightHip.y) < LEVEL_TOLERANCE_Y;

    // 2. Vertical Alignment (X-coordinates)
    const shoulderHipAlign = Math.abs(((leftShoulder.x + rightShoulder.x)/2) - ((leftHip.x + rightHip.x)/2)) < VERTICAL_ALIGNMENT_TOLERANCE_X;
    const kneeAnkleAlign = Math.abs(((leftKnee.x + rightKnee.x)/2) - ((leftAnkle.x + rightAnkle.x)/2)) < VERTICAL_ALIGNMENT_TOLERANCE_X;
    // Optionally add Hip-Knee alignment

    // 3. Ear-Shoulder-Hip Angle (Approx. Straight)
    const avgEar = getAveragePoint(leftEar, rightEar);
    const avgShoulder = getAveragePoint(leftShoulder, rightShoulder);
    const avgHip = getAveragePoint(leftHip, rightHip);
    let bodyAngleStraight = false;
    if (avgEar && avgShoulder && avgHip) {
        const angle = calculateAngle(avgEar, avgShoulder, avgHip);
        bodyAngleStraight = angle !== null && Math.abs(angle - 180) < ANGLE_STRAIGHT_TOLERANCE_DEG;
    }

    const result = shoulderLevel && hipLevel && shoulderHipAlign && kneeAnkleAlign && bodyAngleStraight;
    // console.log(`Check StandingFront: ${result}`, { shoulderLevel, hipLevel, shoulderHipAlign, kneeAnkleAlign, bodyAngleStraight });
    return result;
};

// Check: Standing Side
const checkStandingSide = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    // Need at least one side visible + ears
    const visibleSide = (isVisible(leftShoulder) && isVisible(leftHip)) || (isVisible(rightShoulder) && isVisible(rightHip));
    const earsVisible = isVisible(leftEar) || isVisible(rightEar); // Allow one ear for side view
    if (!visibleSide || !earsVisible) {
         return false;
    }

    // 1. Z-Difference (Profile View Check) - Use normalized Z for now
    const shoulderZDiff = Math.abs((leftShoulder?.z ?? 0) - (rightShoulder?.z ?? 0));
    const hipZDiff = Math.abs((leftHip?.z ?? 0) - (rightHip?.z ?? 0));
    // Only check if both points of the pair are visible enough for a meaningful difference
    const shouldersComparable = isVisible(leftShoulder) && isVisible(rightShoulder);
    const hipsComparable = isVisible(leftHip) && isVisible(rightHip);
    const isSideView = (shouldersComparable && shoulderZDiff > SIDE_VIEW_Z_THRESHOLD) || (hipsComparable && hipZDiff > SIDE_VIEW_Z_THRESHOLD);

    // 2. Ear-Shoulder-Hip Angle (Approx. Straight) - Use points from the *most visible* side if possible
    // Simplified: Use averages if both visible, otherwise pick one visible side
    let bodyAngleStraight = false;
    const avgEar = getAveragePoint(leftEar, rightEar);
    const avgShoulder = getAveragePoint(leftShoulder, rightShoulder);
    const avgHip = getAveragePoint(leftHip, rightHip);

    // Prefer average if points are reasonably visible
    if (avgEar && avgShoulder && avgHip && isVisible(avgEar) && isVisible(avgShoulder) && isVisible(avgHip)) {
        const angle = calculateAngle(avgEar, avgShoulder, avgHip);
        bodyAngleStraight = angle !== null && Math.abs(angle - 180) < ANGLE_STRAIGHT_TOLERANCE_DEG;
    } else {
        // Fallback: try one side if the other isn't visible enough
        const sidePoints = isVisible(leftShoulder) ? [leftEar, leftShoulder, leftHip] : [rightEar, rightShoulder, rightHip];
        if (sidePoints.every(isVisible)) {
             const angle = calculateAngle(sidePoints[0], sidePoints[1], sidePoints[2]);
             bodyAngleStraight = angle !== null && Math.abs(angle - 180) < ANGLE_STRAIGHT_TOLERANCE_DEG;
        }
    }

    const result = isSideView && bodyAngleStraight;
    // console.log(`Check StandingSide: ${result}`, { isSideView, bodyAngleStraight });
    return result;
};

// Check: Seated Start
const checkSeatedStart = (landmarks: NormalizedLandmark[]): boolean => {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];

    if (![leftHip, rightHip, leftKnee, rightKnee, leftShoulder, rightShoulder].every(isVisible)) {
        return false;
    }

    // 1. Hips significantly lower than knees
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
    const hipsLowerThanKnees = avgHipY > avgKneeY + HIP_KNEE_LEVEL_TOLERANCE_Y; // Y increases downwards

    // 2. Shoulders higher than hips (basic check against slumping)
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const shouldersHigherThanHips = avgShoulderY < avgHipY;

    // 3. Knee angles roughly 90 degrees
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, landmarks[27]); // landmarks[27] = leftAnkle
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, landmarks[28]); // landmarks[28] = rightAnkle
    const kneesBent = (leftKneeAngle !== null && Math.abs(leftKneeAngle - 90) < KNEE_ANGLE_THRESHOLD_DEG * 2) || // Wider tolerance for seated
                      (rightKneeAngle !== null && Math.abs(rightKneeAngle - 90) < KNEE_ANGLE_THRESHOLD_DEG * 2);

    const result = hipsLowerThanKnees && shouldersHigherThanHips && kneesBent;
    // console.log(`Check SeatedStart: ${result}`, { hipsLowerThanKnees, shouldersHigherThanHips, kneesBent, leftKneeAngle, rightKneeAngle });
    return result;
};

// Check: Sit-to-Stand Mid-Point
const checkSitStandMid = (landmarks: NormalizedLandmark[]): boolean => {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    if (![leftHip, rightHip, leftKnee, rightKnee, leftShoulder, rightShoulder, leftEar, rightEar].every(isVisible)) {
        return false;
    }

    // 1. Hips roughly level with knees
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
    const hipsLevelWithKnees = Math.abs(avgHipY - avgKneeY) < HIP_KNEE_LEVEL_TOLERANCE_Y;

    // 2. Torso relatively upright
    const avgEar = getAveragePoint(leftEar, rightEar);
    const avgShoulder = getAveragePoint(leftShoulder, rightShoulder);
    const avgHip = getAveragePoint(leftHip, rightHip);
    let torsoUpright = false;
    if (avgEar && avgShoulder && avgHip) {
        const torsoAngle = calculateAngle(avgEar, avgShoulder, avgHip);
        torsoUpright = torsoAngle !== null && torsoAngle > UPRIGHT_TORSO_ANGLE_THRESHOLD_DEG;
    }

    // Note: We don't explicitly check for *active movement* here, assuming state machine handles transition
    const result = hipsLevelWithKnees && torsoUpright;
    // console.log(`Check SitStandMid: ${result}`, { hipsLevelWithKnees, torsoUpright });
    return result;
};

// Check: Standing Peak (after Sit-to-Stand)
const checkStandingPeak = (landmarks: NormalizedLandmark[]): boolean => {
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    if (![leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftShoulder, rightShoulder, leftEar, rightEar].every(isVisible)) {
        return false;
    }

    // 1. Hips significantly higher than knees
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
    const hipsHigherThanKnees = avgHipY < avgKneeY - HIP_KNEE_LEVEL_TOLERANCE_Y; // Y increases downwards

    // 2. Knees near straight
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const kneesStraight = (leftKneeAngle !== null && Math.abs(leftKneeAngle - 180) < KNEE_ANGLE_THRESHOLD_DEG) ||
                        (rightKneeAngle !== null && Math.abs(rightKneeAngle - 180) < KNEE_ANGLE_THRESHOLD_DEG);

    // 3. Ear-Shoulder-Hip Angle (Approx. Straight)
    const avgEar = getAveragePoint(leftEar, rightEar);
    const avgShoulder = getAveragePoint(leftShoulder, rightShoulder);
    const avgHip = getAveragePoint(leftHip, rightHip);
    let bodyAngleStraight = false;
    if (avgEar && avgShoulder && avgHip) {
        const angle = calculateAngle(avgEar, avgShoulder, avgHip);
        bodyAngleStraight = angle !== null && Math.abs(angle - 180) < ANGLE_STRAIGHT_TOLERANCE_DEG;
    }

    const result = hipsHigherThanKnees && kneesStraight && bodyAngleStraight;
    // console.log(`Check StandingPeak: ${result}`, { hipsHigherThanKnees, kneesStraight, bodyAngleStraight, leftKneeAngle, rightKneeAngle });
    return result;
};

// Check: Back Scratcher - Right Arm Reach
const checkBackScratcherRight = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (![leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist].every(isVisible)) {
        return false;
    }

    // 1. Right elbow angle is acute (reaching down back)
    const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const rightElbowAcute = rightElbowAngle !== null && rightElbowAngle < BACKSCRATCHER_ELBOW_ACUTE_DEG;

    // 2. Right wrist Y is relatively high (above elbow, hand going down)
    // Remember Y increases downwards
    const rightWristHigh = rightWrist.y < rightElbow.y; 

    // 3. Left elbow angle is obtuse (reaching up back)
    const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const leftElbowObtuse = leftElbowAngle !== null && leftElbowAngle > BACKSCRATCHER_ELBOW_OBTUSE_DEG;

    // 4. Left wrist Y is relatively low (below elbow, hand going up)
    const leftWristLow = leftWrist.y > leftElbow.y;

    const result = rightElbowAcute && rightWristHigh && leftElbowObtuse && leftWristLow;
    // console.log(`Check BackScratcherRight: ${result}`, { rightElbowAngle, rightWristHigh, leftElbowAngle, leftWristLow });
    return result;
};

// Check: Back Scratcher - Left Arm Reach
const checkBackScratcherLeft = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (![leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist].every(isVisible)) {
        return false;
    }

    // 1. Left elbow angle is acute (reaching down back)
    const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const leftElbowAcute = leftElbowAngle !== null && leftElbowAngle < BACKSCRATCHER_ELBOW_ACUTE_DEG;

    // 2. Left wrist Y is relatively high (above elbow, hand going down)
    const leftWristHigh = leftWrist.y < leftElbow.y; 

    // 3. Right elbow angle is obtuse (reaching up back)
    const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
    const rightElbowObtuse = rightElbowAngle !== null && rightElbowAngle > BACKSCRATCHER_ELBOW_OBTUSE_DEG;

    // 4. Right wrist Y is relatively low (below elbow, hand going up)
    const rightWristLow = rightWrist.y > rightElbow.y;

    const result = leftElbowAcute && leftWristHigh && rightElbowObtuse && rightWristLow;
    // console.log(`Check BackScratcherLeft: ${result}`, { leftElbowAngle, leftWristHigh, rightElbowAngle, rightWristLow });
    return result;
};

// Check: Neck Neutral
const checkNeckNeutral = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    if (!isVisible(leftShoulder) || !isVisible(rightShoulder) || !isVisible(leftEar) || !isVisible(rightEar)) {
        return false;
    }

    // Calculate horizontal offset (similar to drawNeckLineAnalysis but using normalized coordinates)
    const shoulderAvgX = (leftShoulder.x + rightShoulder.x) / 2;
    const earAvgX = (leftEar.x + rightEar.x) / 2;
    const horizontalOffsetNormalized = earAvgX - shoulderAvgX;

    const isNeutral = Math.abs(horizontalOffsetNormalized) < NECK_NEUTRAL_OFFSET_TOLERANCE;

    // console.log(`Check NeckNeutral: ${isNeutral}`, { horizontalOffsetNormalized });
    return isNeutral;
};

// Check: Neck Flexion
const checkNeckFlexion = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const nose = landmarks[0];

    if (!isVisible(leftShoulder) || !isVisible(rightShoulder) || !isVisible(nose)) {
        return false;
    }

    // Check if nose is significantly lower than the average shoulder height
    const shoulderAvgY = (leftShoulder.y + rightShoulder.y) / 2;
    const isFlexed = nose.y > shoulderAvgY + NECK_FLEXION_Y_THRESHOLD; // Y increases downwards

    // Note: This detects *if* flexed, not necessarily *peak* flexion.
    // Peak detection might require tracking the minimum nose.y over time in the main loop.
    // console.log(`Check NeckFlexion: ${isFlexed}`, { noseY: nose.y, shoulderAvgY });
    return isFlexed;
};

// Check: Hinge Start
const checkHingeStart = (landmarks: NormalizedLandmark[]): boolean => {
    // Hinge start is just a stable standing front pose
    const isStanding = checkStandingFront(landmarks);
    // console.log(`Check HingeStart: ${isStanding}`);
    return isStanding;
};

// Check: Hinge Peak
const checkHingePeak = (landmarks: NormalizedLandmark[]): boolean => {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    // Need shoulders, hips, knees, ankles, wrists visible
    if (![leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftWrist, rightWrist].every(isVisible)) {
        return false;
    }

    // 1. Knees remain relatively straight
    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const kneesStraight = (leftKneeAngle !== null && leftKneeAngle > KNEE_STRAIGHT_HINGE_THRESHOLD_DEG) ||
                        (rightKneeAngle !== null && rightKneeAngle > KNEE_STRAIGHT_HINGE_THRESHOLD_DEG);

    // 2. Significant hip hinge (angle is acute)
    const leftHipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightHipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
    const hipsHinged = (leftHipAngle !== null && leftHipAngle < HIP_HINGE_THRESHOLD_DEG) ||
                     (rightHipAngle !== null && rightHipAngle < HIP_HINGE_THRESHOLD_DEG);

    // 3. Wrists are low (indicating reaching down)
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const wristsLow = (leftWrist.y > avgHipY) || (rightWrist.y > avgHipY); // Check if either wrist is below hip level

    // Note: Similar to neck flexion, this checks for *a hinged state*, not necessarily the absolute peak.
    // Peak detection would require tracking min hip angle / min wrist Y.
    const result = kneesStraight && hipsHinged && wristsLow;
    // console.log(`Check HingePeak: ${result}`, { kneesStraight, hipsHinged, wristsLow, leftHipAngle, rightHipAngle });
    return result;
};

// --- Component Props Update ---
interface PoseCaptureProps {
  onAssessmentComplete: (allPoseData: PoseDataBundle) => void; // Callback when all captures are done
}

// --- Constants ---
const MIN_VISIBILITY = 0.5; // Minimum visibility threshold for keypoints

// --- Helper Functions ---

// Utility to calculate angle between three points (p1-p2-p3, angle at p2)
const calculateAngle = (p1: NormalizedLandmark, p2: NormalizedLandmark, p3: NormalizedLandmark): number | null => {
  // Check visibility first
  if (
    !p1 || !p2 || !p3 ||
    (p1.visibility ?? 0) < MIN_VISIBILITY ||
    (p2.visibility ?? 0) < MIN_VISIBILITY ||
    (p3.visibility ?? 0) < MIN_VISIBILITY
  ) {
    return null; // Not enough visible points
  }

  // Calculate vectors
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  // Calculate dot product
  const dotProduct = v1.x * v2.x + v1.y * v2.y;

  // Calculate magnitudes
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

  // Check for zero magnitude to avoid division by zero
  if (mag1 === 0 || mag2 === 0) {
    return null;
  }

  // Calculate cosine of the angle
  let cosTheta = dotProduct / (mag1 * mag2);

  // Clamp the value to [-1, 1] to avoid floating point errors with acos
  cosTheta = Math.max(-1, Math.min(1, cosTheta));

  // Calculate angle in radians and convert to degrees
  const angleRad = Math.acos(cosTheta);
  const angleDeg = angleRad * (180 / Math.PI);

  return angleDeg;
};


// Utility to draw calculated angles on the canvas
const drawAngles = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D) => {
  // Define the joint triplets [point1_idx, vertex_idx, point3_idx]
  const angleDefinitions = [
    // Left Arm
    { indices: [11, 13, 15], name: 'L Elbow' }, // L Shoulder, L Elbow, L Wrist
    { indices: [23, 11, 13], name: 'L Shoulder' }, // L Hip, L Shoulder, L Elbow
    // Right Arm
    { indices: [12, 14, 16], name: 'R Elbow' }, // R Shoulder, R Elbow, R Wrist
    { indices: [24, 12, 14], name: 'R Shoulder' }, // R Hip, R Shoulder, R Elbow
    // Left Leg
    { indices: [23, 25, 27], name: 'L Knee' }, // L Hip, L Knee, L Ankle
    { indices: [11, 23, 25], name: 'L Hip' }, // L Shoulder, L Hip, L Knee
    // Right Leg
    { indices: [24, 26, 28], name: 'R Knee' }, // R Hip, R Knee, R Ankle
    { indices: [12, 24, 26], name: 'R Hip' }, // R Shoulder, R Hip, R Knee
  ];

  ctx.fillStyle = '#FFFF00'; // Yellow color for angles
  ctx.font = '14px Inter, sans-serif'; // Set font style
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';


  angleDefinitions.forEach(({ indices }) => {
    const [idx1, idx2, idx3] = indices;
    const p1 = landmarks[idx1];
    const p2 = landmarks[idx2]; // Vertex where the angle is calculated
    const p3 = landmarks[idx3];

    const angle = calculateAngle(p1, p2, p3);

    if (angle !== null && p2) { // Ensure vertex exists
       const canvas = ctx.canvas;
       // Calculate position near the vertex (p2)
       const textX = p2.x * canvas.width;
       const textY = p2.y * canvas.height;

       // Draw the angle value
       ctx.fillText(`${angle.toFixed(0)}°`, textX + 10, textY - 10); // Offset slightly for visibility
    }
  });
};

// Utility to draw neck alignment lines
const drawNeckLineAnalysis = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D) => {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];
  const canvas = ctx.canvas;

  // Check visibility of key points
  const shouldersVisible = (leftShoulder?.visibility ?? 0) > MIN_VISIBILITY && (rightShoulder?.visibility ?? 0) > MIN_VISIBILITY;
  const earsVisible = (leftEar?.visibility ?? 0) > MIN_VISIBILITY && (rightEar?.visibility ?? 0) > MIN_VISIBILITY;

  if (!shouldersVisible || !earsVisible) {
    return; // Don't draw if key points aren't visible
  }

  // Calculate average X position for shoulders and ears in canvas coordinates
  const shoulderAvgX = ((leftShoulder.x + rightShoulder.x) / 2) * canvas.width;
  const shoulderAvgY = ((leftShoulder.y + rightShoulder.y) / 2) * canvas.height; // Use Y for line start
  const earAvgX = ((leftEar.x + rightEar.x) / 2) * canvas.width;
  const earAvgY = ((leftEar.y + rightEar.y) / 2) * canvas.height; // Use Y for line start

  // Draw vertical line from average shoulder position
  ctx.beginPath();
  ctx.strokeStyle = '#00FF00'; // Green for shoulders (good alignment)
  ctx.lineWidth = 2;
  ctx.moveTo(shoulderAvgX, shoulderAvgY); // Start near the shoulder midpoint
  ctx.lineTo(shoulderAvgX, canvas.height); // Draw down to bottom
  ctx.stroke();

  // Draw vertical line from average ear position
  ctx.beginPath();
  ctx.strokeStyle = '#FF00FF'; // Magenta for ears (head position)
  ctx.lineWidth = 2;
  ctx.moveTo(earAvgX, earAvgY); // Start near the ear midpoint
  ctx.lineTo(earAvgX, canvas.height); // Draw down to bottom
  ctx.stroke();

  // Optional: Calculate and display the horizontal offset
  // Note: In the flipped canvas context, a LARGER ear X means it's further FORWARD
  const horizontalOffsetPixels = earAvgX - shoulderAvgX;
  const horizontalOffsetNormalized = horizontalOffsetPixels / canvas.width;

  ctx.fillStyle = '#FFFFFF'; // White text
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Head Offset: ${horizontalOffsetNormalized.toFixed(2)}`, canvas.width - 10, 20);
};

// --- Define connections for MediaPipe Pose ---
// (Based on https://developers.google.com/mediapipe/solutions/vision/pose_landmarker#pose_connections)
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27],
  // Right leg
  [24, 26], [26, 28],
  // Face (simplified)
  [0, 1], [0, 4], [1, 2], [2, 3], [4, 5], [5, 6], [9, 10]
];

// Utility to draw keypoints (Modified for PoseLandmarkerResult)
const drawKeypoints = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D, scale = 1) => { // Use NormalizedLandmark type
  ctx.fillStyle = '#E50914'; // Accent color
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;

  for (const landmark of landmarks) {
    // PoseLandmarker uses visibility instead of score
    if (landmark.visibility && landmark.visibility > MIN_VISIBILITY) { // Use MIN_VISIBILITY constant
      const { x, y } = landmark;
      // Coordinates are already normalized (0.0 - 1.0)
      ctx.beginPath();
      ctx.arc(x * ctx.canvas.width, y * ctx.canvas.height, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
};

// Utility to draw skeleton (Modified for PoseLandmarkerResult)
const drawSkeleton = (landmarks: NormalizedLandmark[], ctx: CanvasRenderingContext2D, scale = 1) => { // Use NormalizedLandmark type
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;

  POSE_CONNECTIONS.forEach(([i, j]) => {
    const kp1 = landmarks[i];
    const kp2 = landmarks[j];

    // Check visibility for both landmarks
    if (kp1 && kp2 && kp1.visibility && kp2.visibility && kp1.visibility > MIN_VISIBILITY && kp2.visibility > MIN_VISIBILITY) {
       // Coordinates are already normalized (0.0 - 1.0)
      ctx.beginPath();
      ctx.moveTo(kp1.x * ctx.canvas.width, kp1.y * ctx.canvas.height);
      ctx.lineTo(kp2.x * ctx.canvas.width, kp2.y * ctx.canvas.height);
      ctx.stroke();
    }
  });
};

// Keypoint names mapping (adjust if your PoseLandmark type uses names)
const KEYPOINT_NAMES = [
    'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer', 'right_eye_inner',
    'right_eye', 'right_eye_outer', 'left_ear', 'right_ear', 'mouth_left',
    'mouth_right', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist', 'left_pinky', 'right_pinky', 'left_index',
    'right_index', 'left_thumb', 'right_thumb', 'left_hip', 'right_hip',
    'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_heel',
    'right_heel', 'left_foot_index', 'right_foot_index'
];


// --- Main Component ---
export default function PoseCapture({
  onAssessmentComplete // Use the new prop
}: PoseCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const [isWorkerInitialized, setIsWorkerInitialized] = useState(false);
  const [isWebcamReady, setIsWebcamReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDetectedPoseResult, setLastDetectedPoseResult] = useState<PoseLandmarkerResult | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref for capture delay timeout
  const internalPreviousLandmarksRef = useRef<NormalizedLandmark[] | null>(null); // Component instance ref

  // --- Audio State & Hook ---
  const { playAudio, isLoading: isAudioLoading, error: audioError } = useAudioPlayer();
  const [isMuted, setIsMuted] = useState(false);
  const playedInitialAudioRef = useRef(false); // Ensure welcome audio plays only once

  // --- Auto-Capture State ---
  const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
  const [currentKeyFrameIndex, setCurrentKeyFrameIndex] = useState(0);
  const [capturedPosesData, setCapturedPosesData] = useState<PoseDataBundle>({});
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'analyzing' | 'stabilizing' | 'condition_met' | 'delaying' | 'capturing' | 'captured' | 'failed' | 'complete'>('idle');
  const isCapturingProcessActive = useRef(false); // Prevent overlapping captures

  // Derived state for current target
  const currentMovement = MOVEMENTS_TO_CAPTURE[currentMovementIndex];
  const currentKeyFrame = currentMovement?.keyFrames[currentKeyFrameIndex];

  // Initialize Web Worker
  useEffect(() => {
    setIsLoading(true);
    // Ensure the path to the worker is correct relative to where this component is used
    workerRef.current = new Worker(new URL('../workers/pose.worker.ts', import.meta.url));

    // Construct the absolute path for the model
    const modelName = 'pose_landmarker_lite.task'; // Or your chosen model
    const absoluteModelPath = `${window.location.origin}/models/${modelName}`;

    // Send initialization message to worker with the absolute path
    workerRef.current.postMessage({ 
      type: "INIT",
      modelAssetPath: absoluteModelPath
    });

    const handleWorkerMessage = (event: MessageEvent) => {
      console.log("PoseCapture component received message from worker:", event.data);
      const { type, results, latency } = event.data;
      if (type === "INITIALIZED") {
        setIsWorkerInitialized(true);
        console.log("PoseCapture component: Worker is initialized (state set).");
      } else if (type === "RESULT") {
        setLastDetectedPoseResult(results);
      }
    };

    const handleWorkerError = (event: ErrorEvent) => {
      console.error("Error from pose worker:", event.message);
      setError(`Pose worker error: ${event.message}`);
      setIsLoading(false);
    };

    workerRef.current.onmessage = handleWorkerMessage;
    workerRef.current.onerror = handleWorkerError;

    // Cleanup
    return () => {
      console.log("Terminating pose worker.");
      workerRef.current?.terminate();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
       if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Worker initialization useEffect


  // Setup Webcam - Now triggered by a separate useEffect hook
  const setupWebcam = useCallback(async () => {
    console.log("Setting up webcam (triggered by worker initialization)...");
    try {
        // 1. Enumerate devices first
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
        console.log("Devices:", devices);

        if (videoInputDevices.length === 0) {
            console.error("No video input devices found.", videoInputDevices);
            setError("No camera found or accessible. Please ensure a webcam is connected and permissions are granted.");
            setIsLoading(false);
            return;
        }

        console.log("Available video devices:", videoInputDevices);
        // Use the first available video device by default
        const firstDeviceId = videoInputDevices[0].deviceId;

        // 2. Request stream using the first device (or default if deviceId fails)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            deviceId: firstDeviceId ? { exact: firstDeviceId } : undefined, // Try specific device
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            // Removed facingMode: 'user' to be more generic, deviceId is preferred
          }, 
          audio: false 
        });

      // 3. Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsWebcamReady(true);
          setIsLoading(false); // Stop loading only when webcam is ready
          console.log('Webcam ready.');
        };
      }
    } catch (err: any) { // Catch specific errors if needed
      console.error("Error accessing webcam:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
         setError("Camera permission denied. Please grant camera permissions in your browser settings.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
         setError("No camera found. Please ensure a webcam is connected.");
      } else {
         setError(`Failed to access webcam: ${err.message}`);
      }
      setIsLoading(false); // Stop loading on error
    }
  }, []); // Remove isWorkerInitialized from dependencies here, it's handled by the trigger effect

  // New useEffect to trigger webcam setup when worker is initialized
  useEffect(() => {
    if (isWorkerInitialized) {
        console.log("PoseCapture component: Worker initialized state detected, calling setupWebcam.");
      setupWebcam();
    }
  }, [isWorkerInitialized, setupWebcam]); // Depends on state and the callback itself


  // --- Core Auto-Capture Logic within predictWebcam ---
  const predictWebcam = useCallback(async () => {
    // Basic checks and setup
    if (!isWebcamReady || !workerRef.current || !videoRef.current || !canvasRef.current || videoRef.current.readyState < 3 || captureStatus === 'complete') {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animationFrameId.current = requestAnimationFrame(predictWebcam);
      return;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // Send frame to worker
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const videoTimestampMs = Math.round(video.currentTime * 1000);
      try {
        const imageBitmap = await createImageBitmap(video);
        workerRef.current.postMessage({ type: "DETECT", frame: imageBitmap, timestamp: videoTimestampMs }, [imageBitmap]);
      } catch (error) {
        console.error("Error creating ImageBitmap:", error);
      }
    }

    // Drawing logic (remains the same, happens every frame)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1); // Flip horizontally
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    let currentLandmarks: NormalizedLandmark[] | null = null;
    if (lastDetectedPoseResult && lastDetectedPoseResult.landmarks && lastDetectedPoseResult.landmarks.length > 0) {
      currentLandmarks = lastDetectedPoseResult.landmarks[0];
      drawKeypoints(currentLandmarks, ctx);
      drawSkeleton(currentLandmarks, ctx);
      drawAngles(currentLandmarks, ctx);
      drawNeckLineAnalysis(currentLandmarks, ctx);
    }
    ctx.restore();

    // --- Auto-Capture Analysis --- Trigger only if landmarks detected and not already capturing/delaying
    if (currentLandmarks && currentKeyFrame && !isCapturingProcessActive.current && captureStatus !== 'delaying' && captureStatus !== 'capturing') {
        setCaptureStatus('analyzing');

        // Perform Stability Check
        const stable = isStable(currentLandmarks);

        if (stable) {
            setCaptureStatus('stabilizing'); // Indicate stability met
            const conditionMet = currentKeyFrame.checkFunction(currentLandmarks);

            if (conditionMet) {
                setCaptureStatus('condition_met');
                isCapturingProcessActive.current = true; // Lock capture process

                console.log(`Condition MET for ${currentMovement.name} - ${currentKeyFrame.name}. Delaying ${currentKeyFrame.delaySeconds}s...`);
                setCaptureStatus('delaying');

                // Clear any previous timeout just in case
                if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);

                captureTimeoutRef.current = setTimeout(() => {
                    console.log(`Capturing ${currentMovement.name} - ${currentKeyFrame.name}...`);
                    setCaptureStatus('capturing');

                    // 1. Capture Pose Data (use the latest result for accuracy)
                    const poseResultToCapture = lastDetectedPoseResult;
                    if (!poseResultToCapture || !poseResultToCapture.landmarks || poseResultToCapture.landmarks.length === 0) {
                        console.error("Error: Pose data lost before capture.");
                        setError(`Failed to capture pose for ${currentKeyFrame.name}`);
                        setCaptureStatus('failed');
                        isCapturingProcessActive.current = false;
                        return; // Stop capture process
                    }
                    const landmarksToSave = poseResultToCapture.landmarks[0];
                    const worldLandmarksToSave = poseResultToCapture.worldLandmarks?.[0];
                    let poseScore = 0;
                    landmarksToSave.forEach(lm => poseScore += (lm.visibility ?? 0));
                    poseScore /= landmarksToSave.length;

                    const capturedKeypoints: AppKeypoint[] = landmarksToSave.map((lm, index) => ({
                         x: lm.x, y: lm.y, z: lm.z, score: lm.visibility ?? 0, name: KEYPOINT_NAMES[index] || `landmark_${index}`,
                    }));
                    const capturedPose: Pose = { score: poseScore, keypoints: capturedKeypoints };
                     // Optionally add world landmarks if needed later
                     // if (worldLandmarksToSave) { capturedPose.worldKeypoints = worldLandmarksToSave.map(...) } 

                    // 2. Capture Image Data (from canvas)
                    // Draw the specific frame to capture onto a temporary canvas if needed for non-overlay image
                    // For simplicity, capture the current canvas with overlays
                    const imageDataUrl = canvasRef.current?.toDataURL('image/jpeg', 0.9); // Capture as JPEG
                     if (!imageDataUrl) {
                        console.error("Error: Could not get image data from canvas.");
                        setError(`Failed to capture image for ${currentKeyFrame.name}`);
                        setCaptureStatus('failed');
                        isCapturingProcessActive.current = false;
                        return; // Stop capture process
                    }

                    // 3. Store Data
                    setCapturedPosesData((prevData: PoseDataBundle) => ({
                        ...prevData,
                        [currentMovement.name]: {
                            ...(prevData[currentMovement.name] || {}),
                            [currentKeyFrame.name]: {
                                pose: capturedPose,
                                image: imageDataUrl
                            }
                        }
                    }));

                    console.log(`--- Captured: ${currentMovement.name} - ${currentKeyFrame.name} ---`);
                    setCaptureStatus('captured'); // Brief status update

                    // 4. Advance State
                    let nextKeyFrameIndex = currentKeyFrameIndex + 1;
                    let nextMovementIndex = currentMovementIndex;

                    if (nextKeyFrameIndex >= currentMovement.keyFrames.length) {
                        // Move to next movement
                        nextKeyFrameIndex = 0;
                        nextMovementIndex++;
                    }

                    if (nextMovementIndex >= MOVEMENTS_TO_CAPTURE.length) {
                        // All movements complete
                        console.log("--- Assessment Complete --- ");
                        setCaptureStatus('complete');
                        setCurrentMovementIndex(nextMovementIndex);
                        // Call completion callback AFTER state updates likely settle
                        // Use a microtask or short timeout to ensure capturedPosesData is updated
                        queueMicrotask(() => {
                             setCapturedPosesData((finalData: PoseDataBundle) => {
                                onAssessmentComplete(finalData);
                                return finalData; // Return unchanged data for safety
                            });
                        });
                    } else {
                        // Go to next keyframe/movement
                        setCurrentKeyFrameIndex(nextKeyFrameIndex);
                        setCurrentMovementIndex(nextMovementIndex);
                        // Reset status for next analysis cycle after short delay
                         setTimeout(() => setCaptureStatus('idle'), 100); 
                    }

                    isCapturingProcessActive.current = false; // Unlock capture process

                }, currentKeyFrame.delaySeconds * 1000);
            }
            // else { setCaptureStatus('analyzing'); /* Keep analyzing if condition not met */ }
        }
        // else { setCaptureStatus('analyzing'); /* Keep analyzing if not stable */ }
    }

    // Continue the loop
    animationFrameId.current = requestAnimationFrame(predictWebcam);
  }, [isWebcamReady, lastDetectedPoseResult, currentMovementIndex, currentKeyFrameIndex, captureStatus, onAssessmentComplete, currentKeyFrame, currentMovement]); // Add state dependencies

  // Start/Stop detection loop
  useEffect(() => {
    if (isWebcamReady && captureStatus !== 'complete') {
      console.log("Webcam ready, starting prediction/capture loop.");
      predictWebcam();
    } else if (captureStatus === 'complete' && animationFrameId.current) {
        console.log("Assessment complete, stopping prediction loop.");
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
    }
    // Cleanup function to cancel animation frame when component unmounts or dependencies change
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      // Clear capture timeout on unmount or state change
      if (captureTimeoutRef.current) {
            clearTimeout(captureTimeoutRef.current);
      }
    };
  }, [isWebcamReady, predictWebcam, captureStatus]); // Rerun effect if status changes (e.g., to 'complete')

    // --- UI Rendering ---
    // Helper to get user-friendly status message
    const getStatusMessage = () => {
        if (isLoading) return "Loading Camera & Model...";
        if (error) return `Error: ${error}`;
        if (!isWebcamReady) return "Setting up camera...";
        if (captureStatus === 'complete') return "Assessment Complete!";
        if (!currentMovement || !currentKeyFrame) return "Initializing...";

        const movementText = currentMovement.name.replace(/_/g, ' ').toUpperCase();
        const keyFrameText = currentKeyFrame.name.replace(/_/g, ' ');
        
        // Default instruction based on the target key frame
        let instruction = `Prepare for ${keyFrameText} (${movementText})...`; 

        // Specific instructions can be mapped here
        const specificInstructions: Record<string, Record<string, string>> = {
            static_standing: {
                standing_front: "Stand facing the camera, arms relaxed.",
                standing_side: "Turn 90 degrees to your right.",
            },
            sit_to_stand: {
                seated_start: "Sit comfortably in your chair.",
                mid_point: "Begin standing up smoothly...", // Might be too quick to show
                standing_peak: "Stand up fully straight.",
            },
            back_scratcher: {
                right_arm_reach: "Reach right hand down your back, left hand up.",
                left_arm_reach: "Reach left hand down your back, right hand up.",
            },
            tech_neck: {
                neck_neutral: "Look straight ahead, neutral posture.",
                neck_flexion: "Tuck your chin to your chest.",
            },
            hamstring_hinge: {
                hinge_start: "Stand tall, feet hip-width apart.",
                hinge_peak: "Hinge at your hips, keep back straight, reach down.",
            },
        };
        
        instruction = specificInstructions[currentMovement.name]?.[currentKeyFrame.name] || instruction;


        // Append status information
        switch (captureStatus) {
            case 'analyzing': 
                instruction = `Analyzing: ${keyFrameText}... (${movementText})`; 
                break;
            case 'stabilizing': 
                instruction = `Hold pose: ${keyFrameText}... (${movementText})`; 
                break;
            case 'condition_met': 
                instruction = `Pose detected! Holding for capture...`; 
                break;
            case 'delaying': 
                // instruction = `Capturing in ${currentKeyFrame.delaySeconds}s...`; // Keep instruction simpler
                instruction = `Hold still... Capturing ${keyFrameText}`; 
                break;
            case 'capturing': 
                instruction = `Capturing ${keyFrameText}...`; 
                break;
            case 'captured': 
                const nextKfIndex = currentKeyFrameIndex + 1;
                const nextMovIndex = currentMovementIndex + (nextKfIndex >= currentMovement.keyFrames.length ? 1 : 0);
                const nextMovement = MOVEMENTS_TO_CAPTURE[nextMovIndex];
                if (nextMovement) {
                    const nextKf = nextMovement.keyFrames[nextKfIndex % currentMovement.keyFrames.length];
                    const nextMovText = nextMovement.name.replace(/_/g, ' ').toUpperCase();
                    const nextKfText = nextKf.name.replace(/_/g, ' ');
                    instruction = `${keyFrameText} Captured! Next: ${nextKfText} (${nextMovText})`; 
                } else {
                    instruction = `${keyFrameText} Captured! Finishing...`;
                }
                break;
            case 'failed': 
                instruction = `Capture Failed for ${keyFrameText}. Please readjust and hold.`; 
                break;
            default: // 'idle' or preparing
                 instruction = `Get Ready: ${instruction}`; // Use the specific instruction derived earlier
                 break; 
        }
        
        return instruction;
    }

  // Assign component instance ref to the static ref used by isStable
  useEffect(() => {
      previousLandmarksRef.current = internalPreviousLandmarksRef.current;
      return () => { // Cleanup on unmount
        previousLandmarksRef.current = null;
      }
  }, []);

  // Update the ref on each detection within the component scope
  useEffect(() => {
      if (lastDetectedPoseResult?.landmarks?.[0]) {
          internalPreviousLandmarksRef.current = lastDetectedPoseResult.landmarks[0];
      }
  }, [lastDetectedPoseResult]);

  // Effect to trigger audio cues
  useEffect(() => {
    if (isMuted || !currentMovement || !currentKeyFrame) return;

    let promptText = "";

    // Play welcome message once when ready
    if (isWebcamReady && !playedInitialAudioRef.current) {
        promptText = audioPrompts.initial.welcome;
        playedInitialAudioRef.current = true;
    }
    // Play instruction when entering idle state for a new keyframe
    else if (captureStatus === 'idle' && playedInitialAudioRef.current) {
        promptText = audioPrompts[currentMovement.name]?.[currentKeyFrame.name] || "";
    }
    // Play completion message
    else if (captureStatus === 'complete') {
         promptText = audioPrompts.final.complete;
    }

    if (promptText) {
      console.log("Attempting to play audio:", promptText);
      playAudio(promptText).catch(err => console.error("Error triggering playAudio:", err));
    }

  }, [captureStatus, currentMovement, currentKeyFrame, isWebcamReady, isMuted, playAudio]); // Depend on status and target frame/movement

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-video border border-neutralMid/50 bg-black rounded-sm overflow-hidden">
      {/* Loading and Error Overlays */} 
      {(isLoading || error || !isWebcamReady) && (
        <div className={`absolute inset-0 flex items-center justify-center z-20 p-4 ${error ? 'bg-red-900/90' : 'bg-primary/80'}`}>
          <Text className="text-center text-white">
             {isLoading ? "Loading Camera & Model..." : error ? `Error: ${error}` : "Setting up camera..." }
          </Text>
        </div>
      )}

      {/* Status/Instruction Overlay & Mute Button */} 
      {!isLoading && !error && isWebcamReady && (
          <div className="absolute top-2 left-2 right-2 p-2 bg-black/60 rounded z-30 flex justify-between items-center">
              <Text className="text-white text-center text-sm md:text-base flex-grow mr-2">{getStatusMessage()}</Text>
              <button
                onClick={() => setIsMuted(prev => !prev)}
                className="flex-shrink-0 p-1.5 rounded text-white bg-neutralMid/50 hover:bg-neutralMid/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-accent"
                aria-label={isMuted ? "Unmute Audio Cues" : "Mute Audio Cues"}
              >
                  {isMuted ? <SpeakerOffIcon className="h-4 w-4"/> : <SpeakerLoudIcon className="h-4 w-4"/>}
              </button>
          </div>
      )}
       {/* Display Audio specific errors/loading maybe? */} 
       {/* {isAudioLoading && <Text className="absolute bottom-10 left-2 text-xs text-yellow-400">Audio Loading...</Text>} */}
       {/* {audioError && <Text className="absolute bottom-12 left-2 text-xs text-red-400">Audio Error: {audioError}</Text>} */}

      {/* Video and Canvas */} 
      <video
        ref={videoRef}
        style={{ transform: 'scaleX(-1)', display: 'none' }}
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-10"
      />

        {/* Example: Display captured count (optional) */} 
         {/* <div className="absolute bottom-2 right-2 p-1 bg-black/50 rounded z-30">
            <Text className="text-white text-xs">Captured: {Object.keys(capturedPosesData[currentMovement?.name] || {}).length} / {currentMovement?.keyFrames.length}</Text>
         </div> */} 
    </div>
  );
} 