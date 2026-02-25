import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCard = ({ label, value, trend, trendValue, icon: Icon, highlight = false }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-brand-gray" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend === 'up') return 'text-green-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-brand-gray';
  };

  return (
    <div 
      className={`bg-brand-dark-gray border rounded-lg p-5 transition-all duration-200 ${
        highlight 
          ? 'border-brand-yellow/30 shadow-[0_0_15px_rgba(255,218,0,0.1)]' 
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-brand-gray text-xs font-heading uppercase tracking-wider">
          {label}
        </span>
        {Icon && (
          <Icon className={`w-5 h-5 ${highlight ? 'text-brand-yellow' : 'text-brand-gray'}`} />
        )}
      </div>
      
      <div className="flex items-end gap-2">
        <span className={`font-heading text-3xl font-bold ${
          highlight ? 'text-brand-yellow' : 'text-white'
        }`}>
          {value}
        </span>
        
        {(trend || trendValue) && (
          <div className={`flex items-center gap-1 mb-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            {trendValue && (
              <span className="text-sm font-body">{trendValue}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
