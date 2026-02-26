import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

const COURT_IMAGE = 'https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png';

export const SquashCourt = ({ 
  points = [], 
  onPointClick, 
  highlightedPoint, 
  myPlayerId,
  player1Name = 'Jugador 1',
  player2Name = 'Jugador 2',
  matchScore = null, // { p1: 3, p2: 1 }
  tournamentName = null,
  isWinner = null
}) => {
  const [currentStep, setCurrentStep] = useState(points.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  useEffect(() => {
    if (isPlaying && currentStep < points.length) {
      const timer = setTimeout(() => setCurrentStep(prev => prev + 1), playSpeed);
      return () => clearTimeout(timer);
    } else if (currentStep >= points.length) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentStep, points.length, playSpeed]);

  useEffect(() => {
    setCurrentStep(points.length);
    setIsPlaying(false);
  }, [points.length]);

  const handlePlay = () => { if (currentStep >= points.length) setCurrentStep(0); setIsPlaying(true); };
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
  const currentPointInfo = currentStep > 0 ? points[currentStep - 1] : null;

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Compact Header with Match Info + Controls */}
      <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-3 mb-3">
        {/* Players + Match Score Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 text-left">
            <p className="font-heading text-sm text-white uppercase tracking-wide truncate">
              {player1Name}
            </p>
            {isWinner === true && (
              <span className="text-[10px] text-green-500 font-heading uppercase">Ganador</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 px-3">
            {matchScore && (
              <div className="flex items-center gap-1">
                <span className="font-heading text-xl font-bold text-brand-yellow">{matchScore.p1}</span>
                <span className="text-brand-gray text-sm">-</span>
                <span className="font-heading text-xl font-bold text-white">{matchScore.p2}</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 text-right">
            <p className="font-heading text-sm text-white uppercase tracking-wide truncate">
              {player2Name}
            </p>
            {isWinner === false && (
              <span className="text-[10px] text-green-500 font-heading uppercase">Ganador</span>
            )}
          </div>
        </div>

        {/* Tournament */}
        {tournamentName && (
          <p className="text-center text-brand-gray text-xs font-body mb-2 truncate">{tournamentName}</p>
        )}

        {/* Divider */}
        <div className="border-t border-white/10 my-2"></div>

        {/* Controls Row */}
        {points.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              {/* Slider */}
              <div className="flex-1">
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
              {/* Counter */}
              <span className="text-white font-heading text-sm min-w-[40px] text-right">
                {currentStep}/{points.length}
              </span>
            </div>

            {/* Buttons + Current Point Score */}
            <div className="flex items-center justify-between">
              {/* Control Buttons */}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-button"
                  className="h-8 w-8 p-0 text-brand-gray hover:text-white hover:bg-white/10">
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleStepBack} disabled={currentStep === 0}
                  data-testid="step-back-button" className="h-8 w-8 p-0 text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
                  <SkipBack className="w-3.5 h-3.5" />
                </Button>
                {isPlaying ? (
                  <Button onClick={handlePause} data-testid="pause-button" size="sm"
                    className="h-8 px-4 bg-brand-yellow text-brand-black hover:bg-brand-yellow/90">
                    <Pause className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={handlePlay} data-testid="play-button" size="sm"
                    className="h-8 px-4 bg-brand-yellow text-brand-black hover:bg-brand-yellow/90">
                    <Play className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleStepForward} disabled={currentStep >= points.length}
                  data-testid="step-forward-button" className="h-8 w-8 p-0 text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
                  <SkipForward className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Current Point Info */}
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <>
                    <span className="font-heading text-lg text-white">{score.p1} - {score.p2}</span>
                    {currentPointInfo && (
                      <span className={`text-xs font-body ${
                        currentPointInfo.winner_player_id === myPlayerId ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {currentPointInfo.reason || 'Punto'}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Speed */}
              <div className="flex gap-1">
                {[{ speed: 2000, label: '1x' }, { speed: 1000, label: '2x' }, { speed: 500, label: '3x' }].map(({ speed, label }) => (
                  <button key={speed} onClick={() => setPlaySpeed(speed)} data-testid={`speed-${speed}`}
                    className={`px-2 py-1 rounded text-[10px] font-heading uppercase transition-all ${
                      playSpeed === speed
                        ? 'bg-brand-yellow text-brand-black'
                        : 'text-brand-gray hover:text-white'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Court with Image Background - maintains 713:1000 aspect ratio */}
      <div 
        className="relative w-full rounded-lg overflow-hidden border-2 border-black"
        style={{ aspectRatio: '713/1000' }}
        data-testid="squash-court-container"
      >
        <img 
          src={COURT_IMAGE}
          alt="Cancha de Squash"
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={() => setImageLoaded(true)}
        />
        
        {/* Trail lines */}
        {imageLoaded && visiblePoints.length > 1 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {visiblePoints.map((point, index) => {
              if (index === 0) return null;
              const prev = visiblePoints[index - 1];
              return (
                <line key={`trail-${index}`}
                  x1={prev.position_x * 100} y1={prev.position_y * 100}
                  x2={point.position_x * 100} y2={point.position_y * 100}
                  stroke="rgba(255, 218, 0, 0.5)" strokeWidth="0.5" strokeDasharray="2,1"
                />
              );
            })}
          </svg>
        )}

        {/* Balls */}
        {imageLoaded && visiblePoints.map((point, index) => {
          const isWon = point.winner_player_id === myPlayerId;
          const isHighlighted = highlightedPoint === point.point_id || index === currentStep - 1;
          const size = isHighlighted ? 28 : 22;
          
          return (
            <div key={point.point_id || `ball-${index}`}
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
              <div className="absolute rounded-full bg-black/40" style={{ width: '90%', height: '25%', bottom: '-12%', left: '5%', filter: 'blur(2px)' }} />
              <div className={`absolute inset-0 rounded-full flex items-center justify-center ${isHighlighted ? 'ring-2 ring-white' : ''}`}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d 50%, #1a1a1a)',
                  border: `2px solid ${isWon ? '#22C55E' : '#EF4444'}`,
                  boxShadow: isHighlighted ? `0 0 8px ${isWon ? '#22C55E' : '#EF4444'}` : 'none'
                }}>
                <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ top: '18%', left: '12%' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ bottom: '18%', right: '12%' }} />
                <span className="text-white font-bold text-[10px] z-10">{point.point_number || index + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Compact Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-green-500" style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }} />
          <span className="text-brand-gray">Ganado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-red-500" style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }} />
          <span className="text-brand-gray">Perdido</span>
        </div>
      </div>
    </div>
  );
};

export default SquashCourt;
