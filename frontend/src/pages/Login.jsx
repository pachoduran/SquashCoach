import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      toast.success('¡Bienvenido de nuevo!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <img 
          src="https://customer-assets.emergentagent.com/job_squash-coach-web/artifacts/ijowgans_adaptive-icon.png" 
          alt="Squash Coach" 
          className="w-72 h-72 mx-auto mb-4"
        />
        <h1 className="font-heading text-3xl tracking-wide">
          <span className="text-brand-gray">SQUASH</span>
          <span className="text-brand-yellow ml-2">COACH</span>
        </h1>
      </div>

      {/* Login Form */}
      <div className="w-full max-w-sm bg-brand-dark-gray border border-white/10 rounded-xl p-6">
        <h2 className="font-heading text-xl text-white uppercase tracking-wide mb-6 text-center">
          Iniciar Sesión
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-brand-gray font-heading uppercase text-xs tracking-wider">
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              data-testid="login-email-input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-brand-black border-white/20 text-white placeholder:text-brand-gray/50 focus:border-brand-yellow focus:ring-brand-yellow"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-gray font-heading uppercase text-xs tracking-wider">
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                data-testid="login-password-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-brand-black border-white/20 text-white placeholder:text-brand-gray/50 focus:border-brand-yellow focus:ring-brand-yellow pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            data-testid="login-submit-button"
            disabled={loading}
            className="w-full bg-brand-yellow text-brand-black font-heading uppercase tracking-wider hover:bg-brand-yellow/90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-brand-gray font-body text-sm">
            ¿No tienes cuenta?{' '}
            <Link 
              to="/register" 
              data-testid="register-link"
              className="text-brand-yellow hover:underline font-medium"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-brand-gray/50 text-xs font-body">
        © 2025 Squash Coach. Todos los derechos reservados.
      </p>
    </div>
  );
};

export default Login;
