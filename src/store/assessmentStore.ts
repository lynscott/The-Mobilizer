import { create, StateCreator } from 'zustand';
import { AssessmentState, Movement, Pose, QuestionnaireAnswers, Keypoint } from './types'; // Relative path within the same folder

const initialState: Omit<AssessmentState, 'setQuestionnaireAnswer' | 'setPoseData' | 'resetAssessment'> = {
  questionnaireAnswers: {},
  poseData: {},
};

// StateCreator implicitly types the set function
const assessmentStoreCreator: StateCreator<AssessmentState> = (set) => ({
  ...initialState,
  
  setQuestionnaireAnswer: (step: number, answer: string | number | boolean | null) => 
    set((state: AssessmentState) => ({
      questionnaireAnswers: { 
        ...state.questionnaireAnswers, 
        [step]: answer 
      },
    })),

  setPoseData: (movement: Movement, pose: Pose) =>
    set((state: AssessmentState) => ({
      poseData: { 
        ...state.poseData, 
        [movement]: pose 
      },
    })),

  resetAssessment: () => set(initialState),
});

export const useAssessmentStore = create<AssessmentState>(assessmentStoreCreator);

// Export types from here as well for convenience if needed elsewhere
export type { AssessmentState, Movement, Pose, QuestionnaireAnswers, Keypoint }; 