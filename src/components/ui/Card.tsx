import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl dark:border dark:border-white/10',
          {
            'bg-white dark:bg-slate-900/88': variant === 'default',
            'bg-white dark:bg-slate-900/88 border-2 border-slate-200 dark:border-white/10': variant === 'bordered',
            'bg-white dark:bg-slate-900/92 shadow-xl shadow-slate-200/50 dark:shadow-black/30': variant === 'elevated',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
