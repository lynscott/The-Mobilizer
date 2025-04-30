**Mobilizer v1 — Official Design Specification**

---

## 1. Overview
Mobilizer v1 is an open-source, browser-based mobility assessment tool. It combines a quick questionnaire with PoseNet-powered key-frame capture of core mobility movements to generate an instant AI-driven mobility report.

## 2. Objectives
- Ship a lightweight MVP that users can run in-browser without installs.
- Showcase core fitness/AI expertise and Mobilizer branding.
- Provide a foundation for future video analysis and live coaching features.

## 3. Scope (V1)
- **Questionnaire module** (6–8 core mobility questions)
- **PoseNet integration** in-browser for key-frame extraction
- **Basic mobility movements**: static standing, sit-to-stand, back-scratcher shoulder test, tech-neck assessment, hamstring hinge stretch
- **Instant report generation** using OpenAI API backbone (template-driven)
- **Basic UI/UX** with Equalizer-inspired theme

## 4. Functional Requirements

### 4.1 Questionnaire Module
- Present each question on its own screen (mobile-first flow)
- Collect answers via buttons (Yes / No / Partial / Level selection)
- Store responses client-side until submission

### 4.2 Mobility Screen Module
- Guide user to record each movement via webcam
- Movements to capture:
  1. Static Standing Posture (eyes forward, arms at sides)
  2. Sit-to-Stand (from chair to standing)
  3. Back-Scratcher (hand reach behind shoulder)
  4. Tech-Neck Check (chin-to-chest tilt)
  5. Hamstring Hinge (knees bent, attempt toe touch)

### 4.3 PoseNet Integration
- Load TensorFlow.js PoseNet model
- For each movement, detect keypoints in real time
- On user action (button press), capture a still frame & pose keypoints

### 4.4 Key-Frame Extraction
- Automatically freeze and snapshot the frame when user clicks “Capture”
- Extract and store the pose keypoints JSON
- Show thumbnail preview below the video feed

### 4.5 Report Generation
- On completion of questionnaire + captures, bundle data
- Send to `/api/report` endpoint or direct OpenAI call:
  ```json
  {
    "assessments": { /* questionnaire */ },
    "poses": { /* PoseNet keypoints */ }
  }
  ```
- Generate AI report with: key limitations, risk level, 3 drills

### 4.6 Export/Share
- Display report on results page
- Button to **Download PDF** or **Copy to Clipboard**
- (Optional) Email share stub for future

## 5. Technical Stack
- **Frontend:** Next.js + React + TypeScript
- **Pose Estimation:** @tensorflow-models/posenet + @tensorflow/tfjs-backend-webgl
- **AI Layer:** OpenAI API (function calling endpoint)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel
- **Storage (optional):** LocalStorage for session data

## 6. UI/UX Design Guide
- **Flow:** Landing ➔ Questionnaire ➔ Mobility Capture ➔ Results
- **Navigation:** Linear; no sidebar
- **Buttons:** Full-width primary buttons, clear labels ("Next", "Capture", "Get Report")
- **Feedback:** Show progress indicator (e.g., "Step 3 of 8")
- **Results Page:** Card-style report with clear headings

## 7. Theming & Visual Identity
_Based on: “The Equalizer” movie poster_

### 7.1 Color Palette
- **Primary:** #111111 (deep charcoal)
- **Accent:** #E50914 (vibrant red)
- **Neutral:** #F5F5F5 (light gray), #CCCCCC (mid gray)
- **Highlight:** #FFFFFF (white text)

### 7.2 Typography
- **Headings:** Bold, condensed sans-serif (e.g., _Oswald_ or _Anton_)
- **Body:** Clean sans-serif (e.g., _Inter_ or _Roboto_) at 16–18px

### 7.3 Imagery & Texture
- **Backgrounds:** Dark gradients, subtle vignette
- **Overlays:** Thin red lines/dividers
- **Icons:** Outline style, high contrast
- **UI Elements:** Sharp edges, minimal rounded corners (4px)

### 7.4 Logo & Branding
- **Logo:** “Mobilizer” in uppercase, slight letter spacing, red underline
- **Favicon:** Stylized “M” in red on black

## 8. Project Structure & Agent Tasks
1. **Scaffold Repo:** Next.js + Tailwind starter
2. **Implement Questionnaire:** React pages/components
3. **Integrate PoseNet:** load model, video component, capture logic
4. **API Stub:** `/api/report` that calls OpenAI with template
5. **Results Page:** display AI response in styled cards
6. **Theming:** apply colors/fonts from guide
7. **Readme & CI:** instructions to run locally, deploy to Vercel

## 9. Deliverables
- GitHub repo: `github.com/<your-org>/mobilizer`
- Live demo URL
- Design spec document (this)
- Initial Agent prompt to create above modules

---

*End of Spec — ready for initial agent-driven creation.*

