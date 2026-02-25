import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Users, User, Search, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export const Players = () => {
  const { api } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/players');
      setPlayers(response.data || []);
    } catch (err) {
      console.error('Error fetching players:', err);
      setError('Error al cargar los jugadores');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlayers = players.filter(player =>
    player.nickname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando jugadores..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="players-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-white uppercase tracking-wide">
              Jugadores
            </h1>
            <p className="text-brand-gray font-body mt-1">
              {filteredPlayers.length} jugador{filteredPlayers.length !== 1 ? 'es' : ''} registrado{filteredPlayers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
          <Input
            placeholder="Buscar jugador..."
            data-testid="player-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-brand-dark-gray border-white/20 text-white placeholder:text-brand-gray/50"
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-body">{error}</p>
            <Button 
              onClick={fetchPlayers} 
              variant="ghost" 
              size="sm"
              className="ml-auto text-red-400 hover:text-red-300"
            >
              Reintentar
            </Button>
          </div>
        )}

        {/* Players Grid */}
        {filteredPlayers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map(player => (
              <div 
                key={player.player_id}
                data-testid={`player-card-${player.player_id}`}
                className="bg-brand-dark-gray border border-white/10 rounded-lg p-5 hover:border-brand-yellow/30 transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-brand-yellow/20 flex items-center justify-center">
                    <User className="w-7 h-7 text-brand-yellow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-heading text-lg uppercase tracking-wide truncate">
                      {player.nickname}
                    </p>
                    <p className="text-brand-gray text-xs font-mono truncate">
                      ID: {player.player_id?.slice(-8) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
            <Users className="w-16 h-16 text-brand-gray mx-auto mb-4" />
            <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">
              No hay jugadores
            </p>
            <p className="text-brand-gray font-body">
              {searchTerm 
                ? 'No se encontraron jugadores con ese nombre'
                : 'Aún no tienes jugadores registrados'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Players;
