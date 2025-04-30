import React from 'react';

type CardProps = {
  children: React.ReactNode;
  title?: string;
  className?: string;
};

export default function Card({ children, title, className = '' }: CardProps) {
  return (
    <div className={`bg-neutralLight text-primary rounded-sm border border-accent/20 overflow-hidden shadow-md ${className}`}>
      {title && (
        <div className="border-b border-accent bg-primary text-neutralLight p-4">
          <h3 className="font-heading text-xl uppercase tracking-wide accent-underline inline-block">{title}</h3>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
} 