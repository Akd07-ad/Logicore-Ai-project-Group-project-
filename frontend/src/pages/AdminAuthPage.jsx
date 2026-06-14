import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, BrainCircuit, Loader2, Mail, AlertCircle, ShieldAlert } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { loginUser, registerUser } from '../utils/api';

const AdminAuthPage = () => {
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

    // Check if email is admin email before proceeding
    if (!adminEmails.includes(formData.email.toLowerCase())) {
      setError("Admin access denied. Please use an authorized admin email.");
      return;
    }

    setLoading(true);

    try {
      if (!isLogin) {
        // For admin registration, check if email is authorized
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
      navigate('/admin');
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
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-400/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-[95vw] sm:w-full max-w-md relative z-10">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/30 text-red-400 mb-4 shadow-lg"
            >
              <ShieldAlert className="w-8 h-8" />
            </motion.div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isLogin ? 'Admin Portal' : 'Admin Registration'}
            </h1>
            <p className="text-slate-400 mt-2 text-sm">
              {isLogin ? 'Sign in to access admin dashboard' : 'Register your admin account'}
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
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Admin Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-5 h-5" />
                    </div>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none placeholder:text-slate-600"
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
                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3 pl-11 pr-4 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none placeholder:text-slate-600"
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
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    {isLogin ? 'Sign In as Admin' : 'Register as Admin'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Toggle Auth Mode */}
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <p className="text-slate-400 text-sm text-center">
                {isLogin ? "Don't have an admin account? " : "Already have an admin account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-red-400 hover:text-red-300 font-semibold transition-colors"
                >
                  {isLogin ? 'Register' : 'Sign In'}
                </button>
              </p>
            </div>

            {/* Back to Student Login */}
            <div className="mt-4">
              <p className="text-slate-400 text-xs text-center">
                Student?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-slate-300 hover:text-white font-semibold transition-colors"
                >
                  Go to Student Login
                </button>
              </p>
            </div>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400 text-xs"
          >
            <p className="font-semibold mb-1">Admin Portal Security Notice</p>
            <p>Only authorized admin accounts can access this portal. Unauthorized access attempts will be logged.</p>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminAuthPage;
