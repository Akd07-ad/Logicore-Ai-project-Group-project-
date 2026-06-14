import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, BrainCircuit, Loader2, Mail, AlertCircle } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { loginUser, registerUser } from '../utils/api';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '' 
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || 'admin@edupredict.ai')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return "Please enter a valid email address.";
    }
    if (formData.password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    return null;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      if (!isLogin) {
        await registerUser({
          password: formData.password,
          email: formData.email,
        });
      }

      const tokenRes = await loginUser({
        email: formData.email,
        password: formData.password,
      });

      localStorage.setItem('token', tokenRes.data.access_token);
      localStorage.setItem('user_id', String(tokenRes.data.user_id));
      localStorage.setItem('user_email', formData.email);
      const destination = adminEmails.includes(formData.email.toLowerCase()) ? '/admin-auth' : '/dashboard';
      navigate(destination);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-3 sm:p-4 relative overflow-hidden font-sans">
        {/* Background Decorative Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-[95vw] sm:w-full max-w-md relative z-10">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4 shadow-lg"
            >
              <BrainCircuit className="w-8 h-8" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {isLogin ? 'Sign in to monitor your academic progress' : 'Join EduPredict AI and start your journey'}
            </p>
          </div>

          {/* Form Card - Glassmorphism */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 sm:p-8 rounded-3xl shadow-2xl"
          >
            <form onSubmit={handleAuth} className="space-y-5">
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  key="email-field"
                >
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder:text-slate-600"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none placeholder:text-slate-600"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-rose-400 text-xs font-medium bg-rose-500/10 p-3 rounded-lg border border-rose-500/20"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-8 text-center sm:flex sm:items-center sm:justify-center sm:gap-2">
              <span className="text-slate-500 text-sm">{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors text-sm"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </div>

            {/* Admin Login Link */}
            <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-slate-500 text-xs">Are you an admin? 
                <button
                  onClick={() => navigate('/admin-auth')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold ml-1 transition-colors"
                >
                  Go to Admin Portal
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AuthPage;
