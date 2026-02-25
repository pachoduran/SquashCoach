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
  Target,
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

export const MatchDetail = () => {
  const { matchId } = useParams();
  const { api } = useAuth();
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGame, setSelectedGame] = useState(1);
  const [highlightedPoint, setHighlightedPoint] = useState(null);
  const [expandedGame, setExpandedGame] = useState(null);

  useEffect(() => {
    fetchMatchDetail();
  }, [matchId]);

  const fetchMatchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/matches/${matchId}`);
      setMatchData(response.data);
    } catch (err) {
      console.error('Error fetching match detail:', err);
      setError('Error al cargar el detalle del partido');
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
          <Link to="/matches">
            <Button className="bg-brand-yellow text-brand-black">
              Volver a partidos
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const { match, points, game_results, players } = matchData;
  const player1 = players?.find(p => p.player_id === match.player1_id);
  const player2 = players?.find(p => p.player_id === match.player2_id);
  const myPlayer = match.my_player_id === match.player1_id ? player1 : player2;
  const opponent = match.my_player_id === match.player1_id ? player2 : player1;
  const isWinner = match.winner_id === match.my_player_id;
  
  const myGames = match.my_player_id === match.player1_id ? match.player1_games : match.player2_games;
  const opponentGames = match.my_player_id === match.player1_id ? match.player2_games : match.player1_games;

  const formattedDate = match.date 
    ? format(new Date(match.date), "EEEE, d 'de' MMMM yyyy", { locale: es })
    : 'Fecha no disponible';

  // Points for selected game with my_player_id added
  const gamePoints = points
    ?.filter(p => p.game_number === selectedGame)
    ?.map(p => ({ ...p, my_player_id: match.my_player_id })) || [];

  // Get unique game numbers
  const gameNumbers = [...new Set(points?.map(p => p.game_number) || [])].sort();

  // Calculate point reasons breakdown
  const pointReasons = points?.reduce((acc, point) => {
    const reason = point.reason || 'Otro';
    if (!acc[reason]) {
      acc[reason] = { won: 0, lost: 0 };
    }
    if (point.winner_player_id === match.my_player_id) {
      acc[reason].won++;
    } else {
      acc[reason].lost++;
    }
    return acc;
  }, {}) || {};

  return (
    <Layout>
      <div className="space-y-6" data-testid="match-detail-page">
        {/* Back Button */}
        <Link 
          to="/matches" 
          className="inline-flex items-center gap-2 text-brand-gray hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading text-sm uppercase tracking-wide">Volver a partidos</span>
        </Link>

        {/* Match Header */}
        <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
          {/* Date and Tournament */}
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
            {/* My Player */}
            <div className="flex-1 text-center">
              <p className="font-heading text-2xl md:text-3xl text-white uppercase tracking-wide">
                {myPlayer?.nickname || 'Yo'}
              </p>
              {isWinner && (
                <span className="inline-block mt-2 px-3 py-1 bg-green-500/20 text-green-500 text-xs font-heading uppercase tracking-wider rounded-full">
                  Ganador
                </span>
              )}
            </div>

            {/* Score */}
            <div className="px-8">
              <div className="flex items-center gap-4">
                <span className={`font-heading text-5xl md:text-6xl font-bold ${isWinner ? 'text-brand-yellow' : 'text-white'}`}>
                  {myGames}
                </span>
                <span className="font-heading text-3xl text-brand-gray">-</span>
                <span className={`font-heading text-5xl md:text-6xl font-bold ${!isWinner ? 'text-brand-yellow' : 'text-white'}`}>
                  {opponentGames}
                </span>
              </div>
              <p className="text-center text-brand-gray text-xs font-heading uppercase tracking-wider mt-2">
                Al mejor de {match.best_of}
              </p>
            </div>

            {/* Opponent */}
            <div className="flex-1 text-center">
              <p className="font-heading text-2xl md:text-3xl text-white uppercase tracking-wide">
                {opponent?.nickname || 'Oponente'}
              </p>
              {!isWinner && (
                <span className="inline-block mt-2 px-3 py-1 bg-green-500/20 text-green-500 text-xs font-heading uppercase tracking-wider rounded-full">
                  Ganador
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs for Analysis */}
        <Tabs defaultValue="court" className="w-full">
          <TabsList className="w-full bg-brand-dark-gray border border-white/10">
            <TabsTrigger 
              value="court" 
              data-testid="tab-court"
              className="flex-1 data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading uppercase tracking-wide"
            >
              Cancha
            </TabsTrigger>
            <TabsTrigger 
              value="games" 
              data-testid="tab-games"
              className="flex-1 data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading uppercase tracking-wide"
            >
              Juegos
            </TabsTrigger>
            <TabsTrigger 
              value="stats" 
              data-testid="tab-stats"
              className="flex-1 data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading uppercase tracking-wide"
            >
              Estadísticas
            </TabsTrigger>
          </TabsList>

          {/* Court View */}
          <TabsContent value="court" className="mt-6">
            {/* Game Selector */}
            {gameNumbers.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-brand-gray font-heading text-sm uppercase tracking-wide">Juego:</span>
                <div className="flex gap-2">
                  {gameNumbers.map(num => (
                    <button
                      key={num}
                      onClick={() => setSelectedGame(num)}
                      data-testid={`game-selector-${num}`}
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

            {/* Court */}
            <SquashCourt 
              points={gamePoints}
              onPointClick={(point) => setHighlightedPoint(point.point_id === highlightedPoint ? null : point.point_id)}
              highlightedPoint={highlightedPoint}
              myPlayerId={match.my_player_id}
            />

            {/* Point Details */}
            {highlightedPoint && (
              <div className="mt-4 bg-brand-dark-gray border border-white/10 rounded-lg p-4">
                {(() => {
                  const point = gamePoints.find(p => p.point_id === highlightedPoint);
                  if (!point) return null;
                  const won = point.winner_player_id === match.my_player_id;
                  return (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-heading uppercase">
                          Punto {point.point_number}
                        </p>
                        <p className="text-brand-gray font-body text-sm">
                          {point.reason || 'Sin razón especificada'}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`font-heading text-2xl font-bold ${won ? 'text-green-500' : 'text-red-500'}`}>
                          {point.player1_score} - {point.player2_score}
                        </span>
                        <p className={`text-xs font-heading uppercase ${won ? 'text-green-500' : 'text-red-500'}`}>
                          {won ? 'Ganado' : 'Perdido'}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>

          {/* Games View */}
          <TabsContent value="games" className="mt-6 space-y-3">
            {game_results?.length > 0 ? (
              game_results.map((game, index) => {
                const myScore = match.my_player_id === match.player1_id 
                  ? game.player1_score 
                  : game.player2_score;
                const oppScore = match.my_player_id === match.player1_id 
                  ? game.player2_score 
                  : game.player1_score;
                const won = myScore > oppScore;
                const isExpanded = expandedGame === game.game_number;
                const gamePointsList = points?.filter(p => p.game_number === game.game_number) || [];

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
                          won ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                        }`}>
                          {game.game_number}
                        </span>
                        <div className="text-left">
                          <p className="text-white font-heading uppercase tracking-wide">
                            Juego {game.game_number}
                          </p>
                          <p className="text-brand-gray text-sm font-body">
                            {gamePointsList.length} puntos
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`font-heading text-2xl font-bold ${won ? 'text-brand-yellow' : 'text-white'}`}>
                          {myScore}
                        </span>
                        <span className="text-brand-gray font-heading text-xl">-</span>
                        <span className={`font-heading text-2xl font-bold ${!won ? 'text-brand-yellow' : 'text-white'}`}>
                          {oppScore}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-brand-gray" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-brand-gray" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Point List */}
                    {isExpanded && gamePointsList.length > 0 && (
                      <div className="border-t border-white/10 p-4 space-y-2">
                        {gamePointsList.map((point, idx) => {
                          const pointWon = point.winner_player_id === match.my_player_id;
                          return (
                            <div 
                              key={point.point_id || idx}
                              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  pointWon ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}>
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
                          );
                        })}
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

          {/* Stats View */}
          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Points */}
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
                <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-4">
                  Puntos Totales
                </h3>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-green-500">
                      {points?.filter(p => p.winner_player_id === match.my_player_id).length || 0}
                    </p>
                    <p className="text-brand-gray text-xs font-heading uppercase">Ganados</p>
                  </div>
                  <div className="w-px h-12 bg-white/20"></div>
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-red-500">
                      {points?.filter(p => p.winner_player_id !== match.my_player_id).length || 0}
                    </p>
                    <p className="text-brand-gray text-xs font-heading uppercase">Perdidos</p>
                  </div>
                </div>
              </div>

              {/* Point Reasons */}
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
                <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-4">
                  Tipos de Punto
                </h3>
                <div className="space-y-2">
                  {Object.entries(pointReasons).map(([reason, stats]) => (
                    <div key={reason} className="flex items-center justify-between">
                      <span className="text-white font-body text-sm">{reason}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 font-heading font-bold">{stats.won}</span>
                        <span className="text-brand-gray">/</span>
                        <span className="text-red-500 font-heading font-bold">{stats.lost}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MatchDetail;
