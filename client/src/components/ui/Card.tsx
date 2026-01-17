import React, { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    noPadding = false,
    ...props
}) => {
    return (
        <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
            {...props}
        >
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
};
