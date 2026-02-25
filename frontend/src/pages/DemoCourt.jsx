import React, { useState } from 'react';
import { SquashCourt } from '../components/SquashCourt';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample demo data to showcase the court visualization
const demoPoints = [
  { point_id: 'p1', position_x: 0.25, position_y: 0.3, winner_player_id: 'player1', reason: 'Winner', point_number: 1, player1_score: 1, player2_score: 0 },
  { point_id: 'p2', position_x: 0.75, position_y: 0.4, winner_player_id: 'player2', reason: 'Error', point_number: 2, player1_score: 1, player2_score: 1 },
  { point_id: 'p3', position_x: 0.5, position_y: 0.6, winner_player_id: 'player1', reason: 'Nick', point_number: 3, player1_score: 2, player2_score: 1 },
  { point_id: 'p4', position_x: 0.3, position_y: 0.8, winner_player_id: 'player1', reason: 'Drop', point_number: 4, player1_score: 3, player2_score: 1 },
  { point_id: 'p5', position_x: 0.7, position_y: 0.5, winner_player_id: 'player2', reason: 'Boast', point_number: 5, player1_score: 3, player2_score: 2 },
  { point_id: 'p6', position_x: 0.4, position_y: 0.35, winner_player_id: 'player1', reason: 'Cross', point_number: 6, player1_score: 4, player2_score: 2 },
  { point_id: 'p7', position_x: 0.6, position_y: 0.7, winner_player_id: 'player2', reason: 'Lob', point_number: 7, player1_score: 4, player2_score: 3 },
  { point_id: 'p8', position_x: 0.2, position_y: 0.55, winner_player_id: 'player1', reason: 'Drive', point_number: 8, player1_score: 5, player2_score: 3 },
  { point_id: 'p9', position_x: 0.8, position_y: 0.25, winner_player_id: 'player1', reason: 'Winner', point_number: 9, player1_score: 6, player2_score: 3 },
  { point_id: 'p10', position_x: 0.5, position_y: 0.45, winner_player_id: 'player2', reason: 'Error', point_number: 10, player1_score: 6, player2_score: 4 },
  { point_id: 'p11', position_x: 0.35, position_y: 0.65, winner_player_id: 'player1', reason: 'Nick', point_number: 11, player1_score: 7, player2_score: 4 },
];

export const DemoCourt = () => {
  const [highlightedPoint, setHighlightedPoint] = useState(null);

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-brand-gray hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading text-sm uppercase tracking-wide">Volver al Login</span>
        </Link>
        
        <h1 className="font-heading text-3xl md:text-4xl text-white uppercase tracking-wide mb-2">
          Demo de <span className="text-brand-yellow">Visualización</span>
        </h1>
        <p className="text-brand-gray font-body">
          Explora cómo se visualizan los puntos en la cancha de squash
        </p>
      </div>

      {/* Demo Match Info */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="font-heading text-2xl text-white uppercase tracking-wide">Jugador Demo</p>
              <span className="inline-block mt-2 px-3 py-1 bg-green-500/20 text-green-500 text-xs font-heading uppercase tracking-wider rounded-full">
                Ganador
              </span>
            </div>
            <div className="px-8">
              <div className="flex items-center gap-4">
                <span className="font-heading text-5xl font-bold text-brand-yellow">7</span>
                <span className="font-heading text-3xl text-brand-gray">-</span>
                <span className="font-heading text-5xl font-bold text-white">4</span>
              </div>
              <p className="text-center text-brand-gray text-xs font-heading uppercase tracking-wider mt-2">
                Juego de demostración
              </p>
            </div>
            <div className="flex-1 text-center">
              <p className="font-heading text-2xl text-white uppercase tracking-wide">Oponente Demo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Court with Controls */}
      <div className="max-w-4xl mx-auto">
        <SquashCourt 
          points={demoPoints}
          onPointClick={(point) => setHighlightedPoint(point.point_id === highlightedPoint ? null : point.point_id)}
          highlightedPoint={highlightedPoint}
          myPlayerId="player1"
        />
      </div>

      {/* Instructions */}
      <div className="max-w-4xl mx-auto mt-8">
        <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-6">
          <h2 className="font-heading text-lg text-brand-yellow uppercase tracking-wide mb-4">
            Instrucciones
          </h2>
          <ul className="space-y-2 text-brand-gray font-body text-sm">
            <li className="flex items-start gap-2">
              <span className="text-brand-yellow">▸</span>
              Usa los botones de <strong className="text-white">Play/Pause</strong> para ver la secuencia de puntos animada
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-yellow">▸</span>
              Usa el <strong className="text-white">Slider</strong> para navegar punto por punto
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-yellow">▸</span>
              Haz <strong className="text-white">clic en una bola</strong> para ver detalles del punto
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-yellow">▸</span>
              Las <strong className="text-green-500">bolas verdes</strong> son puntos ganados, las <strong className="text-red-500">rojas</strong> son puntos perdidos
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-yellow">▸</span>
              Las <strong className="text-white">líneas punteadas</strong> muestran la trayectoria del juego
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DemoCourt;
