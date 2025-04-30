import React from 'react';

type ProgressBarProps = {
  currentStep: number;
  totalSteps: number;
};

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = Math.round((currentStep / totalSteps) * 100);
  
  return (
    <div className="py-2 px-4 bg-primary/90 border-b border-accent/20">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-1 text-xs text-neutralMid">
          <span>Step {currentStep} of {totalSteps}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-neutralMid/20 h-1 rounded-sm overflow-hidden">
          <div 
            className="bg-accent h-full transition-all duration-300 ease-in-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
} 