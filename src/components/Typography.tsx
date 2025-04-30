import React from 'react';

type HeadingProps = {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  underline?: boolean;
};

export function Heading({ 
  children, 
  level = 2, 
  className = '',
  underline = false
}: HeadingProps) {
  const baseClasses = 'font-heading text-neutralLight';
  const sizeClasses = {
    1: 'text-4xl md:text-5xl',
    2: 'text-3xl md:text-4xl',
    3: 'text-2xl md:text-3xl',
    4: 'text-xl md:text-2xl',
    5: 'text-lg md:text-xl',
    6: 'text-base md:text-lg',
  };
  
  const underlineClass = underline ? 'accent-underline inline-block' : '';
  const combinedClasses = `${baseClasses} ${sizeClasses[level]} ${underlineClass} ${className}`;
  
  switch (level) {
    case 1:
      return <h1 className={combinedClasses}>{children}</h1>;
    case 2:
      return <h2 className={combinedClasses}>{children}</h2>;
    case 3:
      return <h3 className={combinedClasses}>{children}</h3>;
    case 4:
      return <h4 className={combinedClasses}>{children}</h4>;
    case 5:
      return <h5 className={combinedClasses}>{children}</h5>;
    case 6:
      return <h6 className={combinedClasses}>{children}</h6>;
    default:
      return <h2 className={combinedClasses}>{children}</h2>;
  }
}

type TextProps = {
  children: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  muted?: boolean;
};

export function Text({ 
  children, 
  className = '',
  size = 'base',
  muted = false
}: TextProps) {
  const baseClasses = 'font-body';
  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };
  
  const mutedClass = muted ? 'text-neutralMid' : '';
  
  return (
    <p className={`${baseClasses} ${sizeClasses[size]} ${mutedClass} ${className}`}>
      {children}
    </p>
  );
} 