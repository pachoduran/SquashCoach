import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

// Court image URL
const COURT_IMAGE = 'https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png';

export const SquashCourt = ({ points = [], onPointClick, highlightedPoint, myPlayerId }) => {
  const [currentStep, setCurrentStep] = useState(points.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const [imageLoaded, setImageLoaded] = useState(false);
  
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

  const handlePause = () => setIsPlaying(false);
  const handleReset = () => { setIsPlaying(false); setCurrentStep(0); };
  const handleStepForward = () => { setIsPlaying(false); setCurrentStep(prev => Math.min(prev + 1, points.length)); };
  const handleStepBack = () => { setIsPlaying(false); setCurrentStep(prev => Math.max(prev - 1, 0)); };
  const handleSliderChange = (value) => { setIsPlaying(false); setCurrentStep(value[0]); };

  const getCurrentScore = () => {
    if (currentStep === 0 || points.length === 0) return { p1: 0, p2: 0 };
    const currentPoint = points[currentStep - 1];
    return { p1: currentPoint?.player1_score || 0, p2: currentPoint?.player2_score || 0 };
  };

  const score = getCurrentScore();
  const visiblePoints = points.slice(0, currentStep);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Playback Controls */}
      {points.length > 0 && (
        <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-brand-gray font-heading text-xs uppercase tracking-wide">
              Reproducción de puntos
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white font-heading text-lg">{currentStep}</span>
              <span className="text-brand-gray">/</span>
              <span className="text-brand-gray font-heading">{points.length}</span>
            </div>
          </div>

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

          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-button"
              className="text-brand-gray hover:text-white hover:bg-white/10">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleStepBack} disabled={currentStep === 0}
              data-testid="step-back-button" className="text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
              <SkipBack className="w-4 h-4" />
            </Button>
            {isPlaying ? (
              <Button onClick={handlePause} data-testid="pause-button"
                className="bg-brand-yellow text-brand-black hover:bg-brand-yellow/90 px-6">
                <Pause className="w-5 h-5" />
              </Button>
            ) : (
              <Button onClick={handlePlay} data-testid="play-button"
                className="bg-brand-yellow text-brand-black hover:bg-brand-yellow/90 px-6">
                <Play className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleStepForward} disabled={currentStep >= points.length}
              data-testid="step-forward-button" className="text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {currentStep > 0 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <span className="text-brand-gray font-heading text-xs uppercase">Marcador:</span>
              <span className="font-heading text-2xl text-white">{score.p1} - {score.p2}</span>
            </div>
          )}

          {currentStep > 0 && points[currentStep - 1] && (
            <div className="mt-3 text-center">
              <span className={`text-sm font-body ${
                points[currentStep - 1].winner_player_id === myPlayerId ? 'text-green-500' : 'text-red-500'
              }`}>
                {points[currentStep - 1].reason || 'Punto'} - 
                {points[currentStep - 1].winner_player_id === myPlayerId ? ' ¡Ganado!' : ' Perdido'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Court with Image Background */}
      <div 
        className="relative w-full rounded-lg overflow-hidden border-4 border-black"
        style={{ aspectRatio: '1/1' }}
        data-testid="squash-court-container"
      >
        {/* Court Background Image */}
        <img 
          src={COURT_IMAGE}
          alt="Cancha de Squash"
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setImageLoaded(true)}
        />
        
        {/* Trail lines connecting points */}
        {imageLoaded && visiblePoints.length > 1 && (
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {visiblePoints.map((point, index) => {
              if (index === 0) return null;
              const prev = visiblePoints[index - 1];
              return (
                <line
                  key={`trail-${index}`}
                  x1={prev.position_x * 100}
                  y1={prev.position_y * 100}
                  x2={point.position_x * 100}
                  y2={point.position_y * 100}
                  stroke="rgba(255, 218, 0, 0.5)"
                  strokeWidth="0.5"
                  strokeDasharray="2,1"
                />
              );
            })}
          </svg>
        )}

        {/* Balls overlay */}
        {imageLoaded && visiblePoints.map((point, index) => {
          const isWinner = point.winner_player_id === myPlayerId;
          const isHighlighted = highlightedPoint === point.point_id || index === currentStep - 1;
          const size = isHighlighted ? 32 : 26;
          
          return (
            <div
              key={point.point_id || `ball-${index}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200"
              style={{
                left: `${point.position_x * 100}%`,
                top: `${point.position_y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: isHighlighted ? 20 : 10 + index
              }}
              onClick={() => onPointClick && onPointClick(point)}
              data-testid={`ball-${index}`}
            >
              {/* Ball shadow */}
              <div 
                className="absolute rounded-full bg-black/40"
                style={{
                  width: '90%',
                  height: '30%',
                  bottom: '-15%',
                  left: '5%',
                  filter: 'blur(2px)'
                }}
              />
              
              {/* Ball body */}
              <div 
                className={`absolute inset-0 rounded-full flex items-center justify-center ${
                  isHighlighted ? 'ring-2 ring-white ring-offset-1' : ''
                }`}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d 50%, #1a1a1a)',
                  border: `3px solid ${isWinner ? '#22C55E' : '#EF4444'}`,
                  boxShadow: isHighlighted ? `0 0 10px ${isWinner ? '#22C55E' : '#EF4444'}` : 'none'
                }}
              >
                {/* Yellow dots - squash ball characteristic */}
                <div 
                  className="absolute w-2 h-2 rounded-full bg-yellow-400"
                  style={{ top: '20%', left: '15%' }}
                />
                <div 
                  className="absolute w-2 h-2 rounded-full bg-yellow-400"
                  style={{ bottom: '20%', right: '15%' }}
                />
                
                {/* Point number */}
                <span className="text-white font-bold text-xs z-10">
                  {point.point_number || index + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6">
            <div 
              className="absolute inset-0 rounded-full border-2 border-green-500"
              style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }}
            >
              <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ top: '15%', left: '10%' }} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ bottom: '15%', right: '10%' }} />
            </div>
          </div>
          <span className="text-brand-gray font-body">Punto ganado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6">
            <div 
              className="absolute inset-0 rounded-full border-2 border-red-500"
              style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }}
            >
              <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ top: '15%', left: '10%' }} />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ bottom: '15%', right: '10%' }} />
            </div>
          </div>
          <span className="text-brand-gray font-body">Punto perdido</span>
        </div>
      </div>
      
      {/* Speed control */}
      {points.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <span className="text-brand-gray font-heading text-xs uppercase">Velocidad:</span>
          <div className="flex gap-2">
            {[{ speed: 2000, label: 'Lento' }, { speed: 1000, label: 'Normal' }, { speed: 500, label: 'Rápido' }].map(({ speed, label }) => (
              <button key={speed} onClick={() => setPlaySpeed(speed)} data-testid={`speed-${speed}`}
                className={`px-3 py-1 rounded text-xs font-heading uppercase transition-all ${
                  playSpeed === speed
                    ? 'bg-brand-yellow text-brand-black'
                    : 'bg-brand-dark-gray text-brand-gray border border-white/20 hover:border-brand-yellow'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SquashCourt;
