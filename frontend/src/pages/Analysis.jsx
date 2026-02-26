import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CourtHeatmap } from '../components/CourtHeatmap';
import { BarChart3, Users, Trophy, AlertCircle, Target } from 'lucide-react';
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
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/players');
      setPlayers(res.data || []);
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Error al cargar los jugadores');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    if (!player1 || !player2) return;

    try {
      setAnalysisLoading(true);
      setError(null);

      // Always fetch without dates (external API doesn't support date params reliably)
      // Then filter locally by date range
      const url = `/api/analysis/head-to-head?player1_id=${player1}&player2_id=${player2}`;
      const response = await api.get(url);
      const raw = response.data;

      // Filter matches by date range locally
      let matchList = raw.matches || [];
      if (dateFrom || dateTo) {
        matchList = matchList.filter(m => {
          const matchDate = new Date(m.match_date || m.date);
          if (dateFrom && matchDate < dateFrom) return false;
          if (dateTo) {
            const toEnd = new Date(dateTo);
            toEnd.setHours(23, 59, 59, 999);
            if (matchDate > toEnd) return false;
          }
          return true;
        });
      }

      // Filter points to only include those from filtered matches
      const matchIds = new Set(matchList.map(m => m.match_id));
      const allPoints = (raw.points || []).filter(p => matchIds.has(p.match_id));

      // Basic stats
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

      // Points stats
      const p1Points = allPoints.filter(p => p.winner_player_id === player1);
      const p2Points = allPoints.filter(p => p.winner_player_id === player2);

      // Reason stats
      const reasonCounts = {};
      allPoints.forEach(p => {
        const r = p.reason || 'Otro';
        if (!reasonCounts[r]) reasonCounts[r] = { total: 0, p1: 0, p2: 0 };
        reasonCounts[r].total++;
        if (p.winner_player_id === player1) reasonCounts[r].p1++;
        else reasonCounts[r].p2++;
      });
      const topReasons = Object.entries(reasonCounts)
        .map(([reason, c]) => ({ reason, ...c }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setAnalysisData({
        total_matches: raw.matches_count || matchList.length,
        total_points: raw.points_count || allPoints.length,
        player1_wins: p1Wins,
        player2_wins: p2Wins,
        player1_games: totalGamesP1,
        player2_games: totalGamesP2,
        player1_points: p1Points.length,
        player2_points: p2Points.length,
        p1PointsList: p1Points,
        p2PointsList: p2Points,
        allPoints,
        topReasons,
        matches: matchList,
      });
    } catch (err) {
      console.error('Error fetching analysis:', err);
      setError('Error al cargar el análisis. Intenta de nuevo.');
      setAnalysisData(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const player1Data = players.find(p => p.player_id === player1);
  const player2Data = players.find(p => p.player_id === player2);

  if (loading) {
    return <Layout><LoadingSpinner message="Cargando datos..." /></Layout>;
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
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">Jugador 1</label>
              <Select value={player1} onValueChange={setPlayer1}>
                <SelectTrigger data-testid="select-player1" className="bg-brand-black border-white/20 text-white">
                  <SelectValue placeholder="Seleccionar jugador" />
                </SelectTrigger>
                <SelectContent className="bg-brand-dark-gray border-white/20">
                  {players.map(p => (
                    <SelectItem key={p.player_id} value={p.player_id} className="text-white" disabled={p.player_id === player2}>
                      {p.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Player 2 */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">Jugador 2</label>
              <Select value={player2} onValueChange={setPlayer2}>
                <SelectTrigger data-testid="select-player2" className="bg-brand-black border-white/20 text-white">
                  <SelectValue placeholder="Seleccionar jugador" />
                </SelectTrigger>
                <SelectContent className="bg-brand-dark-gray border-white/20">
                  {players.map(p => (
                    <SelectItem key={p.player_id} value={p.player_id} className="text-white" disabled={p.player_id === player1}>
                      {p.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">Desde</label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="date-from-picker"
                    className={cn("w-full justify-start text-left font-normal bg-brand-black border-white/20", !dateFrom && "text-brand-gray")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP", { locale: es }) : "Fecha inicio"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-brand-dark-gray border-white/20">
                  <Calendar mode="single" selected={dateFrom} onSelect={(d) => { setDateFrom(d); setDateFromOpen(false); }} initialFocus className="bg-brand-dark-gray" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Date To */}
            <div>
              <label className="block text-brand-gray font-heading text-xs uppercase tracking-wider mb-2">Hasta</label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" data-testid="date-to-picker"
                    className={cn("w-full justify-start text-left font-normal bg-brand-black border-white/20", !dateTo && "text-brand-gray")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP", { locale: es }) : "Fecha fin"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-brand-dark-gray border-white/20">
                  <Calendar mode="single" selected={dateTo} onSelect={(d) => { setDateTo(d); setDateToOpen(false); }} initialFocus className="bg-brand-dark-gray" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Analyze Button */}
          <div className="mt-6 flex justify-center">
            <Button onClick={fetchAnalysis} data-testid="analyze-button"
              disabled={!player1 || !player2 || analysisLoading}
              className="bg-brand-yellow text-brand-black font-heading uppercase tracking-wider px-8 hover:bg-brand-yellow/90 disabled:opacity-50">
              {analysisLoading ? (
                <><div className="w-4 h-4 border-2 border-brand-black/30 border-t-brand-black rounded-full animate-spin" /><span className="ml-2">Analizando...</span></>
              ) : (
                <><BarChart3 className="w-4 h-4 mr-2" />Analizar</>
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
        {analysisData && (
          <div className="space-y-6">
            {/* VS Header */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#2196F3]/20 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-8 h-8 text-[#2196F3]" />
                  </div>
                  <p className="font-heading text-xl text-white uppercase tracking-wide">{player1Data?.nickname || 'J1'}</p>
                </div>
                <div className="px-6">
                  <span className="font-heading text-3xl text-brand-gray">VS</span>
                </div>
                <div className="flex-1 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#FF5722]/20 flex items-center justify-center mx-auto mb-2">
                    <Users className="w-8 h-8 text-[#FF5722]" />
                  </div>
                  <p className="font-heading text-xl text-white uppercase tracking-wide">{player2Data?.nickname || 'J2'}</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Partidos" value={analysisData.total_matches} icon={<Trophy className="w-5 h-5 text-brand-yellow" />} />
              <StatBox label="Puntos Totales" value={analysisData.total_points} icon={<Target className="w-5 h-5 text-brand-yellow" />} />
              <StatBox label="Victorias" value={`${analysisData.player1_wins} - ${analysisData.player2_wins}`}
                sub={`${player1Data?.nickname || 'J1'} - ${player2Data?.nickname || 'J2'}`} />
              <StatBox label="Games" value={`${analysisData.player1_games} - ${analysisData.player2_games}`}
                sub={`${player1Data?.nickname || 'J1'} - ${player2Data?.nickname || 'J2'}`} />
            </div>

            {/* Points effectiveness */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
              <p className="text-brand-gray text-xs font-heading uppercase tracking-wider text-center mb-4">Efectividad de Puntos</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="font-heading text-3xl font-bold text-[#2196F3]">{analysisData.player1_points}</p>
                  <p className="text-brand-gray text-xs">{player1Data?.nickname}</p>
                  <p className="text-[#2196F3] font-heading text-sm font-bold">
                    {analysisData.total_points > 0 ? Math.round((analysisData.player1_points / analysisData.total_points) * 100) : 0}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-heading text-3xl font-bold text-[#FF5722]">{analysisData.player2_points}</p>
                  <p className="text-brand-gray text-xs">{player2Data?.nickname}</p>
                  <p className="text-[#FF5722] font-heading text-sm font-bold">
                    {analysisData.total_points > 0 ? Math.round((analysisData.player2_points / analysisData.total_points) * 100) : 0}%
                  </p>
                </div>
              </div>
              {/* Bar */}
              <div className="h-3 bg-brand-black rounded-full overflow-hidden flex">
                <div className="h-full bg-[#2196F3] transition-all duration-500"
                  style={{ width: `${analysisData.total_points > 0 ? (analysisData.player1_points / analysisData.total_points) * 100 : 50}%` }} />
                <div className="h-full bg-[#FF5722] transition-all duration-500"
                  style={{ width: `${analysisData.total_points > 0 ? (analysisData.player2_points / analysisData.total_points) * 100 : 50}%` }} />
              </div>
            </div>

            {/* Heatmaps */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-xl p-6">
              <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wider text-center mb-4">Mapa de Calor - Zonas de Punto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CourtHeatmap points={analysisData.p1PointsList} color="#2196F3" label="player1" playerName={player1Data?.nickname || 'Jugador 1'} />
                <CourtHeatmap points={analysisData.allPoints} color="#9C27B0" label="todos" playerName="Todos" />
                <CourtHeatmap points={analysisData.p2PointsList} color="#FF5722" label="player2" playerName={player2Data?.nickname || 'Jugador 2'} />
              </div>
            </div>

            {/* Top 5 Reasons */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
              <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wider text-center mb-4">Top 5 Motivos de Punto</h3>
              <div className="space-y-3">
                {analysisData.topReasons.map((r, i) => {
                  const maxCount = analysisData.topReasons[0]?.total || 1;
                  return (
                    <div key={r.reason} data-testid={`reason-${i}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-heading text-sm">{r.reason}</span>
                        <span className="text-brand-gray text-xs font-heading">{r.total}</span>
                      </div>
                      <div className="h-5 bg-brand-black rounded-full overflow-hidden flex">
                        <div className="h-full bg-[#2196F3] transition-all duration-500 flex items-center justify-end pr-1"
                          style={{ width: `${(r.p1 / maxCount) * 100}%` }}>
                          {r.p1 > 0 && <span className="text-white text-[10px] font-bold">{r.p1}</span>}
                        </div>
                        <div className="h-full bg-[#FF5722] transition-all duration-500 flex items-center justify-start pl-1"
                          style={{ width: `${(r.p2 / maxCount) * 100}%` }}>
                          {r.p2 > 0 && <span className="text-white text-[10px] font-bold">{r.p2}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
                  <span className="text-brand-gray">{player1Data?.nickname}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-[#FF5722]" />
                  <span className="text-brand-gray">{player2Data?.nickname}</span>
                </div>
              </div>
            </div>

            {/* Match List */}
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
              <h3 className="font-heading text-sm text-brand-gray uppercase tracking-wider text-center mb-4">Partidos Analizados</h3>
              <div className="space-y-2">
                {analysisData.matches.map((m) => {
                  const isP1Winner = m.winner_id === player1;
                  const p1G = m.player1_id === player1 ? m.player1_games : m.player2_games;
                  const p2G = m.player1_id === player1 ? m.player2_games : m.player1_games;
                  const dateStr = m.match_date ? format(new Date(m.match_date), 'd MMM yyyy', { locale: es }) : '';
                  return (
                    <div key={m.match_id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`font-heading text-lg font-bold ${isP1Winner ? 'text-[#2196F3]' : 'text-[#FF5722]'}`}>
                          {p1G} - {p2G}
                        </span>
                        <span className="text-brand-gray text-xs">{m.tournament_name}</span>
                      </div>
                      <span className="text-brand-gray text-xs">{dateStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Initial State */}
        {!analysisData && (!player1 || !player2) && (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-brand-gray mx-auto mb-4" />
            <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">Selecciona dos jugadores</p>
            <p className="text-brand-gray font-body">Elige los jugadores para ver el análisis head-to-head</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

const StatBox = ({ label, value, sub, icon }) => (
  <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4 text-center">
    {icon && <div className="flex justify-center mb-1">{icon}</div>}
    <p className="font-heading text-2xl font-bold text-white">{value}</p>
    <p className="text-brand-gray text-[10px] font-heading uppercase tracking-wider mt-1">{label}</p>
    {sub && <p className="text-brand-gray text-[9px] mt-0.5">{sub}</p>}
  </div>
);

export default Analysis;
