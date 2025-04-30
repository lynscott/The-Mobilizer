import React from 'react';

type ButtonVariant = 'primary' | 'accent' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  disabled = false,
  className = '',
}: ButtonProps) {
  const baseClasses = 'font-heading uppercase tracking-wide flex items-center justify-center transition-all duration-200 ease-in-out';
  
  const variantClasses = {
    primary: 'bg-primary text-neutralLight border-2 border-neutralLight hover:bg-primary/80',
    accent: 'bg-accent text-white border-2 border-accent hover:bg-accent/90',
    outline: 'bg-transparent text-neutralLight border-2 border-neutralLight hover:bg-neutralLight/10',
  };
  
  const sizeClasses = {
    sm: 'text-sm py-1 px-3',
    md: 'text-base py-2 px-4',
    lg: 'text-lg py-3 px-6',
  };
  
  const widthClass = fullWidth ? 'w-full' : '';
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${disabledClass} ${className}`}
    >
      {children}
    </button>
  );
} 