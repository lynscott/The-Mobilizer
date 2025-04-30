**Mobilizer v2 Feature Spec: Audio Cues & Auto-Capture**

---

## 1. Overview
This specification outlines the addition of two core features to Mobilizer:
1.  **Audio Cues:** Integration of Text-to-Speech (TTS) to provide voice guidance during the assessment.
2.  **Automatic Key-Frame Capture (Auto-Capture):** System-triggered capture of specific poses within each movement, reducing user interaction and improving consistency.

These features aim to enhance the user experience, standardize data collection, and prepare for more advanced visual analysis in future versions.

## 2. Objectives
- Improve user guidance and flow through voice instructions.
- Automate the capture process for key mobility moments.
- Ensure consistent and relevant pose data is collected for each movement.
- Lay the groundwork for future LLM-based visual assessment of captured frames.

## 3. Scope (Additions to V1)
- Integration of OpenAI's Text-to-Speech (TTS) API.
- Development of an audio playback utility/hook.
- Definition of specific audio cues for each step of the assessment flow.
- Implementation of logic to automatically capture image frames + pose data at predefined key moments within each mobility exercise.
- Modification of the data structure sent to the report generation API to include multiple captured frames per movement.
- UI updates to reflect the auto-capture process (e.g., feedback messages).

## 4. Functional Requirements

### 4.1 Audio Cues Module
- **TTS Integration:** Utilize the OpenAI API (`/v1/audio/speech`) to generate audio from text prompts.
  - Requires an OpenAI API key configured securely.
  - Consider API costs and potential latency.
- **Audio Playback:** Implement a mechanism (e.g., React hook or component using `HTMLAudioElement`) to play the generated audio blobs.
  - Ensure audio context is handled correctly (user interaction might be needed to initiate audio).
- **Cue Definition & Triggering:** Define specific text prompts for TTS generation corresponding to instructions for each movement and transition.
  - **Examples:**
    - "Welcome to the Mobilizer assessment. Let's start with your posture."
    - "Please stand facing the camera, arms relaxed at your sides." (Trigger Auto-Capture: Standing Front)
    - "Now, please turn 90 degrees to your right." (Trigger Auto-Capture: Standing Side)
    - "Next, we'll check your sit-to-stand. Please sit comfortably in your chair." (Trigger Auto-Capture: Seated)
    - "When ready, stand up smoothly." (Trigger Auto-Capture: Standing Peak)
    - "Great. Now for the back-scratcher test. Reach your right hand behind your head..." (Trigger Auto-Capture: Right Arm Up)
    - ... and so on for all movements and key frames.
- **Control:** Provide UI element (e.g., speaker icon) to mute/unmute audio cues.

### 4.2 Auto-Capture Module
- **Goal:** Capture specific, meaningful frames during each movement sequence automatically.
- **Triggering Mechanism:** Define logic to determine *when* to capture each key frame. This likely requires a combination of:
    - **State Management:** Tracking the current movement and expected key frame (e.g., `currentState = 'Standing_Front_Expected'`).
    - **Pose Analysis (Detailed):** Implement specific geometric and positional checks using `PoseLandmarkerResult.landmarks` to verify the user's pose aligns with the target key frame before triggering capture. A check for minimal movement (low velocity of keypoints over a short window) should precede the geometric check to ensure stability.

        *   **1. Static Standing Posture:**
            *   `standing_front`:
                *   **Condition:** Shoulders roughly level (small Y difference). Hips roughly level. Shoulders directly above hips (small X difference). Knees directly above ankles (small X difference). Ear-Shoulder-Hip angle (calculated using average ear, average shoulder, average hip points) near 180°. High visibility for torso and leg landmarks. Stable pose (low keypoint velocity).
                *   **Trigger:** After conditions met + 1s delay.
            *   `standing_side`:
                *   **Condition:** Similar vertical alignment checks as front view. Significant Z difference between left/right shoulders and hips (confirming profile view). Ear-Shoulder-Hip angle near 180°. High visibility for at least one side's landmarks. Stable pose.
                *   **Trigger:** After conditions met + 1s delay.

        *   **2. Sit-to-Stand:**
            *   `seated_start`:
                *   **Condition:** Hip Y coordinates significantly *lower* than Knee Y coordinates. Shoulder Y coordinates higher than Hip Y coordinates. Knee angles roughly 90°. High visibility for torso and legs. Stable pose.
                *   **Trigger:** After conditions met + 1s delay.
            *   `mid_point` *(New)*:
                *   **Condition:** Hip Y coordinates roughly *equal* to Knee Y coordinates (within tolerance). Torso relatively upright (Ear-Shoulder-Hip angle > 150°). Active movement detected previously (transitioning from `seated_start`).
                *   **Trigger:** When conditions first met during upward motion.
            *   `standing_peak`:
                *   **Condition:** Hip Y coordinates significantly *higher* than Knee Y coordinates. Knee angles near 180°. Ear-Shoulder-Hip angle near 180°. Stable pose (low keypoint velocity after reaching peak).
                *   **Trigger:** After conditions met + 0.5s delay (to ensure stability at the top).

        *   **3. Back-Scratcher (Shoulder Mobility):**
            *   `right_arm_reach`:
                *   **Condition:** Right Elbow angle is acute (< 90°). Right Wrist Y is high (above elbow). Left Elbow angle is obtuse (> 120°). Left Wrist Y is low (near hip/lower back). High visibility for both arms/shoulders. Stable pose.
                *   **Trigger:** After conditions met + 1s delay.
            *   `left_arm_reach`:
                *   **Condition:** Left Elbow angle is acute (< 90°). Left Wrist Y is high. Right Elbow angle is obtuse (> 120°). Right Wrist Y is low. High visibility for both arms/shoulders. Stable pose.
                *   **Trigger:** After conditions met + 1s delay.

        *   **4. Tech-Neck Check (Cervical Flexion):**
            *   `neck_neutral`:
                *   **Condition:** Head relatively upright. Use `drawNeckLineAnalysis` offset: horizontal offset near 0 (within tolerance). Stable pose.
                *   **Trigger:** After conditions met + 1s delay.
            *   `neck_flexion`:
                *   **Condition:** Head maximally tilted down. Could check vertical distance between Nose/Mouth landmarks and Shoulder landmarks (minimum distance). Stable pose at maximum flexion.
                *   **Trigger:** Detect minimum nose-to-shoulder Y distance + 0.5s delay.

        *   **5. Hamstring Hinge:**
            *   `hinge_start`:
                *   **Condition:** Same as `standing_front` (upright, stable).
                *   **Trigger:** After conditions met + 1s delay.
            *   `hinge_peak`:
                *   **Condition:** Hip angle (e.g., Shoulder-Hip-Knee) is minimal (most acute). Knee angles remain large (> 150°, indicating straight legs). Vertical Y position of Wrist landmarks is minimal (lowest point). Stable pose detected at the lowest point.
                *   **Trigger:** Detect minimum hip angle / minimum wrist Y position + 0.5s delay.

    - **Timed Delays/Prompts:** Use audio cues to instruct the user ("Hold this pose...") followed by a short delay (specified above) before capture, allowing time to stabilize after the pose analysis confirms general positioning.

