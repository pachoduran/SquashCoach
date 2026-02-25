import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { MatchCard } from '../components/MatchCard';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Trophy, Target, Percent, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export const Dashboard = () => {
  const { api, user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      console.error('Error fetching data:', err);
      setError('Error al cargar los datos. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.winner_id === m.my_player_id).length;
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Recent matches (last 5)
  const recentMatches = [...matches]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Recent form (last 5 matches result)
  const recentForm = recentMatches.map(m => m.winner_id === m.my_player_id ? 'W' : 'L');

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando dashboard..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-white font-body mb-4">{error}</p>
          <Button onClick={fetchData} className="bg-brand-yellow text-brand-black">
            Reintentar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl text-white uppercase tracking-wide mb-2">
            ¡Hola, <span className="text-brand-yellow">{user?.name || 'Jugador'}</span>!
          </h1>
          <p className="text-brand-gray font-body">
            Aquí está el resumen de tu rendimiento
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="Partidos Totales" 
            value={totalMatches} 
            icon={Trophy}
          />
          <StatCard 
            label="Victorias" 
            value={wins} 
            icon={Target}
            highlight
          />
          <StatCard 
            label="Derrotas" 
            value={losses} 
            icon={Target}
          />
          <StatCard 
            label="% Victorias" 
            value={`${winRate}%`} 
            icon={Percent}
            highlight={winRate >= 50}
          />
        </div>

        {/* Recent Form */}
        {recentForm.length > 0 && (
          <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg text-white uppercase tracking-wide">
                Forma Reciente
              </h2>
              <TrendingUp className="w-5 h-5 text-brand-yellow" />
            </div>
            <div className="flex gap-2">
              {recentForm.map((result, index) => (
                <div 
                  key={index}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-heading text-lg font-bold ${
                    result === 'W' 
                      ? 'bg-green-500/20 text-green-500 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-500 border border-red-500/30'
                  }`}
                >
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Matches */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl text-white uppercase tracking-wide">
              Partidos Recientes
            </h2>
            <Link 
              to="/matches"
              data-testid="view-all-matches-link"
              className="text-brand-yellow font-heading text-sm uppercase tracking-wide flex items-center gap-1 hover:underline"
            >
              Ver todos
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {recentMatches.length > 0 ? (
            <div className="space-y-3">
              {recentMatches.map(match => (
                <MatchCard 
                  key={match.match_id} 
                  match={match} 
                  players={players} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-8 text-center">
              <Trophy className="w-12 h-12 text-brand-gray mx-auto mb-4" />
              <p className="text-white font-heading text-lg uppercase tracking-wide mb-2">
                Sin partidos aún
              </p>
              <p className="text-brand-gray font-body text-sm">
                Tus partidos registrados aparecerán aquí
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
