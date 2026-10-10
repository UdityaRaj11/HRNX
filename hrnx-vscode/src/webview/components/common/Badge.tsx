import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'success' | 'info' | 'purple';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
}) => {
  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    danger: 'bg-red-950/80 text-red-300 border-red-800/80',
    warning: 'bg-amber-950/80 text-amber-300 border-amber-800/80',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80',
    info: 'bg-sky-950/80 text-sky-300 border-sky-800/80',
    purple: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded font-mono',
    md: 'text-xs px-2 py-0.5 rounded-md font-mono',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 border font-medium ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
};
