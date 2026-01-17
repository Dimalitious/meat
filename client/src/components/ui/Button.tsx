import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
    size?: 'sm' | 'default' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
                    {
                        'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-500/20': variant === 'default',
                        'bg-slate-100 text-slate-900 hover:bg-slate-200': variant === 'secondary',
                        'border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900': variant === 'outline',
                        'hover:bg-slate-100 hover:text-slate-900': variant === 'ghost',
                        'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20': variant === 'destructive',
                        'h-9 px-3': size === 'sm',
                        'h-10 px-4 py-2': size === 'default',
                        'h-11 px-8': size === 'lg',
                        'h-10 w-10': size === 'icon',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button };
