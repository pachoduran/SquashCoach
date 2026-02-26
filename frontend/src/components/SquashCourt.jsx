import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

const COURT_IMAGE = 'https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png';

export const SquashCourt = ({ 
  points = [], 
  onPointClick, 
  highlightedPoint, 
  myPlayerId,
  matchPlayer1Id,
  player1Name = 'Jugador 1',
  player2Name = 'Jugador 2',
  matchScore = null,
  tournamentName = null,
  isWinner = null,
  gameNumber = 1
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

  const visiblePoints = points.slice(0, currentStep);
  const currentPointIndex = currentStep - 1;
  const currentPoint = currentStep > 0 ? points[currentStep - 1] : null;

  const totalPoints = points.length;

  const getCurrentScores = () => {
    if (currentStep === 0) return { p1: 0, p2: 0 };
    const point = points[currentStep - 1];
    return { p1: point?.player1_score || 0, p2: point?.player2_score || 0 };
  };
  const scores = getCurrentScores();

  // Create full timeline
  const fullTimeline = points.map((point, idx) => {
    const wonByPlayer1 = point.winner_player_id === myPlayerId;
    const isReached = idx < currentStep;
    const isCurrent = idx === currentPointIndex;
    
    return {
      pointIndex: idx,
      wonByPlayer1,
      player1Score: wonByPlayer1 ? point.player1_score : null,
      player2Score: !wonByPlayer1 ? point.player2_score : null,
      isReached,
      isCurrent
    };
  });

  // Calculate circle size based on total points to fit in one line
  const circleSize = totalPoints <= 11 ? 24 : totalPoints <= 15 ? 20 : 18;
  const fontSize = totalPoints <= 11 ? 'text-xs' : 'text-[10px]';

  return (
    <div className="relative w-full max-w-2xl mx-auto px-2">
      {/* Scoreboard - FULL WIDTH, Single Line */}
      <div className="bg-brand-black rounded-lg overflow-hidden mb-2 border border-white/10">
        {/* Header */}
        <div className="bg-brand-dark-gray px-3 py-1 flex items-center justify-between">
          <span className="text-white font-heading text-xs uppercase tracking-wider">
            Game {gameNumber}
          </span>
          {tournamentName && (
            <span className="text-white/50 font-body text-[10px] truncate">{tournamentName}</span>
          )}
        </div>

        {/* Player 1 Row - Single horizontal line */}
        <div className="flex items-center px-2 py-2 border-b border-white/10">
          {/* Score */}
          <div className="w-8 text-center">
            <span className="font-heading text-lg font-bold text-brand-yellow">
              {scores.p1}
            </span>
          </div>
          
          {/* Player Name */}
          <div className="w-16 px-1">
            <span className="text-brand-yellow font-heading text-[10px] uppercase tracking-wide truncate block">
              {player1Name}
            </span>
          </div>
          
          {/* Timeline - single line */}
          <div className="flex-1 flex items-center justify-start gap-0.5">
            {fullTimeline.map((point, idx) => {
              let bgColor, textColor, borderStyle;
              
              if (point.wonByPlayer1) {
                if (point.isCurrent) {
                  bgColor = 'bg-brand-yellow';
                  textColor = 'text-brand-black';
                  borderStyle = 'ring-2 ring-white';
                } else if (point.isReached) {
                  bgColor = 'bg-green-600';
                  textColor = 'text-white';
                  borderStyle = '';
                } else {
                  bgColor = 'bg-gray-700';
                  textColor = 'text-gray-500';
                  borderStyle = '';
                }
                return (
                  <div key={idx} 
                    className={`rounded-full flex items-center justify-center font-heading font-bold transition-all duration-300 ${bgColor} ${textColor} ${borderStyle} ${fontSize}`}
                    style={{ width: `${circleSize}px`, height: `${circleSize}px`, minWidth: `${circleSize}px` }}>
                    {point.player1Score}
                  </div>
                );
              } else {
                // Empty circle for opponent's point
                return (
                  <div key={idx} 
                    className="rounded-full border border-white/20"
                    style={{ width: `${circleSize}px`, height: `${circleSize}px`, minWidth: `${circleSize}px` }}>
                  </div>
                );
              }
            })}
          </div>
        </div>

        {/* Player 2 Row - Single horizontal line */}
        <div className="flex items-center px-2 py-2">
          {/* Score */}
          <div className="w-8 text-center">
            <span className="font-heading text-lg font-bold text-white">
              {scores.p2}
            </span>
          </div>
          
          {/* Player Name */}
          <div className="w-16 px-1">
            <span className="text-white/70 font-heading text-[10px] uppercase tracking-wide truncate block">
              {player2Name}
            </span>
          </div>
          
          {/* Timeline - single line */}
          <div className="flex-1 flex items-center justify-start gap-0.5">
            {fullTimeline.map((point, idx) => {
              let bgColor, textColor, borderStyle;
              
              if (!point.wonByPlayer1) {
                if (point.isCurrent) {
                  bgColor = 'bg-red-500';
                  textColor = 'text-white';
                  borderStyle = 'ring-2 ring-white';
                } else if (point.isReached) {
                  bgColor = 'bg-red-600/80';
                  textColor = 'text-white';
                  borderStyle = '';
                } else {
                  bgColor = 'bg-gray-700';
                  textColor = 'text-gray-500';
                  borderStyle = '';
                }
                return (
                  <div key={idx} 
                    className={`rounded-full flex items-center justify-center font-heading font-bold transition-all duration-300 ${bgColor} ${textColor} ${borderStyle} ${fontSize}`}
                    style={{ width: `${circleSize}px`, height: `${circleSize}px`, minWidth: `${circleSize}px` }}>
                    {point.player2Score}
                  </div>
                );
              } else {
                // Empty circle for player 1's point
                return (
                  <div key={idx} 
                    className="rounded-full border border-white/20"
                    style={{ width: `${circleSize}px`, height: `${circleSize}px`, minWidth: `${circleSize}px` }}>
                  </div>
                );
              }
            })}
          </div>
        </div>
      </div>

      {/* Playback Controls - compact */}
      {points.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-button"
              className="h-7 w-7 p-0 text-brand-gray hover:text-white hover:bg-white/10">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleStepBack} disabled={currentStep === 0}
              data-testid="step-back-button" className="h-7 w-7 p-0 text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
              <SkipBack className="w-3.5 h-3.5" />
            </Button>
            {isPlaying ? (
              <Button onClick={handlePause} data-testid="pause-button" size="sm"
                className="h-7 px-3 bg-brand-yellow text-brand-black hover:bg-brand-yellow/90">
                <Pause className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button onClick={handlePlay} data-testid="play-button" size="sm"
                className="h-7 px-3 bg-brand-yellow text-brand-black hover:bg-brand-yellow/90">
                <Play className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleStepForward} disabled={currentStep >= points.length}
              data-testid="step-forward-button" className="h-7 w-7 p-0 text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
              <SkipForward className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-brand-gray text-[10px]">{currentStep}/{points.length}</span>
            {currentPoint && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                currentPoint.winner_player_id === myPlayerId 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {currentPoint.reason || 'Punto'}
              </span>
            )}
          </div>

          <div className="flex gap-0.5">
            {[{ speed: 2000, label: '1x' }, { speed: 1000, label: '2x' }, { speed: 500, label: '3x' }].map(({ speed, label }) => (
              <button key={speed} onClick={() => setPlaySpeed(speed)} data-testid={`speed-${speed}`}
                className={`px-1.5 py-0.5 rounded text-[9px] font-heading transition-all ${
                  playSpeed === speed ? 'bg-brand-yellow text-brand-black' : 'text-brand-gray hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Court */}
      <div 
        className="relative w-full rounded-lg overflow-hidden border-2 border-black mx-auto"
        style={{ aspectRatio: '713/1000', maxWidth: '350px' }}
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
                  stroke="rgba(255, 218, 0, 0.3)" strokeWidth="0.3" strokeDasharray="1.5,1"
                />
              );
            })}
          </svg>
        )}

        {/* Balls */}
        {imageLoaded && points.map((point, index) => {
          const isWon = point.winner_player_id === myPlayerId;
          const isReached = index < currentStep;
          const isCurrent = index === currentPointIndex;
          const size = isCurrent ? 28 : 20;
          
          const displayScore = isWon ? point.player1_score : point.player2_score;
          
          let borderColor, bgGradient, opacity;
          if (isCurrent) {
            borderColor = '#FFDA00';
            bgGradient = 'radial-gradient(circle at 30% 30%, #5a5a5a, #3a3a3a 50%, #2a2a2a)';
            opacity = 1;
          } else if (isReached) {
            borderColor = isWon ? '#22C55E' : '#EF4444';
            bgGradient = 'radial-gradient(circle at 30% 30%, #4a4a4a, #2d2d2d 50%, #1a1a1a)';
            opacity = 0.9;
          } else {
            borderColor = '#555555';
            bgGradient = 'radial-gradient(circle at 30% 30%, #3a3a3a, #2a2a2a 50%, #1a1a1a)';
            opacity = 0.35;
          }
          
          return (
            <div key={point.point_id || `ball-${index}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{
                left: `${point.position_x * 100}%`,
                top: `${point.position_y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: isCurrent ? 30 : isReached ? 15 + index : 5,
                opacity
              }}
              onClick={() => onPointClick && onPointClick(point)}
              data-testid={`ball-${index}`}
            >
              {isReached && (
                <div className="absolute rounded-full bg-black/40" 
                  style={{ width: '85%', height: '20%', bottom: '-10%', left: '7.5%', filter: 'blur(2px)' }} 
                />
              )}
              
              <div 
                className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: bgGradient,
                  border: `${isCurrent ? 3 : 2}px solid ${borderColor}`,
                  boxShadow: isCurrent ? `0 0 10px rgba(255, 218, 0, 0.6)` : 'none'
                }}
              >
                <div className="absolute w-1 h-1 rounded-full" 
                  style={{ top: '15%', left: '15%', backgroundColor: isReached ? '#facc15' : '#555' }} />
                <div className="absolute w-1 h-1 rounded-full" 
                  style={{ bottom: '15%', right: '15%', backgroundColor: isReached ? '#facc15' : '#555' }} />
                
                <span className={`font-bold z-10 transition-all duration-300 ${
                  isCurrent ? 'text-brand-yellow text-xs' : isReached ? 'text-white text-[9px]' : 'text-gray-600 text-[9px]'
                }`}>
                  {displayScore}
                </span>
              </div>
              
              {isCurrent && (
                <div className="absolute inset-[-3px] rounded-full animate-ping"
                  style={{ border: '2px solid #FFDA00', opacity: 0.4 }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-3 mt-2 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-brand-yellow flex items-center justify-center">
            <span className="text-[7px] text-brand-black font-bold">3</span>
          </div>
          <span className="text-brand-gray">Actual</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center">
            <span className="text-[7px] text-white font-bold">2</span>
          </div>
          <span className="text-brand-gray">Ganado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-[7px] text-white font-bold">1</span>
          </div>
          <span className="text-brand-gray">Perdido</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-[7px] text-gray-500 font-bold">?</span>
          </div>
          <span className="text-brand-gray">Pendiente</span>
        </div>
      </div>
    </div>
  );
};

export default SquashCourt;
