import React from 'react';

export const SquashCourt = ({ points = [], onPointClick, highlightedPoint }) => {
  // Court dimensions based on standard squash court proportions
  // Real court: 9.75m x 6.4m (length x width)
  const courtWidth = 640;
  const courtHeight = 970;
  
  // Calculate positions based on real court dimensions
  const serviceLineY = courtHeight * 0.57; // Service line at 5.49m from front
  const shortLineY = courtHeight * 0.44; // Short line at 4.26m
  const tinHeight = 48; // Tin at bottom
  
  return (
    <div className="relative w-full max-w-md mx-auto">
      <svg
        viewBox={`0 0 ${courtWidth} ${courtHeight}`}
        className="w-full h-auto"
        style={{ backgroundColor: '#121212' }}
      >
        {/* Court floor */}
        <rect
          x="0"
          y="0"
          width={courtWidth}
          height={courtHeight}
          fill="#1A1A1A"
          stroke="#FFDA00"
          strokeWidth="4"
        />
        
        {/* Tin (bottom board) */}
        <rect
          x="0"
          y={courtHeight - tinHeight}
          width={courtWidth}
          height={tinHeight}
          fill="#333333"
          stroke="#FFDA00"
          strokeWidth="2"
        />
        <text
          x={courtWidth / 2}
          y={courtHeight - tinHeight / 2 + 5}
          textAnchor="middle"
          fill="#707070"
          fontSize="14"
          fontFamily="Barlow Condensed"
        >
          TIN
        </text>
        
        {/* Service line (horizontal) */}
        <line
          x1="0"
          y1={serviceLineY}
          x2={courtWidth}
          y2={serviceLineY}
          stroke="#FFDA00"
          strokeWidth="2"
          strokeDasharray="10,5"
        />
        
        {/* Short line (horizontal) */}
        <line
          x1="0"
          y1={shortLineY}
          x2={courtWidth}
          y2={shortLineY}
          stroke="#FFDA00"
          strokeWidth="2"
        />
        
        {/* Center line (vertical from short line to back) */}
        <line
          x1={courtWidth / 2}
          y1="0"
          x2={courtWidth / 2}
          y2={shortLineY}
          stroke="#FFDA00"
          strokeWidth="2"
        />
        
        {/* Left service box */}
        <rect
          x="0"
          y="0"
          width={courtWidth / 2}
          height={shortLineY}
          fill="transparent"
          stroke="#FFDA00"
          strokeWidth="2"
        />
        
        {/* Right service box */}
        <rect
          x={courtWidth / 2}
          y="0"
          width={courtWidth / 2}
          height={shortLineY}
          fill="transparent"
          stroke="#FFDA00"
          strokeWidth="2"
        />
        
        {/* T-zone marker */}
        <circle
          cx={courtWidth / 2}
          cy={shortLineY}
          r="8"
          fill="#FFDA00"
          opacity="0.5"
        />
        
        {/* Half court line labels */}
        <text
          x={courtWidth / 4}
          y={shortLineY / 2}
          textAnchor="middle"
          fill="#707070"
          fontSize="12"
          fontFamily="Barlow Condensed"
        >
          LEFT
        </text>
        <text
          x={(courtWidth / 4) * 3}
          y={shortLineY / 2}
          textAnchor="middle"
          fill="#707070"
          fontSize="12"
          fontFamily="Barlow Condensed"
        >
          RIGHT
        </text>
        
        {/* Front wall label */}
        <text
          x={courtWidth / 2}
          y={courtHeight - tinHeight - 20}
          textAnchor="middle"
          fill="#707070"
          fontSize="14"
          fontFamily="Barlow Condensed"
          letterSpacing="2"
        >
          FRONT WALL
        </text>
        
        {/* Points on court */}
        {points.map((point, index) => {
          const x = point.position_x * courtWidth;
          const y = (1 - point.position_y) * courtHeight; // Invert Y for court display
          const isHighlighted = highlightedPoint === point.point_id;
          const isWinner = point.winner_player_id === point.my_player_id;
          
          return (
            <g
              key={point.point_id || index}
              onClick={() => onPointClick && onPointClick(point)}
              style={{ cursor: onPointClick ? 'pointer' : 'default' }}
            >
              <circle
                cx={x}
                cy={y}
                r={isHighlighted ? 14 : 10}
                fill={isWinner ? '#22C55E' : '#EF4444'}
                opacity={isHighlighted ? 1 : 0.8}
                stroke={isHighlighted ? '#FFFFFF' : 'transparent'}
                strokeWidth="2"
                className="transition-all duration-200"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10"
                fontFamily="Barlow Condensed"
                fontWeight="bold"
              >
                {point.point_number || index + 1}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-brand-gray">Punto ganado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-brand-gray">Punto perdido</span>
        </div>
      </div>
    </div>
  );
};

export default SquashCourt;
