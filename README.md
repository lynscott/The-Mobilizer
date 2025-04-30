# Mobilizer v1

Mobilizer v1 is an open-source, browser-based mobility assessment tool. It combines a quick questionnaire with PoseNet-powered key-frame capture of core mobility movements to generate an instant AI-driven mobility report.

Built with Next.js, TensorFlow.js, Tailwind CSS, and OpenAI.

## Features (v1 Scope)

- **Questionnaire:** 6–8 core mobility questions.
- **Pose Capture:** In-browser key-frame extraction using PoseNet for:
    - Static Standing Posture
    - Sit-to-Stand
    - Back-Scratcher (Shoulder Test)
    - Tech-Neck Check
    - Hamstring Hinge
- **AI Report:** Instant report generation using OpenAI API with key limitations, risk level, and recommended drills.
- **Export:** Download PDF or Copy report to clipboard.

## Tech Stack

- **Frontend:** Next.js + React + TypeScript
- **Pose Estimation:** @tensorflow-models/posenet + @tensorflow/tfjs-backend-webgl
- **AI Layer:** OpenAI API
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- npm, yarn, pnpm, or bun
- An OpenAI API Key

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd mobilizer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    # or
    pnpm install
    # or
    bun install
    ```

3.  **Set up environment variables:**
    Create a file named `.env.local` in the root of the project and add your OpenAI API key:
    ```env
    OPENAI_API_KEY=your_openai_api_key_here
    ```
    *Note: The AI report generation requires this key.*

### Running the Development Server

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the Mobilizer app.

The main application page is `app/page.tsx`. You can start editing it, and the page auto-updates as you edit the file.

## Learn More About Next.js

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Remember to add your `OPENAI_API_KEY` as an environment variable in your Vercel project settings.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
