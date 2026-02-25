import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

export const SquashCourt = ({ points = [], onPointClick, highlightedPoint, myPlayerId }) => {
  const [currentStep, setCurrentStep] = useState(points.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  
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
  const visiblePoints = points.slice(0, currentStep);
  
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
        {/* Definitions for gradients */}
        <defs>
          <pattern id="courtPattern" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#1A1A1A"/>
            <rect width="10" height="10" fill="#1C1C1C"/>
            <rect x="10" y="10" width="10" height="10" fill="#1C1C1C"/>
          </pattern>
          <radialGradient id="ballGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#4A4A4A" />
            <stop offset="50%" stopColor="#2A2A2A" />
            <stop offset="100%" stopColor="#1A1A1A" />
          </radialGradient>
        </defs>
        
        {/* Court floor */}
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
        
        {/* Trail lines connecting points */}
        {visiblePoints.length > 1 && visiblePoints.map((point, index) => {
          if (index === 0) return null;
          const prevPoint = visiblePoints[index - 1];
          const usableHeight = courtHeight - tinHeight - 60;
          const x1 = prevPoint.position_x * (courtWidth - 80) + 40;
          const y1 = prevPoint.position_y * usableHeight + 50;
          const x2 = point.position_x * (courtWidth - 80) + 40;
          const y2 = point.position_y * usableHeight + 50;
          
          return (
            <line
              key={`trail-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(255, 218, 0, 0.3)"
              strokeWidth="2"
              strokeDasharray="6,4"
            />
          );
        })}
        
        {/* Points/Balls on court */}
        {visiblePoints.length > 0 && (
          <text x="320" y="100" fill="#FF0000" fontSize="20">
            Puntos: {visiblePoints.length}
          </text>
        )}
        {visiblePoints.map((point, index) => {
          // Calculate position: x = 0 to 1 maps to court width, y = 0 to 1 maps to court height (excluding tin)
          const usableHeight = courtHeight - tinHeight - 60;
          const x = point.position_x * (courtWidth - 80) + 40;
          const y = point.position_y * usableHeight + 50;
          const isWinner = point.winner_player_id === myPlayerId;
          const isHighlighted = highlightedPoint === point.point_id || index === currentStep - 1;
          const ballSize = isHighlighted ? 32 : 26;
          const halfSize = ballSize / 2;
          
          return (
            <g
              key={point.point_id || `point-${index}`}
              onClick={() => onPointClick && onPointClick(point)}
              style={{ cursor: 'pointer' }}
            >
              {/* Shadow */}
              <ellipse
                cx={x + 2}
                cy={y + halfSize + 2}
                rx={halfSize * 0.7}
                ry={4}
                fill="rgba(0,0,0,0.4)"
              />
              
              {/* Ball base */}
              <circle
                cx={x}
                cy={y}
                r={halfSize}
                fill="#2A2A2A"
                stroke={isHighlighted ? '#FFFFFF' : (isWinner ? '#22C55E' : '#EF4444')}
                strokeWidth={isHighlighted ? 3 : 2}
              />
              
              {/* Ball inner (3D effect) */}
              <circle
                cx={x}
                cy={y}
                r={halfSize - 2}
                fill="url(#ballGradient)"
              />
              
              {/* Two yellow dots - characteristic of squash balls */}
              <circle
                cx={x - halfSize * 0.35}
                cy={y - halfSize * 0.2}
                r={3}
                fill="#FFDA00"
              />
              <circle
                cx={x + halfSize * 0.3}
                cy={y + halfSize * 0.25}
                r={3}
                fill="#FFDA00"
              />
              
              {/* Point number */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="11"
                fontFamily="Barlow Condensed"
                fontWeight="bold"
              >
                {point.point_number || index + 1}
              </text>
              
              {/* Highlight pulse ring */}
              {isHighlighted && (
                <circle
                  cx={x}
                  cy={y}
                  r={halfSize + 8}
                  fill="none"
                  stroke={isWinner ? '#22C55E' : '#EF4444'}
                  strokeWidth="2"
                  opacity="0.5"
                  strokeDasharray="4,4"
                />
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full bg-squash-ball border-2 border-green-500"></div>
            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-brand-yellow"></div>
            <div className="absolute bottom-1.5 right-1 w-1.5 h-1.5 rounded-full bg-brand-yellow"></div>
          </div>
          <span className="text-brand-gray font-body">Punto ganado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full bg-squash-ball border-2 border-red-500"></div>
            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-brand-yellow"></div>
            <div className="absolute bottom-1.5 right-1 w-1.5 h-1.5 rounded-full bg-brand-yellow"></div>
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
                data-testid={`speed-${speed}`}
                className={`px-3 py-1 rounded text-xs font-heading uppercase transition-all ${
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
