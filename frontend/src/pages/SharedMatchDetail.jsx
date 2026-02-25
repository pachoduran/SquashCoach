import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { SquashCourt } from '../components/SquashCourt';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { 
  ArrowLeft, 
  Calendar, 
  Trophy, 
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';

export const SharedMatchDetail = () => {
  const { userId, matchId } = useParams();
  const { api } = useAuth();
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [highlightedPoint, setHighlightedPoint] = useState(null);
  const [expandedGame, setExpandedGame] = useState(null);

  useEffect(() => {
    fetchMatchDetail();
  }, [userId, matchId]);

  const fetchMatchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/share/user/${userId}/matches/${matchId}`);
      setMatchData(response.data);
    } catch (err) {
      console.error('Error fetching shared match detail:', err);
      setError('Error al cargar el detalle del partido compartido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando partido..." />
      </Layout>
    );
  }

  if (error || !matchData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-white font-body mb-4">{error || 'Partido no encontrado'}</p>
          <Link to="/shared">
            <Button className="bg-brand-yellow text-brand-black">
              Volver a compartidos
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const { match, points, game_results, players } = matchData;
  const player1 = players?.find(p => p.player_id === match.player1_id);
  const player2 = players?.find(p => p.player_id === match.player2_id);
  const isP1Winner = match.winner_id === match.player1_id;

  const formattedDate = match.date 
    ? format(new Date(match.date), "EEEE, d 'de' MMMM yyyy", { locale: es })
    : 'Fecha no disponible';

  const gamePoints = points
    ?.filter(p => p.game_number === selectedGame)
    ?.map(p => ({ ...p, my_player_id: match.my_player_id || match.player1_id })) || [];

  const gameNumbers = [...new Set(points?.map(p => p.game_number) || [])].sort();

  return (
    <Layout>
      <div className="space-y-6" data-testid="shared-match-detail-page">
        {/* Back Button */}
        <Link 
          to="/shared" 
          className="inline-flex items-center gap-2 text-brand-gray hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading text-sm uppercase tracking-wide">Volver a compartidos</span>
        </Link>

        {/* Match Header */}
        <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
          <div className="flex items-center gap-2 text-brand-gray text-sm mb-4">
            <Calendar className="w-4 h-4" />
            <span className="font-body capitalize">{formattedDate}</span>
            {match.tournament_name && (
              <>
                <span className="mx-2">•</span>
                <Trophy className="w-4 h-4" />
                <span>{match.tournament_name}</span>
              </>
            )}
          </div>

          {/* VS Display */}
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="font-heading text-2xl md:text-3xl text-white uppercase tracking-wide">
                {player1?.nickname || 'Jugador 1'}
              </p>
              {isP1Winner && (
                <span className="inline-block mt-2 px-3 py-1 bg-green-500/20 text-green-500 text-xs font-heading uppercase tracking-wider rounded-full">
                  Ganador
                </span>
              )}
            </div>

            <div className="px-8">
              <div className="flex items-center gap-4">
                <span className={`font-heading text-5xl md:text-6xl font-bold ${isP1Winner ? 'text-brand-yellow' : 'text-white'}`}>
                  {match.player1_games}
                </span>
                <span className="font-heading text-3xl text-brand-gray">-</span>
                <span className={`font-heading text-5xl md:text-6xl font-bold ${!isP1Winner ? 'text-brand-yellow' : 'text-white'}`}>
                  {match.player2_games}
                </span>
              </div>
              <p className="text-center text-brand-gray text-xs font-heading uppercase tracking-wider mt-2">
                Al mejor de {match.best_of}
              </p>
            </div>

            <div className="flex-1 text-center">
              <p className="font-heading text-2xl md:text-3xl text-white uppercase tracking-wide">
                {player2?.nickname || 'Jugador 2'}
              </p>
              {!isP1Winner && (
                <span className="inline-block mt-2 px-3 py-1 bg-green-500/20 text-green-500 text-xs font-heading uppercase tracking-wider rounded-full">
                  Ganador
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="court" className="w-full">
          <TabsList className="w-full bg-brand-dark-gray border border-white/10">
            <TabsTrigger 
              value="court" 
              className="flex-1 data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading uppercase tracking-wide"
            >
              Cancha
            </TabsTrigger>
            <TabsTrigger 
              value="games" 
              className="flex-1 data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading uppercase tracking-wide"
            >
              Juegos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="court" className="mt-6">
            {gameNumbers.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-brand-gray font-heading text-sm uppercase tracking-wide">Juego:</span>
                <div className="flex gap-2">
                  {gameNumbers.map(num => (
                    <button
                      key={num}
                      onClick={() => setSelectedGame(num)}
                      className={`w-10 h-10 rounded-lg font-heading text-lg font-bold transition-all ${
                        selectedGame === num
                          ? 'bg-brand-yellow text-brand-black'
                          : 'bg-brand-dark-gray border border-white/20 text-white hover:border-brand-yellow'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <SquashCourt 
              points={gamePoints}
              onPointClick={(point) => setHighlightedPoint(point.point_id === highlightedPoint ? null : point.point_id)}
              highlightedPoint={highlightedPoint}
              myPlayerId={match.my_player_id || match.player1_id}
            />
          </TabsContent>

          <TabsContent value="games" className="mt-6 space-y-3">
            {game_results?.length > 0 ? (
              game_results.map((game, index) => {
                const isExpanded = expandedGame === game.game_number;
                const gamePointsList = points?.filter(p => p.game_number === game.game_number) || [];
                const p1Won = game.player1_score > game.player2_score;

                return (
                  <div 
                    key={game.game_number || index} 
                    className="bg-brand-dark-gray border border-white/10 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedGame(isExpanded ? null : game.game_number)}
                      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-heading text-lg font-bold ${
                          p1Won ? 'bg-brand-yellow/20 text-brand-yellow' : 'bg-white/10 text-white'
                        }`}>
                          {game.game_number}
                        </span>
                        <p className="text-white font-heading uppercase tracking-wide">
                          Juego {game.game_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-heading text-2xl font-bold ${p1Won ? 'text-brand-yellow' : 'text-white'}`}>
                          {game.player1_score}
                        </span>
                        <span className="text-brand-gray font-heading text-xl">-</span>
                        <span className={`font-heading text-2xl font-bold ${!p1Won ? 'text-brand-yellow' : 'text-white'}`}>
                          {game.player2_score}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-brand-gray" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-brand-gray" />
                        )}
                      </div>
                    </button>

                    {isExpanded && gamePointsList.length > 0 && (
                      <div className="border-t border-white/10 p-4 space-y-2">
                        {gamePointsList.map((point, idx) => (
                          <div 
                            key={point.point_id || idx}
                            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-brand-yellow/20 flex items-center justify-center text-xs font-bold text-brand-yellow">
                                {point.point_number}
                              </span>
                              <span className="text-brand-gray font-body text-sm">
                                {point.reason || '—'}
                              </span>
                            </div>
                            <span className="text-white font-mono text-sm">
                              {point.player1_score}-{point.player2_score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-8 text-center">
                <p className="text-brand-gray font-body">No hay datos de juegos disponibles</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SharedMatchDetail;
