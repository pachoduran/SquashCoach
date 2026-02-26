import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BarChart3, Users, Trophy, Target, Percent, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Calendar as CalendarIcon } from 'lucide-react';

export const Analysis = () => {
  const { api } = useAuth();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState(null);
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [playersRes, matchesRes] = await Promise.all([
        api.get('/api/players'),
        api.get('/api/matches')
      ]);
      setPlayers(playersRes.data || []);
      setMatches(matchesRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    if (!player1 || !player2) {
      return;
    }

    try {
      setAnalysisLoading(true);
      setError(null);
      
      let url = `/api/analysis/head-to-head?player1_id=${player1}&player2_id=${player2}`;
      if (dateFrom) {
        url += `&date_from=${dateFrom.toISOString()}`;
      }
      if (dateTo) {
        url += `&date_to=${dateTo.toISOString()}`;
      }
      
      const response = await api.get(url);
      const raw = response.data;

      // Transform API response to expected format
      const matchList = raw.matches || [];
      const p1Wins = matchList.filter(m => m.winner_id === player1).length;
      const p2Wins = matchList.filter(m => m.winner_id === player2).length;

      let totalGamesP1 = 0;
      let totalGamesP2 = 0;
      matchList.forEach(m => {
        if (m.player1_id === player1) {
          totalGamesP1 += m.player1_games || 0;
          totalGamesP2 += m.player2_games || 0;
        } else {
          totalGamesP1 += m.player2_games || 0;
          totalGamesP2 += m.player1_games || 0;
        }
      });

      setAnalysisData({
        total_matches: raw.matches_count || matchList.length,
        player1_wins: p1Wins,
        player2_wins: p2Wins,
        player1_games: totalGamesP1,
        player2_games: totalGamesP2,
      });
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError('Error al cargar el análisis. Intenta de nuevo.');
      setAnalysisData(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Calculate local head-to-head from matches if API doesn't return data
  const calculateLocalH2H = () => {
    if (!player1 || !player2) return null;
    
    const h2hMatches = matches.filter(m => 
      (m.player1_id === player1 && m.player2_id === player2) ||
      (m.player1_id === player2 && m.player2_id === player1)
    );

    if (h2hMatches.length === 0) return null;

    const player1Wins = h2hMatches.filter(m => m.winner_id === player1).length;
    const player2Wins = h2hMatches.filter(m => m.winner_id === player2).length;

    let totalGamesP1 = 0;
    let totalGamesP2 = 0;

    h2hMatches.forEach(m => {
      if (m.player1_id === player1) {
        totalGamesP1 += m.player1_games || 0;
        totalGamesP2 += m.player2_games || 0;
      } else {
        totalGamesP1 += m.player2_games || 0;
        totalGamesP2 += m.player1_games || 0;
      }
    });

    return {
      total_matches: h2hMatches.length,
      player1_wins: player1Wins,
      player2_wins: player2Wins,
      player1_games: totalGamesP1,
      player2_games: totalGamesP2,
    };
  };

  const displayData = analysisData || calculateLocalH2H();
  const player1Data = players.find(p => p.player_id === player1);
  const player2Data = players.find(p => p.player_id === player2);

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando datos..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="analysis-page">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl text-white uppercase tracking-wide">
            Análisis Head-to-Head
          </h1>
          <p className="text-brand-gray font-body mt-1">
            Compara el rendimiento entre dos jugadores
          </p>
        </div>

        {/* Player Selection */}
        <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Player 1 */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">
                Jugador 1
              </label>
              <Select value={player1} onValueChange={setPlayer1}>
                <SelectTrigger 
                  data-testid="select-player1"
                  className="bg-brand-black border-white/20 text-white"
                >
                  <SelectValue placeholder="Seleccionar jugador" />
                </SelectTrigger>
                <SelectContent className="bg-brand-dark-gray border-white/20">
                  {players.map(player => (
                    <SelectItem 
                      key={player.player_id} 
                      value={player.player_id}
                      className="text-white"
                      disabled={player.player_id === player2}
                    >
                      {player.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player 2 */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">
                Jugador 2
              </label>
              <Select value={player2} onValueChange={setPlayer2}>
                <SelectTrigger 
                  data-testid="select-player2"
                  className="bg-brand-black border-white/20 text-white"
                >
                  <SelectValue placeholder="Seleccionar jugador" />
                </SelectTrigger>
                <SelectContent className="bg-brand-dark-gray border-white/20">
                  {players.map(player => (
                    <SelectItem 
                      key={player.player_id} 
                      value={player.player_id}
                      className="text-white"
                      disabled={player.player_id === player1}
                    >
                      {player.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">
                Desde
              </label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-testid="date-from-picker"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-brand-black border-white/20",
                      !dateFrom && "text-brand-gray"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-brand-dark-gray border-white/20">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      setDateFrom(date);
                      setDateFromOpen(false);
                    }}
                    initialFocus
                    className="bg-brand-dark-gray"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">
                Hasta
              </label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    data-testid="date-to-picker"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-brand-black border-white/20",
                      !dateTo && "text-brand-gray"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-brand-dark-gray border-white/20">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      setDateTo(date);
                      setDateToOpen(false);
                    }}
                    initialFocus
                    className="bg-brand-dark-gray"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="mt-6 flex justify-center">
            <Button
              onClick={fetchAnalysis}
              data-testid="analyze-button"
              disabled={!player1 || !player2 || analysisLoading}
              className="bg-brand-yellow text-brand-black font-heading uppercase tracking-wider px-8 hover:bg-brand-yellow/90 disabled:opacity-50"
            >
              {analysisLoading ? (
                <>
                  <LoadingSpinner size="sm" message="" />
                  <span className="ml-2">Analizando...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analizar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-body">{error}</p>
          </div>
        )}

        {/* Analysis Results */}
        {displayData && player1 && player2 && (
          <div className="space-y-6">
            {/* VS Header */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between">
                {/* Player 1 */}
                <div className="flex-1 text-center">
                  <div className="w-20 h-20 rounded-full bg-brand-yellow/20 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-10 h-10 text-brand-yellow" />
                  </div>
                  <p className="font-heading text-2xl text-white uppercase tracking-wide">
                    {player1Data?.nickname || 'Jugador 1'}
                  </p>
                </div>

                {/* VS */}
                <div className="px-8">
                  <span className="font-heading text-4xl text-brand-gray">VS</span>
                </div>

                {/* Player 2 */}
                <div className="flex-1 text-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                  <p className="font-heading text-2xl text-white uppercase tracking-wide">
                    {player2Data?.nickname || 'Jugador 2'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total Matches */}
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5 text-center">
                <Trophy className="w-8 h-8 text-brand-yellow mx-auto mb-2" />
                <p className="font-heading text-4xl font-bold text-white">
                  {displayData.total_matches}
                </p>
                <p className="text-brand-gray text-xs font-heading uppercase tracking-wider mt-1">
                  Partidos Totales
                </p>
              </div>

              {/* Win Comparison */}
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
                <p className="text-brand-gray text-xs font-heading uppercase tracking-wider text-center mb-4">
                  Victorias
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-brand-yellow">
                      {displayData.player1_wins}
                    </p>
                    <p className="text-brand-gray text-xs">{player1Data?.nickname}</p>
                  </div>
                  <span className="text-brand-gray text-2xl">-</span>
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-white">
                      {displayData.player2_wins}
                    </p>
                    <p className="text-brand-gray text-xs">{player2Data?.nickname}</p>
                  </div>
                </div>
              </div>

              {/* Games Comparison */}
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
                <p className="text-brand-gray text-xs font-heading uppercase tracking-wider text-center mb-4">
                  Juegos
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-brand-yellow">
                      {displayData.player1_games || 0}
                    </p>
                    <p className="text-brand-gray text-xs">{player1Data?.nickname}</p>
                  </div>
                  <span className="text-brand-gray text-2xl">-</span>
                  <div className="text-center">
                    <p className="font-heading text-4xl font-bold text-white">
                      {displayData.player2_games || 0}
                    </p>
                    <p className="text-brand-gray text-xs">{player2Data?.nickname}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Win Rate Bars */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
              <p className="text-brand-gray text-xs font-heading uppercase tracking-wider text-center mb-4">
                Porcentaje de Victorias
              </p>
              <div className="space-y-4">
                {/* Player 1 Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white font-heading text-sm">{player1Data?.nickname}</span>
                    <span className="text-brand-yellow font-heading font-bold">
                      {displayData.total_matches > 0 
                        ? Math.round((displayData.player1_wins / displayData.total_matches) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="h-4 bg-brand-black rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-yellow rounded-full transition-all duration-500"
                      style={{ 
                        width: `${displayData.total_matches > 0 
                          ? (displayData.player1_wins / displayData.total_matches) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Player 2 Bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-white font-heading text-sm">{player2Data?.nickname}</span>
                    <span className="text-white font-heading font-bold">
                      {displayData.total_matches > 0 
                        ? Math.round((displayData.player2_wins / displayData.total_matches) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="h-4 bg-brand-black rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white/60 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${displayData.total_matches > 0 
                          ? (displayData.player2_wins / displayData.total_matches) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!displayData && player1 && player2 && !analysisLoading && (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
            <BarChart3 className="w-16 h-16 text-brand-gray mx-auto mb-4" />
            <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">
              Sin datos
            </p>
            <p className="text-brand-gray font-body">
              No hay partidos registrados entre estos jugadores
            </p>
          </div>
        )}

        {/* Initial State */}
        {(!player1 || !player2) && (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-brand-gray mx-auto mb-4" />
            <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">
              Selecciona dos jugadores
            </p>
            <p className="text-brand-gray font-body">
              Elige los jugadores para ver el análisis head-to-head
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Analysis;