- **Key Frames to Capture (per movement):**
    1.  **Static Standing Posture:**
        - `standing_front`
        - `standing_side`
    2.  **Sit-to-Stand:**
        - `seated_start`
        - `mid_point`
        - `standing_peak`
    3.  **Back-Scratcher (Shoulder Mobility):**
        - `right_arm_reach`
        - `left_arm_reach`
    4.  **Tech-Neck Check (Cervical Flexion):**
        - `neck_neutral`
        - `neck_flexion`
    5.  **Hamstring Hinge:**
        - `hinge_start`
        - `hinge_peak`

- **Capture Process:**
    - When trigger conditions are met:
        - Capture the current video frame as image data (e.g., base64 `jpeg` or `png`, or `Blob`).
        - Capture the corresponding `PoseLandmarkerResult` (keypoints JSON) at that exact moment.
        - Store both the image data and pose data, associated with the specific key frame identifier (e.g., `standing_front`).
- **UI Feedback:** Provide clear visual/audio feedback when a capture occurs (e.g., "Front view captured!", brief screen flash, checkmark icon).
- **Error Handling:** Implement logic for cases where a pose cannot be detected or the trigger conditions aren't met within a reasonable timeframe (e.g., prompt user to reposition, offer manual capture override, or skip).

### 4.3 Data Structure Update
- Modify the data structure sent to the reporting API (`/api/report` or direct OpenAI call) to accommodate multiple frames per movement.
- **Example Structure:**
  ```json
  {
    "assessments": { /* questionnaire results */ },
    "poses": {
      "static_standing": {
        "standing_front": { "pose": { /* keypoints */ }, "image": "data:image/jpeg;base64,..." },
        "standing_side": { "pose": { /* keypoints */ }, "image": "data:image/jpeg;base64,..." }
      },
      "sit_to_stand": {
         "seated_start": { "pose": { /* keypoints */ }, "image": "data:image/jpeg;base64,..." },
         "standing_peak": { "pose": { /* keypoints */ }, "image": "data:image/jpeg;base64,..." }
      },
      // ... other movements
    }
  }
  ```

## 5. Technical Considerations
- **Dependencies:** Add OpenAI Node.js/JS SDK (`openai`) for TTS.
- **State Management:** Robust state management is crucial for tracking the current movement, expected key frame, and capture status.
- **Performance:** Real-time pose analysis for triggering, even if simple, adds computational load. Ensure it doesn't degrade the user experience. Image capture and encoding also consume resources.
- **API Keys:** Securely manage the OpenAI API key (likely via environment variables).
- **User Experience:** Balance automation with clear feedback. Avoid confusing the user if captures fail or require retries. Ensure audio cues are clear and well-timed.

## 6. UI/UX Updates
- Add a mute/unmute button for audio cues.
- Display subtle feedback messages or indicators when auto-captures are successful (e.g., toast notifications, progress indicators updating).
- Potentially display thumbnails of captured key frames as they are collected.
- Refine instructions presented on screen to complement the audio cues.

---

*End of Spec*
