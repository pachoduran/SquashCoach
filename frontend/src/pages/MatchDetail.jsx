import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { SquashCourt } from '../components/SquashCourt';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeft, Calendar, Trophy, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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
    return <Layout><LoadingSpinner message="Cargando partido..." /></Layout>;
  }

  if (error || !matchData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-white font-body mb-4">{error || 'Partido no encontrado'}</p>
          <Link to="/matches"><Button className="bg-brand-yellow text-brand-black">Volver a partidos</Button></Link>
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
    ? format(new Date(match.date), "d MMM yyyy", { locale: es })
    : '';

  const gamePoints = points?.filter(p => p.game_number === selectedGame) || [];
  const gameNumbers = [...new Set(points?.map(p => p.game_number) || [])].sort();

  // Stats - filter by selected game or all
  const statsPoints = selectedGame === 'all' ? points : points?.filter(p => p.game_number === selectedGame);
  
  const pointReasons = statsPoints?.reduce((acc, point) => {
    const reason = point.reason || 'Otro';
    if (!acc[reason]) acc[reason] = { won: 0, lost: 0, total: 0 };
    acc[reason].total++;
    if (point.winner_player_id === match.my_player_id) acc[reason].won++;
    else acc[reason].lost++;
    return acc;
  }, {}) || {};

  const topReasons = Object.entries(pointReasons)
    .map(([reason, s]) => ({ reason, ...s }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxReasonCount = topReasons[0]?.total || 1;

  return (
    <Layout>
      <div className="space-y-4" data-testid="match-detail-page">
        {/* Back */}
        <Link to="/matches" className="inline-flex items-center gap-2 text-brand-gray hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="font-heading text-xs uppercase tracking-wide">Volver</span>
        </Link>

        {/* Game Selector Tabs */}
        <Tabs defaultValue="game-1" className="w-full">
          <TabsList className="w-full bg-brand-dark-gray border border-white/10 flex-wrap h-auto gap-1 p-1">
            {gameNumbers.map(num => (
              <TabsTrigger 
                key={num}
                value={`game-${num}`}
                onClick={() => setSelectedGame(num)}
                className="flex-1 min-w-[60px] data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading text-sm uppercase"
              >
                Juego {num}
              </TabsTrigger>
            ))}
            <TabsTrigger 
              value="stats"
              className="flex-1 min-w-[60px] data-[state=active]:bg-brand-yellow data-[state=active]:text-brand-black font-heading text-sm uppercase"
            >
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Court Tab for each game */}
          {gameNumbers.map(num => (
            <TabsContent key={num} value={`game-${num}`} className="mt-4">
              <SquashCourt 
                points={points?.filter(p => p.game_number === num) || []}
                onPointClick={(point) => setHighlightedPoint(point.point_id === highlightedPoint ? null : point.point_id)}
                highlightedPoint={highlightedPoint}
                myPlayerId={match.my_player_id}
                player1Name={myPlayer?.nickname || 'Yo'}
                player2Name={opponent?.nickname || 'Oponente'}
                matchScore={{ p1: myGames, p2: opponentGames }}
                tournamentName={`${match.tournament_name || 'Partido'} - ${formattedDate}`}
                isWinner={isWinner}
              />
            </TabsContent>
          ))}

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4 space-y-4">
            {/* Match Summary */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <p className="font-heading text-lg text-white uppercase">{myPlayer?.nickname || 'Yo'}</p>
                  {isWinner && <span className="text-xs text-green-500">Ganador</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-3xl font-bold text-brand-yellow">{myGames}</span>
                  <span className="text-brand-gray">-</span>
                  <span className="font-heading text-3xl font-bold text-white">{opponentGames}</span>
                </div>
                <div className="text-center flex-1">
                  <p className="font-heading text-lg text-white uppercase">{opponent?.nickname || 'Oponente'}</p>
                  {!isWinner && <span className="text-xs text-green-500">Ganador</span>}
                </div>
              </div>
              <p className="text-center text-brand-gray text-sm">{match.tournament_name} • {formattedDate}</p>
            </div>

            {/* Points Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4 text-center">
                <p className="font-heading text-3xl font-bold text-green-500">
                  {points?.filter(p => p.winner_player_id === match.my_player_id).length || 0}
                </p>
                <p className="text-brand-gray text-xs font-heading uppercase">Puntos Ganados</p>
              </div>
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4 text-center">
                <p className="font-heading text-3xl font-bold text-red-500">
                  {points?.filter(p => p.winner_player_id !== match.my_player_id).length || 0}
                </p>
                <p className="text-brand-gray text-xs font-heading uppercase">Puntos Perdidos</p>
              </div>
            </div>

            {/* Point Reasons */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4">
              <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-3">Tipos de Punto</h3>
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

            {/* Game Results */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4">
              <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-3">Resultados por Juego</h3>
              <div className="space-y-2">
                {game_results?.map((game, idx) => {
                  const myScore = match.my_player_id === match.player1_id ? game.player1_score : game.player2_score;
                  const oppScore = match.my_player_id === match.player1_id ? game.player2_score : game.player1_score;
                  const won = myScore > oppScore;
                  return (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className={`font-heading ${won ? 'text-green-500' : 'text-brand-gray'}`}>Juego {game.game_number}</span>
                      <span className="font-heading text-lg">
                        <span className={won ? 'text-brand-yellow' : 'text-white'}>{myScore}</span>
                        <span className="text-brand-gray mx-2">-</span>
                        <span className={!won ? 'text-brand-yellow' : 'text-white'}>{oppScore}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default MatchDetail;
