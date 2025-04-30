'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAssessmentStore } from '@/store/assessmentStore';
import { questionnaire, TOTAL_QUESTIONNAIRE_PAGES, TOTAL_ASSESSMENT_STEPS, Question } from '@/config/questionnaire';
import { Layout, Button, Heading, Text, Card } from '@/components';

// Helper to render answer options for a single question
const AnswerOptions = ({ question, selectedAnswer, onAnswer }: {
  question: Question;
  selectedAnswer: string | number | boolean | null;
  onAnswer: (answer: string | number | boolean | null) => void;
}) => {
  switch (question.type) {
    case 'yes_no':
      return (
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Button
            variant={selectedAnswer === true ? 'accent' : 'outline'}
            onClick={() => onAnswer(true)}
            className="flex-1"
            size="md"
          >
            Yes
          </Button>
          <Button
            variant={selectedAnswer === false ? 'accent' : 'outline'}
            onClick={() => onAnswer(false)}
            className="flex-1"
            size="md"
          >
            No
          </Button>
        </div>
      );
    case 'scale_1_5':
      return (
        <div className="flex justify-between gap-2 mt-4 flex-wrap">
          {[1, 2, 3, 4, 5].map(value => (
            <Button
              key={value}
              variant={selectedAnswer === value ? 'accent' : 'outline'}
              onClick={() => onAnswer(value)}
              className="min-w-[45px] flex-1"
              size="sm"
            >
              {value}
            </Button>
          ))}
        </div>
      );
    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-3 mt-4">
          {question.options?.map((option: string) => (
            <Button
              key={option}
              variant={selectedAnswer === option ? 'accent' : 'outline'}
              onClick={() => onAnswer(option)}
              fullWidth={true}
              size="sm"
              className="text-left justify-start"
            >
              {option}
            </Button>
          ))}
        </div>
      );
    default:
      return null;
  }
};

export default function QuestionnairePage() {
  const router = useRouter();
  const params = useParams();
  const currentPage = parseInt(params.page as string, 10);

  const { questionnaireAnswers, setQuestionnaireAnswer } = useAssessmentStore();
  
  const questionsOnPage = useMemo(() => 
    questionnaire.filter((q: Question) => q.page === currentPage)
  , [currentPage]);

  const [pageAnswers, setPageAnswers] = useState<{[step: number]: string | number | boolean | null}>({});

  useEffect(() => {
    const initialAnswers: {[step: number]: string | number | boolean | null} = {};
    questionsOnPage.forEach((q: Question) => {
      initialAnswers[q.step] = questionnaireAnswers[q.step] ?? null;
    });
    setPageAnswers(initialAnswers);
  }, [currentPage, questionsOnPage, questionnaireAnswers]);

  const handleAnswerChange = (step: number, answer: string | number | boolean | null) => {
    setPageAnswers(prev => ({ ...prev, [step]: answer }));
  };

  const allQuestionsAnswered = useMemo(() => 
    questionsOnPage.every((q: Question) => pageAnswers[q.step] !== null && pageAnswers[q.step] !== undefined)
  , [questionsOnPage, pageAnswers]);

  const handleNext = () => {
    if (!allQuestionsAnswered) return;
    
    questionsOnPage.forEach((q: Question) => {
      setQuestionnaireAnswer(q.step, pageAnswers[q.step]);
    });

    if (currentPage < TOTAL_QUESTIONNAIRE_PAGES) {
      router.push(`/questionnaire/${currentPage + 1}`);
    } else {
      router.push('/mobility/static-standing');
    }
  };

  if (questionsOnPage.length === 0 || isNaN(currentPage)) {
    return (
      <Layout>
        <Heading>Error</Heading>
        <Text>Invalid questionnaire page.</Text>
        <Button onClick={() => router.push('/questionnaire/1')} className="mt-4">
          Start Over
        </Button>
      </Layout>
    );
  }

  return (
    <Layout 
      showProgress 
      currentStep={currentPage}
      totalSteps={TOTAL_ASSESSMENT_STEPS}
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <Heading level={2} className="text-center mb-0">
          Questionnaire - Page {currentPage} of {TOTAL_QUESTIONNAIRE_PAGES}
        </Heading>

        {questionsOnPage.map((question: Question) => (
          <Card key={question.step} className="bg-primary/30 border border-neutralMid/20 !text-neutralLight">
            <Text size="lg" className="!font-medium mb-2">{question.text}</Text>
            <AnswerOptions 
              question={question} 
              selectedAnswer={pageAnswers[question.step] ?? null}
              onAnswer={(answer) => handleAnswerChange(question.step, answer)} 
            />
          </Card>
        ))}

        <Button 
          onClick={handleNext}
          disabled={!allQuestionsAnswered}
          variant="accent"
          className="mt-6 w-full max-w-sm mx-auto"
          size="lg"
        >
          {currentPage < TOTAL_QUESTIONNAIRE_PAGES ? 'Next Page' : 'Continue to Movement Assessment'}
        </Button>
      </div>
    </Layout>
  );
} 