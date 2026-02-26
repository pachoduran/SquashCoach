import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';

const COURT_IMAGE = 'https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png';

export const SquashCourt = ({ 
  points = [], 
  onPointClick, 
  highlightedPoint, 
  myPlayerId,
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

  // Calculate scores at current step
  const getCurrentScores = () => {
    if (currentStep === 0) return { p1: 0, p2: 0 };
    const point = points[currentStep - 1];
    return { p1: point?.player1_score || 0, p2: point?.player2_score || 0 };
  };
  const scores = getCurrentScores();

  // Get point sequence for each player (which point numbers they won)
  const getPlayerPointSequence = (playerId) => {
    return points
      .slice(0, currentStep)
      .map((p, idx) => ({ ...p, originalIndex: idx }))
      .filter(p => p.winner_player_id === playerId)
      .map(p => p.point_number || p.originalIndex + 1);
  };

  const player1Points = getPlayerPointSequence(myPlayerId);
  const player2Points = points
    .slice(0, currentStep)
    .map((p, idx) => ({ ...p, originalIndex: idx }))
    .filter(p => p.winner_player_id !== myPlayerId)
    .map(p => p.point_number || p.originalIndex + 1);

  // Check if a point number is the current one being viewed
  const isCurrentPoint = (pointNum) => {
    return currentPoint && (currentPoint.point_number || currentPointIndex + 1) === pointNum;
  };

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Scoreboard - Broadcast Style */}
      <div className="bg-[#2a3a3a]/95 rounded-lg overflow-hidden mb-3 border border-white/10">
        {/* Header */}
        <div className="bg-[#3a4a4a] px-3 py-1.5 flex items-center justify-between">
          <span className="text-white/80 font-heading text-xs uppercase tracking-wider">
            Game {gameNumber} Points
          </span>
          {tournamentName && (
            <span className="text-white/50 font-body text-[10px] truncate ml-2">{tournamentName}</span>
          )}
        </div>

        {/* Player 1 Row (My Player) */}
        <div className={`flex items-center px-2 py-2 border-b border-white/10 ${isWinner ? 'bg-brand-yellow/10' : ''}`}>
          {/* Player Name */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="w-1 h-8 bg-brand-yellow rounded-full"></div>
            <span className="text-white font-heading text-sm uppercase tracking-wide truncate">
              {player1Name}
            </span>
          </div>
          
          {/* Point Sequence */}
          <div className="flex-1 flex items-center gap-1 px-2 overflow-x-auto">
            {player1Points.map((pointNum, idx) => (
              <span 
                key={idx}
                className={`min-w-[20px] h-5 flex items-center justify-center rounded text-xs font-heading
                  ${isCurrentPoint(pointNum) 
                    ? 'bg-brand-yellow text-brand-black font-bold scale-110' 
                    : 'bg-white/20 text-white/80'
                  } transition-all duration-200`}
              >
                {pointNum}
              </span>
            ))}
          </div>
          
          {/* Score */}
          <div className="min-w-[40px] text-right">
            <span className={`font-heading text-2xl font-bold ${isWinner ? 'text-brand-yellow' : 'text-white'}`}>
              {scores.p1}
            </span>
          </div>
        </div>

        {/* Player 2 Row (Opponent) */}
        <div className={`flex items-center px-2 py-2 ${!isWinner ? 'bg-brand-yellow/10' : ''}`}>
          {/* Player Name */}
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="w-1 h-8 bg-white/50 rounded-full"></div>
            <span className="text-white font-heading text-sm uppercase tracking-wide truncate">
              {player2Name}
            </span>
          </div>
          
          {/* Point Sequence */}
          <div className="flex-1 flex items-center gap-1 px-2 overflow-x-auto">
            {player2Points.map((pointNum, idx) => (
              <span 
                key={idx}
                className={`min-w-[20px] h-5 flex items-center justify-center rounded text-xs font-heading
                  ${isCurrentPoint(pointNum) 
                    ? 'bg-red-500 text-white font-bold scale-110' 
                    : 'bg-white/20 text-white/80'
                  } transition-all duration-200`}
              >
                {pointNum}
              </span>
            ))}
          </div>
          
          {/* Score */}
          <div className="min-w-[40px] text-right">
            <span className={`font-heading text-2xl font-bold ${!isWinner ? 'text-brand-yellow' : 'text-white'}`}>
              {scores.p2}
            </span>
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      {points.length > 0 && (
        <div className="flex items-center justify-between gap-2 mb-3 px-1">
          {/* Control Buttons */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="reset-button"
              className="h-8 w-8 p-0 text-brand-gray hover:text-white hover:bg-white/10">
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleStepBack} disabled={currentStep === 0}
              data-testid="step-back-button" className="h-8 w-8 p-0 text-brand-gray hover:text-white hover:bg-white/10 disabled:opacity-30">
              <SkipBack className="w-4 h-4" />
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
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Current Point Info */}
          <div className="flex items-center gap-2">
            <span className="text-brand-gray text-xs">{currentStep}/{points.length}</span>
            {currentPoint && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                currentPoint.winner_player_id === myPlayerId 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {currentPoint.reason || 'Punto'}
              </span>
            )}
          </div>

          {/* Speed Control */}
          <div className="flex gap-1">
            {[{ speed: 2000, label: '1x' }, { speed: 1000, label: '2x' }, { speed: 500, label: '3x' }].map(({ speed, label }) => (
              <button key={speed} onClick={() => setPlaySpeed(speed)} data-testid={`speed-${speed}`}
                className={`px-2 py-1 rounded text-[10px] font-heading transition-all ${
                  playSpeed === speed ? 'bg-brand-yellow text-brand-black' : 'text-brand-gray hover:text-white'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Court with Image Background */}
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
                  stroke="rgba(255, 218, 0, 0.4)" strokeWidth="0.4" strokeDasharray="2,1"
                />
              );
            })}
          </svg>
        )}

        {/* Balls */}
        {imageLoaded && visiblePoints.map((point, index) => {
          const isWon = point.winner_player_id === myPlayerId;
          const isCurrent = index === currentPointIndex;
          const size = isCurrent ? 32 : 22;
          
          // Colors: current point is bright yellow/cyan, others are green/red based on won/lost
          let borderColor, glowColor, bgOpacity;
          if (isCurrent) {
            borderColor = '#FFDA00'; // Bright yellow for current
            glowColor = 'rgba(255, 218, 0, 0.6)';
            bgOpacity = 1;
          } else {
            borderColor = isWon ? '#22C55E' : '#EF4444';
            glowColor = 'transparent';
            bgOpacity = 0.7;
          }
          
          return (
            <div key={point.point_id || `ball-${index}`}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300"
              style={{
                left: `${point.position_x * 100}%`,
                top: `${point.position_y * 100}%`,
                width: `${size}px`,
                height: `${size}px`,
                zIndex: isCurrent ? 30 : 10 + index,
                opacity: bgOpacity
              }}
              onClick={() => onPointClick && onPointClick(point)}
              data-testid={`ball-${index}`}
            >
              {/* Shadow */}
              <div className="absolute rounded-full bg-black/40" 
                style={{ width: '90%', height: '25%', bottom: '-12%', left: '5%', filter: 'blur(2px)' }} 
              />
              
              {/* Ball body */}
              <div 
                className={`absolute inset-0 rounded-full flex items-center justify-center transition-all duration-300`}
                style={{
                  background: isCurrent 
                    ? 'radial-gradient(circle at 30% 30%, #6a6a6a, #3d3d3d 50%, #2a2a2a)'
                    : 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d 50%, #1a1a1a)',
                  border: `${isCurrent ? 3 : 2}px solid ${borderColor}`,
                  boxShadow: isCurrent ? `0 0 15px ${glowColor}, 0 0 30px ${glowColor}` : 'none'
                }}
              >
                {/* Yellow dots */}
                <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ top: '18%', left: '12%' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400" style={{ bottom: '18%', right: '12%' }} />
                
                {/* Point number */}
                <span className={`font-bold z-10 ${isCurrent ? 'text-brand-yellow text-sm' : 'text-white text-[10px]'}`}>
                  {point.point_number || index + 1}
                </span>
              </div>
              
              {/* Pulse animation for current */}
              {isCurrent && (
                <div 
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ border: `2px solid ${borderColor}`, opacity: 0.5 }}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Compact Legend */}
      <div className="flex justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-brand-yellow" 
            style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)', boxShadow: '0 0 5px rgba(255,218,0,0.5)' }} 
          />
          <span className="text-brand-gray">Actual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-green-500" 
            style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }} 
          />
          <span className="text-brand-gray">Ganado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-red-500" 
            style={{ background: 'radial-gradient(circle at 30% 30%, #5a5a5a, #2d2d2d)' }} 
          />
          <span className="text-brand-gray">Perdido</span>
        </div>
      </div>
    </div>
  );
};

export default SquashCourt;
