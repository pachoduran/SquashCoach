import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const MatchCard = ({ match, players, linkPrefix = '/matches' }) => {
  const player1 = players?.find(p => p.player_id === match.player1_id);
  const player2 = players?.find(p => p.player_id === match.player2_id);
  const isWinner = match.winner_id === match.my_player_id;
  const myPlayer = match.my_player_id === match.player1_id ? player1 : player2;
  const opponent = match.my_player_id === match.player1_id ? player2 : player1;
  
  const myGames = match.my_player_id === match.player1_id ? match.player1_games : match.player2_games;
  const opponentGames = match.my_player_id === match.player1_id ? match.player2_games : match.player1_games;
  
  const formattedDate = match.date 
    ? format(new Date(match.date), "d MMM yyyy", { locale: es })
    : 'Fecha no disponible';

  return (
    <Link 
      to={`${linkPrefix}/${match.match_id}`}
      data-testid={`match-card-${match.match_id}`}
      className="block bg-brand-dark-gray border border-white/10 rounded-lg p-4 hover:bg-white/5 hover:border-brand-yellow/30 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between">
        {/* Left section - Date and Tournament */}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-brand-gray text-sm">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="font-body">{formattedDate}</span>
          </div>
          {match.tournament_name && (
            <span className="text-brand-gray text-xs font-body truncate">
              {match.tournament_name}
            </span>
          )}
        </div>

        {/* Center section - Opponent */}
        <div className="flex-1 text-center px-4">
          <p className="text-white font-heading text-lg uppercase tracking-wide truncate">
            vs {opponent?.nickname || 'Oponente'}
          </p>
        </div>

        {/* Right section - Score and Result */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className={`font-heading text-2xl ${isWinner ? 'text-brand-yellow' : 'text-white'}`}>
                {myGames}
              </span>
              <span className="text-brand-gray font-heading text-2xl">-</span>
              <span className={`font-heading text-2xl ${!isWinner ? 'text-brand-yellow' : 'text-white'}`}>
                {opponentGames}
              </span>
            </div>
            <span className={`text-xs font-heading uppercase tracking-wider ${
              isWinner ? 'text-green-500' : 'text-red-500'
            }`}>
              {isWinner ? 'Victoria' : 'Derrota'}
            </span>
          </div>
          
          <ChevronRight className="w-5 h-5 text-brand-gray group-hover:text-brand-yellow transition-colors" />
        </div>
      </div>
    </Link>
  );
};

export default MatchCard;
