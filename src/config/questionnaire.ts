export type Question = {
  step: number;
  page: number; // Group questions onto pages
  text: string;
  type: 'yes_no' | 'scale_1_5' | 'multiple_choice';
  options?: string[]; // For multiple_choice
};

export const questionnaire: Question[] = [
  // Page 1: Upper Body & Posture
  {
    step: 1,
    page: 1,
    text: "Do you experience neck pain or stiffness regularly?",
    type: 'yes_no',
  },
  {
    step: 4, // Reordered for grouping
    page: 1,
    text: "Do you spend more than 4 hours a day looking down at screens (phone, computer)?",
    type: 'yes_no',
  },
  {
    step: 3, // Reordered for grouping
    page: 1,
    text: "Can you comfortably reach both hands behind your back to touch fingertips (like the back-scratcher test)?",
    type: 'yes_no',
  },
  // Page 2: Lower Body & Habits
  {
    step: 2,
    page: 2,
    text: "On a scale of 1 (no difficulty) to 5 (very difficult), how hard is it for you to touch your toes?",
    type: 'scale_1_5',
  },
  {
    step: 6,
    page: 2,
    text: "Do you experience difficulty getting up from a chair without using your hands?",
    type: 'yes_no',
  },
  {
    step: 5,
    page: 2,
    text: "How often do you perform mobility or stretching exercises?",
    type: 'multiple_choice',
    options: ["Never", "Rarely (1-2 times/month)", "Sometimes (1-2 times/week)", "Often (3-5 times/week)", "Daily"],
  },
];

export const TOTAL_QUESTIONNAIRE_PAGES = 2;
export const TOTAL_QUESTIONNAIRE_STEPS = questionnaire.length; // Still needed for storing answers by step
export const TOTAL_ASSESSMENT_STEPS = TOTAL_QUESTIONNAIRE_PAGES + 5; // 2 Questionnaire Pages + 5 Mobility Steps 