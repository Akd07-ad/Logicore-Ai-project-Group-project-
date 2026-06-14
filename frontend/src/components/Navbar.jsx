import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Menu, Moon, Sun, X } from 'lucide-react';
import NotificationBell from './NotificationBell';

const DEFAULT_PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 rx=%2216%22 fill=%22%230f172a%22/%3E%3Ccircle cx=%2240%22 cy=%2231%22 r=%2214%22 fill=%22%2322d3ee%22 fill-opacity=%220.3%22/%3E%3Cpath d=%22M18 68c3-10 12-16 22-16s19 6 22 16%22 stroke=%22%2322d3ee%22 stroke-width=%225%22 stroke-linecap=%22round%22 fill=%22none%22/%3E%3C/svg%3E';

const Navbar = ({ profile }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const profileName = (profile?.full_name || '').trim() || 'My Account';
  const rawProfileImage = (profile?.image_url || '').trim();
  const profileImage = rawProfileImage && failedImageUrl !== rawProfileImage ? rawProfileImage : DEFAULT_PROFILE_IMAGE;
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Features', path: '/#features' },
    { name: 'About', path: '/#about' },
    { name: 'Blog', path: '/#blog' },
    { name: 'Pricing', path: '/#pricing' },
  ];

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <nav className="bg-[#0F172A]/95 backdrop-blur-md sticky top-0 z-50 border-b border-slate-700/30 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20">
          
          {/* Core Components: Logo & Text */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <BrainCircuit className="h-7 w-7 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
            <span className="font-extrabold text-xl text-white tracking-tight">EduPredict AI</span>
          </Link>

          {/* Desktop Layout: Horizontal Links */}
          <div className="hidden lg:flex items-center gap-8 text-sm font-medium text-white/90">
            {navLinks.map((link) => (
              <a key={link.name} href={link.path} className="hover:text-cyan-400 transition-colors">
                {link.name}
              </a>
            ))}
          </div>

          {/* Desktop CTA: Prominent Cyan-Blue Button */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <button
              onClick={toggleTheme}
              className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/70 text-slate-200 hover:bg-slate-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {token ? (
              <>
                <NotificationBell />
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-1.5">
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="h-8 w-8 rounded-lg object-cover"
                    onError={() => setFailedImageUrl(rawProfileImage)}
                  />
                  <span className="max-w-28 truncate text-xs font-semibold text-slate-200">{profileName}</span>
                </div>
                <Link to="/dashboard">
                  <motion.button whileHover={{ y: -2 }} className="px-4 py-2.5 text-white/90 hover:text-cyan-400 font-semibold transition-colors">
                    Dashboard
                  </motion.button>
                </Link>
                <button onClick={handleLogout} className="px-4 py-2.5 text-red-400 hover:text-red-300 font-semibold transition-colors">
                  Logout
                </button>
                <Link to="/predict">
                  <motion.button 
                    whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(34, 211, 238, 0.4)" }} 
                    whileTap={{ scale: 0.95 }} 
                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-full font-bold transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Start Prediction
                  </motion.button>
                </Link>
              </>
            ) : (
              <Link to="/predict">
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(34, 211, 238, 0.4)" }} 
                  whileTap={{ scale: 0.95 }} 
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-full font-bold transition-all shadow-lg shadow-cyan-500/20"
                >
                  Start Prediction
                </motion.button>
              </Link>
            )}
          </div>

          {/* Mobile Right Controls */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-800/50 text-slate-200"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {!token && (
              <Link to="/login" className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-900 font-bold text-xs">
                Sign In
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-300 hover:text-white focus:outline-none p-2 rounded-lg bg-slate-800/50"
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-cyan-400" /> : <Menu className="h-6 w-6 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Glass Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              layout
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="lg:hidden fixed top-0 left-0 h-screen w-[82vw] max-w-88 p-4"
            >
              <div className="h-full rounded-3xl bg-slate-900/85 border border-slate-700/60 backdrop-blur-xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-white font-black">Menu</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-800 text-slate-200">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-base font-medium text-white/90 hover:text-cyan-400 transition-colors px-3 py-2 rounded-xl hover:bg-slate-800/70"
                    >
                      {link.name}
                    </a>
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-5 mt-5 flex flex-col gap-3">
                  {token && (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="h-9 w-9 rounded-lg object-cover"
                        onError={() => setFailedImageUrl(rawProfileImage)}
                      />
                      <span className="truncate text-sm font-semibold text-slate-100">{profileName}</span>
                    </div>
                  )}
                  <button onClick={toggleTheme} className="w-full text-center px-4 py-3 text-slate-100 font-bold bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                    {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  </button>
                  {token ? (
                    <>
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="w-full text-center px-4 py-3 text-white/90 font-semibold bg-slate-800/70 rounded-xl hover:bg-slate-800 transition-colors">
                        Dashboard
                      </Link>
                      <button onClick={handleLogout} className="w-full text-center px-4 py-3 text-red-300 font-bold bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors">
                        Logout
                      </button>
                      <Link to="/predict" onClick={() => setMobileMenuOpen(false)} className="w-full text-center px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-bold transition-colors">
                        Start Prediction
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors">
                        Sign In
                      </Link>
                      <Link to="/predict" onClick={() => setMobileMenuOpen(false)} className="w-full text-center px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 rounded-xl font-bold transition-colors">
                        Start Prediction
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
