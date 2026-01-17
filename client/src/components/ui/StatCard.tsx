import React from 'react';
import { Card } from './Card';

interface StatCardProps {
    label: string;
    value: string | number;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    icon?: React.ReactNode;
    color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, icon, color = 'blue' }) => {
    const colorStyles = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-emerald-50 text-emerald-600',
        red: 'bg-red-50 text-red-600',
        yellow: 'bg-amber-50 text-amber-600',
        purple: 'bg-violet-50 text-violet-600',
    };

    return (
        <Card>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <h3 className="mt-2 text-3xl font-bold text-slate-900">{value}</h3>

                    {trend && (
                        <div className={`mt-2 flex items-center text-sm ${trend.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                            <span className="font-medium">
                                {trend.isPositive ? '+' : ''}{trend.value}%
                            </span>
                            <span className="ml-1 text-slate-400">vs last month</span>
                        </div>
                    )}
                </div>

                {icon && (
                    <div className={`p-3 rounded-lg ${colorStyles[color]}`}>
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    );
};
