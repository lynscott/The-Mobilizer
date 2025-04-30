// Define types for pose keypoints (simplified example)
export type Keypoint = {
  x: number;
  y: number;
  score: number;
  name?: string;
};

export type Pose = {
  keypoints: Keypoint[];
  score: number;
};

// Define types for questionnaire answers (example)
export type QuestionnaireAnswers = {
  [step: number]: string | number | boolean | null;
};

// Define types for the movements specified in the design doc
export type Movement = 
  | 'static-standing' 
  | 'sit-to-stand' 
  | 'back-scratcher' 
  | 'tech-neck' 
  | 'hamstring-hinge';

// Define the state structure
export type AssessmentState = {
  questionnaireAnswers: QuestionnaireAnswers;
  poseData: {
    [key in Movement]?: Pose;
  };
  setQuestionnaireAnswer: (step: number, answer: string | number | boolean | null) => void;
  setPoseData: (movement: Movement, pose: Pose) => void;
  resetAssessment: () => void;
}; 