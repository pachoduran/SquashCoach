import React, { useState } from 'react';
import { SquashCourt } from '../components/SquashCourt';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample demo data
const demoPoints = [
  { point_id: 'p1', position_x: 0.25, position_y: 0.7, winner_player_id: 'player1', reason: 'Winner', point_number: 1, player1_score: 1, player2_score: 0 },
  { point_id: 'p2', position_x: 0.75, position_y: 0.6, winner_player_id: 'player2', reason: 'Error', point_number: 2, player1_score: 1, player2_score: 1 },
  { point_id: 'p3', position_x: 0.5, position_y: 0.4, winner_player_id: 'player1', reason: 'Nick', point_number: 3, player1_score: 2, player2_score: 1 },
  { point_id: 'p4', position_x: 0.3, position_y: 0.2, winner_player_id: 'player1', reason: 'Drop', point_number: 4, player1_score: 3, player2_score: 1 },
  { point_id: 'p5', position_x: 0.7, position_y: 0.5, winner_player_id: 'player2', reason: 'Boast', point_number: 5, player1_score: 3, player2_score: 2 },
  { point_id: 'p6', position_x: 0.4, position_y: 0.65, winner_player_id: 'player1', reason: 'Cross', point_number: 6, player1_score: 4, player2_score: 2 },
  { point_id: 'p7', position_x: 0.6, position_y: 0.3, winner_player_id: 'player2', reason: 'Lob', point_number: 7, player1_score: 4, player2_score: 3 },
  { point_id: 'p8', position_x: 0.2, position_y: 0.45, winner_player_id: 'player1', reason: 'Drive', point_number: 8, player1_score: 5, player2_score: 3 },
  { point_id: 'p9', position_x: 0.8, position_y: 0.75, winner_player_id: 'player1', reason: 'Winner', point_number: 9, player1_score: 6, player2_score: 3 },
  { point_id: 'p10', position_x: 0.5, position_y: 0.55, winner_player_id: 'player2', reason: 'Error', point_number: 10, player1_score: 6, player2_score: 4 },
  { point_id: 'p11', position_x: 0.35, position_y: 0.35, winner_player_id: 'player1', reason: 'Nick', point_number: 11, player1_score: 7, player2_score: 4 },
];

export const DemoCourt = () => {
  const [highlightedPoint, setHighlightedPoint] = useState(null);

  return (
    <div className="min-h-screen bg-brand-black p-4">
      {/* Compact Header */}
      <div className="max-w-lg mx-auto mb-4">
        <Link to="/login" className="inline-flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading text-xs uppercase tracking-wide">Volver</span>
        </Link>
        <h1 className="font-heading text-xl text-white uppercase tracking-wide">
          Demo <span className="text-brand-yellow">Visualización</span>
        </h1>
      </div>

      {/* Court with all controls integrated */}
      <SquashCourt 
        points={demoPoints}
        onPointClick={(point) => setHighlightedPoint(point.point_id === highlightedPoint ? null : point.point_id)}
        highlightedPoint={highlightedPoint}
        myPlayerId="player1"
        player1Name="Jugador Demo"
        player2Name="Oponente Demo"
        matchScore={{ p1: 3, p2: 1 }}
        tournamentName="Torneo Demo - Juego 1"
        isWinner={true}
      />
    </div>
  );
};

export default DemoCourt;
