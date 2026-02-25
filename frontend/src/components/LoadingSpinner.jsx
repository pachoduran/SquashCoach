import React from 'react';

export const LoadingSpinner = ({ size = 'md', message = 'Cargando...' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Outer ring */}
        <div className={`absolute inset-0 rounded-full border-2 border-brand-yellow/20`}></div>
        {/* Spinning ring */}
        <div className={`absolute inset-0 rounded-full border-2 border-transparent border-t-brand-yellow animate-spin`}></div>
        {/* Center ball */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-squash-ball pulse-yellow"></div>
        </div>
      </div>
      {message && (
        <span className="text-brand-gray font-body text-sm">{message}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;
