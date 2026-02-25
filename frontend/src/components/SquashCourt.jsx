import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

// Squash Ball Component - realistic with two yellow dots
const SquashBall = ({ x, y, number, isWinner, isHighlighted, isVisible, onClick, reason }) => {
  if (!isVisible) return null;
  
  const ballSize = isHighlighted ? 28 : 22;
  const halfSize = ballSize / 2;
  
  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      className="transition-all duration-300"
    >
      {/* Shadow */}
      <ellipse
        cx={x + 2}
        cy={y + ballSize - 4}
        rx={halfSize * 0.8}
        ry={4}
        fill="rgba(0,0,0,0.3)"
      />
      
      {/* Ball base - dark gray like real squash ball */}
      <circle
        cx={x}
        cy={y}
        r={halfSize}
        fill="#2A2A2A"
        stroke={isHighlighted ? '#FFFFFF' : (isWinner ? '#22C55E' : '#EF4444')}
        strokeWidth={isHighlighted ? 3 : 2}
      />
      
      {/* Ball gradient for 3D effect */}
      <defs>
        <radialGradient id={`ballGradient-${number}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor="#4A4A4A" />
          <stop offset="50%" stopColor="#2A2A2A" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </radialGradient>
      </defs>
      <circle
        cx={x}
        cy={y}
        r={halfSize - 1}
        fill={`url(#ballGradient-${number})`}
      />
      
      {/* Two yellow dots - characteristic of squash balls */}
      <circle
        cx={x - halfSize * 0.35}
        cy={y - halfSize * 0.25}
        r={3}
        fill="#FFDA00"
      />
      <circle
        cx={x + halfSize * 0.25}
        cy={y + halfSize * 0.3}
        r={3}
        fill="#FFDA00"
      />
      
      {/* Point number */}
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="10"
        fontFamily="Barlow Condensed"
        fontWeight="bold"
      >
        {number}
      </text>
      
      {/* Highlight ring animation */}
      {isHighlighted && (
        <circle
          cx={x}
          cy={y}
          r={halfSize + 6}
          fill="none"
          stroke={isWinner ? '#22C55E' : '#EF4444'}
          strokeWidth="2"
          strokeDasharray="4,4"
          className="animate-spin-slow"
          style={{ transformOrigin: `${x}px ${y}px` }}
        />
      )}
    </g>
  );
};

export const SquashCourt = ({ points = [], onPointClick, highlightedPoint, myPlayerId }) => {
  const [currentStep, setCurrentStep] = useState(points.length); // Show all by default
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms per point
  
  const courtWidth = 640;
  const courtHeight = 970;
  const serviceLineY = courtHeight * 0.57;
  const shortLineY = courtHeight * 0.44;
  const tinHeight = 48;
  
  // Auto-play effect
  useEffect(() => {
    if (isPlaying && currentStep < points.length) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, playSpeed);
      return () => clearTimeout(timer);
    } else if (currentStep >= points.length) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentStep, points.length, playSpeed]);

  // Reset when points change
  useEffect(() => {
    setCurrentStep(points.length);
    setIsPlaying(false);
  }, [points.length]);

  const handlePlay = () => {
    if (currentStep >= points.length) {
      setCurrentStep(0);
    }
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(prev + 1, points.length));
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleSliderChange = (value) => {
    setIsPlaying(false);
    setCurrentStep(value[0]);
  };

  // Get current score at this step
  const getCurrentScore = () => {
    if (currentStep === 0 || points.length === 0) return { p1: 0, p2: 0 };
    const currentPoint = points[currentStep - 1];
    return {
      p1: currentPoint?.player1_score || 0,
      p2: currentPoint?.player2_score || 0
    };
  };

  const score = getCurrentScore();
  
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Playback Controls */}
      {points.length > 0 && (
        <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-brand-gray font-heading text-xs uppercase tracking-wide">
              Reproducción de puntos
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white font-heading text-lg">
                {currentStep}
              </span>
              <span className="text-brand-gray">/</span>
              <span className="text-brand-gray font-heading">
                {points.length}
              </span>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="mb-4">
            <Slider
              value={[currentStep]}
              min={0}
              max={points.length}
              step={1}
              onValueChange={handleSliderChange}
              className="w-full"
              data-testid="point-slider"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              data-testid="reset-button"
              className="text-brand-gray hover:text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStepBack}
              disabled={currentStep === 0}
              data-testid="step-back-button"
              className="text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            {isPlaying ? (
              <Button
                onClick={handlePause}
                data-testid="pause-button"
                className="bg-brand-yellow text-brand-black hover:bg-brand-yellow/90 px-6"
              >
                <Pause className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                onClick={handlePlay}
                data-testid="play-button"
                className="bg-brand-yellow text-brand-black hover:bg-brand-yellow/90 px-6"
              >
                <Play className="w-5 h-5" />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStepForward}
              disabled={currentStep >= points.length}
              data-testid="step-forward-button"
              className="text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Current Score Display */}
          {currentStep > 0 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="text-brand-gray font-heading text-xs uppercase">Marcador:</span>
              <span className="font-heading text-2xl text-white">
                {score.p1} - {score.p2}
              </span>
            </div>
          )}

          {/* Current Point Info */}
          {currentStep > 0 && points[currentStep - 1] && (
            <div className="mt-3 text-center">
              <span className={`text-sm font-body ${
                points[currentStep - 1].winner_player_id === myPlayerId 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {points[currentStep - 1].reason || 'Punto'} - 
                {points[currentStep - 1].winner_player_id === myPlayerId ? ' ¡Ganado!' : ' Perdido'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Court SVG */}
      <svg
        viewBox={`0 0 ${courtWidth} ${courtHeight}`}
        className="w-full h-auto rounded-lg"
        style={{ backgroundColor: '#0A0A0A' }}
        data-testid="squash-court-svg"
      >
        {/* Court floor with subtle texture */}
        <defs>
          <pattern id="courtPattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#1A1A1A"/>
            <rect width="10" height="10" fill="#1C1C1C"/>
            <rect x="10" y="10" width="10" height="10" fill="#1C1C1C"/>
          </pattern>
        </defs>
        
        <rect
          x="4"
          y="4"
          width={courtWidth - 8}
          height={courtHeight - 8}
          fill="url(#courtPattern)"
          stroke="#FFDA00"
          strokeWidth="4"
          rx="4"
        />
        
        {/* Tin (front wall board) */}
        <rect
          x="4"
          y={courtHeight - tinHeight - 4}
          width={courtWidth - 8}
          height={tinHeight}
          fill="#2A2A2A"
          stroke="#FFDA00"
          strokeWidth="2"
        />
        <text
          x={courtWidth / 2}
          y={courtHeight - tinHeight / 2}
          textAnchor="middle"
          fill="#707070"
          fontSize="16"
          fontFamily="Barlow Condensed"
          fontWeight="500"
          letterSpacing="3"
        >
          TIN
        </text>
        
        {/* Service line */}
        <line
          x1="4"
          y1={serviceLineY}
          x2={courtWidth - 4}
          y2={serviceLineY}
          stroke="#FFDA00"
          strokeWidth="2"
          strokeDasharray="15,8"
          opacity="0.7"
        />
        <text
          x={courtWidth - 60}
          y={serviceLineY - 8}
          fill="#707070"
          fontSize="10"
          fontFamily="Barlow Condensed"
        >
          SERVICE
        </text>
        
        {/* Short line (T-line) */}
        <line
          x1="4"
          y1={shortLineY}
          x2={courtWidth - 4}
          y2={shortLineY}
          stroke="#FFDA00"
          strokeWidth="3"
        />
        
        {/* Center line */}
        <line
          x1={courtWidth / 2}
          y1="4"
          x2={courtWidth / 2}
          y2={shortLineY}
          stroke="#FFDA00"
          strokeWidth="3"
        />
        
        {/* Service boxes */}
        <rect
          x="4"
          y="4"
          width={courtWidth / 2 - 4}
          height={shortLineY - 4}
          fill="transparent"
          stroke="#FFDA00"
          strokeWidth="2"
          opacity="0.5"
        />
        <rect
          x={courtWidth / 2}
          y="4"
          width={courtWidth / 2 - 4}
          height={shortLineY - 4}
          fill="transparent"
          stroke="#FFDA00"
          strokeWidth="2"
          opacity="0.5"
        />
        
        {/* T-zone marker */}
        <circle
          cx={courtWidth / 2}
          cy={shortLineY}
          r="12"
          fill="rgba(255, 218, 0, 0.2)"
          stroke="#FFDA00"
          strokeWidth="2"
        />
        <text
          x={courtWidth / 2}
          y={shortLineY + 4}
          textAnchor="middle"
          fill="#FFDA00"
          fontSize="10"
          fontFamily="Barlow Condensed"
          fontWeight="bold"
        >
          T
        </text>
        
        {/* Quarter markers */}
        <text
          x={courtWidth / 4}
          y={shortLineY / 2}
          textAnchor="middle"
          fill="#505050"
          fontSize="14"
          fontFamily="Barlow Condensed"
          letterSpacing="2"
        >
          IZQUIERDA
        </text>
        <text
          x={(courtWidth / 4) * 3}
          y={shortLineY / 2}
          textAnchor="middle"
          fill="#505050"
          fontSize="14"
          fontFamily="Barlow Condensed"
          letterSpacing="2"
        >
          DERECHA
        </text>
        
        {/* Front zone label */}
        <text
          x={courtWidth / 2}
          y={courtHeight - tinHeight - 30}
          textAnchor="middle"
          fill="#505050"
          fontSize="12"
          fontFamily="Barlow Condensed"
          letterSpacing="4"
        >
          PARED FRONTAL
        </text>
        
        {/* Back zone label */}
        <text
          x={courtWidth / 2}
          y={30}
          textAnchor="middle"
          fill="#505050"
          fontSize="12"
          fontFamily="Barlow Condensed"
          letterSpacing="4"
        >
          PARED TRASERA
        </text>
        
        {/* Points/Balls on court */}
        {points.slice(0, currentStep).map((point, index) => {
          const x = point.position_x * (courtWidth - 40) + 20;
          const y = (1 - point.position_y) * (courtHeight - tinHeight - 40) + 20;
          const isWinner = point.winner_player_id === myPlayerId;
          const isHighlighted = highlightedPoint === point.point_id || index === currentStep - 1;
          
          return (
            <SquashBall
              key={point.point_id || index}
              x={x}
              y={y}
              number={point.point_number || index + 1}
              isWinner={isWinner}
              isHighlighted={isHighlighted}
              isVisible={true}
              onClick={() => onPointClick && onPointClick(point)}
              reason={point.reason}
            />
          );
        })}
        
        {/* Trail lines connecting points */}
        {currentStep > 1 && points.slice(0, currentStep).map((point, index) => {
          if (index === 0) return null;
          const prevPoint = points[index - 1];
          const x1 = prevPoint.position_x * (courtWidth - 40) + 20;
          const y1 = (1 - prevPoint.position_y) * (courtHeight - tinHeight - 40) + 20;
          const x2 = point.position_x * (courtWidth - 40) + 20;
          const y2 = (1 - point.position_y) * (courtHeight - tinHeight - 40) + 20;
          
          return (
            <line
              key={`trail-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255, 218, 0, 0.2)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-squash-ball border-2 border-green-500 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-brand-yellow"></div>
          </div>
          <span className="text-brand-gray font-body">Punto ganado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-squash-ball border-2 border-red-500 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-brand-yellow"></div>
          </div>
          <span className="text-brand-gray font-body">Punto perdido</span>
        </div>
      </div>
      
      {/* Speed control */}
      {points.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-brand-gray font-heading text-xs uppercase">Velocidad:</span>
          <div className="flex gap-2">
            {[2000, 1000, 500].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-3 py-1 rounded text-xs font-heading uppercase ${
                  playSpeed === speed
                    ? 'bg-brand-yellow text-brand-black'
                    : 'bg-brand-dark-gray text-brand-gray border border-white/20 hover:border-brand-yellow'
                }`}
              >
                {speed === 2000 ? 'Lento' : speed === 1000 ? 'Normal' : 'Rápido'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SquashCourt;
