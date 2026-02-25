import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { MatchCard } from '../components/MatchCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Share2, Users, ChevronRight, AlertCircle, UserCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export const SharedMatches = () => {
  const { api } = useAuth();
  const [sharedUsers, setSharedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userMatches, setUserMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSharedUsers();
  }, []);

  const fetchSharedUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/share/shared-with-me');
      setSharedUsers(response.data || []);
    } catch (err) {
      console.error('Error fetching shared users:', err);
      setError('Error al cargar usuarios compartidos');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMatches = async (userId) => {
    try {
      setMatchesLoading(true);
      setError(null);
      const response = await api.get(`/api/share/user/${userId}/matches`);
      setUserMatches(response.data?.matches || response.data || []);
      setPlayers(response.data?.players || []);
      setSelectedUser(userId);
    } catch (err) {
      console.error('Error fetching user matches:', err);
      setError('Error al cargar los partidos compartidos');
    } finally {
      setMatchesLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner message="Cargando usuarios compartidos..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="shared-matches-page">
        {/* Header */}
        <div>
          <h1 className="font-heading text-3xl text-white uppercase tracking-wide">
            Partidos Compartidos
          </h1>
          <p className="text-brand-gray font-body mt-1">
            Partidos que otros usuarios comparten contigo
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 font-body">{error}</p>
            <Button 
              onClick={fetchSharedUsers} 
              variant="ghost" 
              size="sm"
              className="ml-auto text-red-400 hover:text-red-300"
            >
              Reintentar
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="lg:col-span-1">
            <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-4">
              <h2 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Usuarios
              </h2>
              
              {sharedUsers.length > 0 ? (
                <div className="space-y-2">
                  {sharedUsers.map(user => (
                    <button
                      key={user.user_id}
                      onClick={() => fetchUserMatches(user.user_id)}
                      data-testid={`shared-user-${user.user_id}`}
                      className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${
                        selectedUser === user.user_id
                          ? 'bg-brand-yellow/10 border border-brand-yellow/30'
                          : 'bg-brand-black border border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          selectedUser === user.user_id
                            ? 'bg-brand-yellow/20'
                            : 'bg-white/10'
                        }`}>
                          <UserCircle className={`w-6 h-6 ${
                            selectedUser === user.user_id
                              ? 'text-brand-yellow'
                              : 'text-brand-gray'
                          }`} />
                        </div>
                        <div className="text-left">
                          <p className={`font-heading uppercase tracking-wide ${
                            selectedUser === user.user_id
                              ? 'text-brand-yellow'
                              : 'text-white'
                          }`}>
                            {user.name || 'Usuario'}
                          </p>
                          <p className="text-brand-gray text-xs font-body">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${
                        selectedUser === user.user_id
                          ? 'text-brand-yellow'
                          : 'text-brand-gray'
                      }`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Share2 className="w-12 h-12 text-brand-gray mx-auto mb-3" />
                  <p className="text-brand-gray font-body text-sm">
                    Nadie comparte partidos contigo aún
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Matches List */}
          <div className="lg:col-span-2">
            {matchesLoading ? (
              <LoadingSpinner message="Cargando partidos..." />
            ) : selectedUser ? (
              <div className="space-y-3">
                <h2 className="font-heading text-sm text-brand-gray uppercase tracking-wide mb-4">
                  Partidos de {sharedUsers.find(u => u.user_id === selectedUser)?.name || 'Usuario'}
                </h2>
                
                {userMatches.length > 0 ? (
                  userMatches.map(match => (
                    <MatchCard 
                      key={match.match_id} 
                      match={match} 
                      players={players}
                      linkPrefix={`/shared/${selectedUser}/matches`}
                    />
                  ))
                ) : (
                  <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
                    <Share2 className="w-12 h-12 text-brand-gray mx-auto mb-4" />
                    <p className="text-white font-heading uppercase tracking-wide mb-2">
                      Sin partidos
                    </p>
                    <p className="text-brand-gray font-body text-sm">
                      Este usuario no tiene partidos compartidos
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-brand-dark-gray border border-white/10 rounded-lg p-12 text-center">
                <Users className="w-16 h-16 text-brand-gray mx-auto mb-4" />
                <p className="text-white font-heading text-xl uppercase tracking-wide mb-2">
                  Selecciona un usuario
                </p>
                <p className="text-brand-gray font-body">
                  Elige un usuario de la lista para ver sus partidos compartidos
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SharedMatches;
