import React from 'react';
import ProgressBar from './ProgressBar';

type LayoutProps = {
  children: React.ReactNode;
  currentStep?: number;
  totalSteps?: number;
  showProgress?: boolean;
};

export default function Layout({ 
  children, 
  currentStep, 
  totalSteps, 
  showProgress = false 
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-primary text-neutralLight">
      <header className="border-b border-accent p-4">
        <div className="container mx-auto">
          <h1 className="font-heading text-2xl md:text-3xl tracking-wider uppercase">
            {/* <span className="accent-underline">The Mobilizer</span> */}
          </h1>
        </div>
      </header>
      
      {showProgress && currentStep && totalSteps && (
        <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      )}
      
      <main className="flex-1 container mx-auto p-4 md:p-6">
        {children}
      </main>
      
      <footer className="border-t border-accent/30 py-3 text-center text-sm text-neutralMid">
        <div className="container mx-auto">
          Mobilizer v1 &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
} 