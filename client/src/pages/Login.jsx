import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('demo.evaluator@sitesentinel.edu');
    setPassword('demo123456');
    setError('');
    try {
      setLoading(true);
      // Try login first
      try {
        await login('demo.evaluator@sitesentinel.edu', 'demo123456');
        navigate(from, { replace: true });
      } catch (loginErr) {
        // If demo user doesn't exist yet, auto-register them
        const { register } = useAuth();
        await register('Faculty Evaluator', 'demo.evaluator@sitesentinel.edu', 'demo123456');
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError('Demo login failed. You can create an account using Register.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon-wrapper">
            <ShieldCheck size={36} className="text-primary" />
          </div>
          <h2 className="auth-title">SiteSentinel</h2>
          <p className="auth-subtitle">Automated Website Uptime & Performance Monitoring</p>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="login-email"
                type="email"
                className="form-input with-left-icon"
                placeholder="name@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="login-password">Password</label>
            </div>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="login-password"
                type="password"
                className="form-input with-left-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-demo-divider">
          <span>PROJECT DEMONSTRATION</span>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          className="btn btn-demo-quick"
          disabled={loading}
        >
          <Sparkles size={16} className="text-amber" />
          <span>Quick 1-Click Evaluator Demo Login</span>
        </button>

        <div className="auth-footer-prompt">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
