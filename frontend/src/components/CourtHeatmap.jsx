import React from 'react';

const COURT_IMAGE = 'https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ipnldsxo_squash-court.png';
const GRID_COLS = 4;
const GRID_ROWS = 6;

function buildGrid(points) {
  const grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(0));
  points.forEach(p => {
    const col = Math.min(Math.floor(p.position_x * GRID_COLS), GRID_COLS - 1);
    const row = Math.min(Math.floor(p.position_y * GRID_ROWS), GRID_ROWS - 1);
    grid[row][col]++;
  });
  return grid;
}

export const CourtHeatmap = ({ points = [], color = '#9C27B0', label = 'Todos', playerName = '' }) => {
  const grid = buildGrid(points);
  const maxValue = Math.max(...grid.flat(), 1);

  const getOpacity = (value) => {
    if (value === 0) return 0;
    return 0.2 + (value / maxValue) * 0.7;
  };

  return (
    <div className="flex flex-col items-center" data-testid={`heatmap-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <p className="text-white font-heading text-xs uppercase tracking-wider mb-2 text-center">
        {playerName || label}
      </p>
      <div
        className="relative w-full rounded-lg overflow-hidden border border-white/20"
        style={{ aspectRatio: '713/1000', maxWidth: '220px' }}
      >
        <img
          src={COURT_IMAGE}
          alt="Cancha"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        {/* Grid overlay */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }}>
          {grid.map((row, ri) =>
            row.map((val, ci) => (
              <div
                key={`${ri}-${ci}`}
                className="relative flex items-center justify-center border border-white/5"
                style={{ backgroundColor: val > 0 ? color : 'transparent', opacity: getOpacity(val) }}
              >
                {val > 0 && (
                  <span className="relative text-white font-heading text-sm font-bold drop-shadow-lg" style={{ opacity: 1 / getOpacity(val) }}>
                    {val}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <p className="text-brand-gray text-[10px] mt-1">{points.length} puntos</p>
    </div>
  );
};

export default CourtHeatmap;
