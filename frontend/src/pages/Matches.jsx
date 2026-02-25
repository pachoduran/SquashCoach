import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { MatchCard } from '../components/MatchCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Trophy, Filter, Search, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export const Matches = () => {
  const { api } = useAuth();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterResult, setFilterResult] = useState('all');
  const [filterPlayer, setFilterPlayer] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [matchesRes, playersRes] = await Promise.all([
        api.get('/api/matches'),
        api.get('/api/players')
      ]);
      
      setMatches(matchesRes.data || []);
      setPlayers(playersRes.data || []);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Error al cargar los partidos');
    } finally {
      setLoading(false);
    }
  };

  // Filter matches
  const filteredMatches = matches
    .filter(match => {
      // Result filter
      if (filterResult === 'wins') {
        return match.winner_id === match.my_player_id;
      }
      if (filterResult === 'losses') {
        return match.winner_id !== match.my_player_id;
      }
      return true;
    })
    .filter(match => {
      // Player filter
      if (filterPlayer !== 'all') {
        return match.player1_id === filterPlayer || match.player2_id === filterPlayer;
      }
      return true;
    })
    .filter(match => {
      // Search filter (by tournament or player nickname)
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const player1 = players.find(p => p.player_id === match.player1_id);
        const player2 = players.find(p => p.player_id === match.player2_id);
        return (
          match.tournament_name?.toLowerCase().includes(term) ||
          player1?.nickname?.toLowerCase().includes(term) ||
          player2?.nickname?.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando partidos..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="matches-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-white uppercase tracking-wide">
              Mis Partidos
            </h1>
            <p className="text-brand-gray font-body mt-1">
              {filteredMatches.length} partido{filteredMatches.length !== 1 ? 's' : ''} encontrado{filteredMatches.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-brand-yellow" />
            <span className="font-heading text-sm text-white uppercase tracking-wide">Filtros</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              <Input
                placeholder="Buscar por torneo o jugador..."
                data-testid="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-brand-black border-white/20 text-white placeholder:text-brand-gray/50"
              />
            </div>

            {/* Result Filter */}
            <Select value={filterResult} onValueChange={setFilterResult}>
              <SelectTrigger 
                data-testid="filter-result"
                className="bg-brand-black border-white/20 text-white"
              >
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent className="bg-brand-dark-gray border-white/20">
                <SelectItem value="all" className="text-white">Todos</SelectItem>
                <SelectItem value="wins" className="text-green-500">Victorias</SelectItem>
                <SelectItem value="losses" className="text-red-500">Derrotas</SelectItem>
              </SelectContent>
            </Select>

            {/* Player Filter */}
            <Select value={filterPlayer} onValueChange={setFilterPlayer}>
              <SelectTrigger 
                data-testid="filter-player"
                className="bg-brand-black border-white/20 text-white"
              >
                <SelectValue placeholder="Oponente" />
              </SelectTrigger>
              <SelectContent className="bg-brand-dark-gray border-white/20">
                <SelectItem value="all" className="text-white">Todos los jugadores</SelectItem>
                {players.map(player => (
                  <SelectItem key={player.player_id} value={player.player_id} className="text-white">
                    {player.nickname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-body">{error}</p>
            <Button 
              onClick={fetchData} 
              variant="ghost" 
              size="sm"
              className="ml-auto text-red-400 hover:text-red-300"
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* Matches List */}
        {filteredMatches.length > 0 ? (
          <div className="space-y-3">
            {filteredMatches.map(match => (
              <MatchCard 
                key={match.match_id} 
                match={match} 
                players={players} 
              />
            ))}
          </div>
        ) : (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
            <Trophy className="w-16 h-16 text-brand-gray mx-auto mb-4" />
            <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">
              No hay partidos
            </p>
            <p className="text-brand-gray font-body">
              {searchTerm || filterResult !== 'all' || filterPlayer !== 'all' 
                ? 'No se encontraron partidos con los filtros seleccionados'
                : 'Aún no tienes partidos registrados'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Matches;
