import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BrainCircuit, Sparkles, ArrowRight, CheckCircle,
  GraduationCap, Users,
  DatabaseZap, Cpu, ShieldCheck, Lightbulb, ClipboardList,
  BarChart2, TrendingUp, Mail,
  Star, Zap, Target, Activity
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PageTransition from '../components/PageTransition';
import { useProfileContext } from '../context/ProfileContext';

/* ─── Animation variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};
const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ═══════════════════════════════════════════
   LANDING PAGE
═══════════════════════════════════════════ */
const LandingPage = () => {
  const { profile } = useProfileContext();

  return (
    <PageTransition>
      <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
        <Navbar profile={profile} />
        <HeroSection />
        <BenefitsSection />
        <HowItWorksSection />
        <CtaBanner />
        <Footer />
      </div>
    </PageTransition>
  );
};

/* ═══════════════════════════════════════════
   HERO
═══════════════════════════════════════════ */
const HeroSection = () => (
  <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center overflow-hidden bg-slate-950 px-4 py-14 sm:py-20">
    {/* layered gradients */}
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/50 via-slate-950 to-cyan-900/30 pointer-events-none" />
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[80vw] h-[80vw] max-w-[44rem] max-h-[44rem] bg-indigo-600/20 rounded-full blur-[7.5rem] pointer-events-none" />
    <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none" />

    {/* Text */}
    <motion.div initial="hidden" animate="visible" variants={stagger} className="relative z-10 max-w-3xl mx-auto">
      <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-sm font-semibold mb-6 backdrop-blur-sm">
        <Sparkles className="h-4 w-4" /> AI-Powered Academic Analytics
      </motion.div>

      <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
        Predict Your{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
          Academic Success
        </span>{' '}
        with AI
      </motion.h1>

      <motion.p variants={fadeUp} className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
        Leverage machine learning to evaluate your study habits, sleep patterns, and mental wellness. Detect academic risk early — and act before it's too late.
      </motion.p>

      <motion.div variants={fadeUp} className="flex flex-col w-full sm:w-auto sm:flex-row gap-3 sm:gap-4 justify-center">
        <Link to="/login">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto px-8 py-4 text-base sm:text-lg font-bold rounded-2xl text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </motion.button>
        </Link>
        <a href="#how-it-works">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="w-full sm:w-auto px-8 py-4 text-base sm:text-lg font-bold rounded-2xl text-white bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15 transition-colors"
          >
            Learn More
          </motion.button>
        </a>
      </motion.div>
    </motion.div>

    {/* Wave divider */}
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
      <svg viewBox="0 0 1440 80" className="w-full text-white fill-current" preserveAspectRatio="none">
        <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" />
      </svg>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   BENEFITS
═══════════════════════════════════════════ */
const BenefitsSection = () => (
  <section className="bg-white py-24 px-4">
    <div className="max-w-6xl mx-auto">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3 block">Why EduPredict AI?</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">Empowering Your Academic Journey</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Tailored intelligence designed to help you reach your full potential.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <BenefitCard color="blue" icon={<GraduationCap className="h-7 w-7 text-white" />} title="Predictive Insights" items={['Risk level prediction', 'Trend visualization', 'Early warning alerts']} />
          <BenefitCard color="blue" icon={<BrainCircuit className="h-7 w-7 text-white" />} title="Personalized Guidance" items={['AI recommendations', 'Stress-aware suggestions', 'Routine optimization']} />
          <BenefitCard color="blue" icon={<Target className="h-7 w-7 text-white" />} title="Outcome Focus" items={['Track consistency', 'Improve attendance', 'Boost study efficiency']} />
        </div>
      </motion.div>
    </div>
  </section>
);

const CARD_COLORS = {
  blue: { bg: 'bg-blue-600', light: 'bg-blue-50', border: 'border-blue-100', check: 'text-blue-500' },
};


const BenefitCard = ({ color, icon, title, items }) => {
  const c = CARD_COLORS[color];
  return (
    <motion.div
      layout
      variants={fadeUp}
      whileHover={{ y: -6 }}
      className={`${c.light} ${c.border} border-2 rounded-3xl overflow-hidden transition-shadow hover:shadow-xl`}
    >
      <div className={`${c.bg} px-6 py-5 flex items-center gap-3`}>
        <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
        <h3 className="text-xl font-extrabold text-white">{title}</h3>
      </div>
      <ul className="px-6 py-6 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle className={`h-5 w-5 shrink-0 mt-0.5 ${c.check}`} />
            <span className="text-slate-700 font-medium leading-snug">{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════
   HOW IT WORKS
═══════════════════════════════════════════ */
const STEPS = [
  { n: '1', icon: <DatabaseZap className="h-7 w-7" />, title: 'Input Data', text: 'Enter attendance, sleep hours, study time, social media usage, and stress level.', color: 'bg-violet-600', light: 'text-violet-600 bg-violet-50' },
  { n: '2', icon: <Cpu className="h-7 w-7" />, title: 'AI Analysis', text: 'Our Random Forest model processes your behavioral data with 88%+ accuracy.', color: 'bg-blue-600', light: 'text-blue-600 bg-blue-50' },
  { n: '3', icon: <ShieldCheck className="h-7 w-7" />, title: 'Risk Prediction', text: 'Get an instant Low, Medium, or High academic risk level classification.', color: 'bg-rose-600', light: 'text-rose-600 bg-rose-50' },
  { n: '4', icon: <Lightbulb className="h-7 w-7" />, title: 'Get Insights', text: 'Receive actionable advice tailored to your specific behavioral profile.', color: 'bg-amber-500', light: 'text-amber-600 bg-amber-50' },
  { n: '5', icon: <ClipboardList className="h-7 w-7" />, title: 'View History', text: 'Browse your full prediction history in a structured, searchable table.', color: 'bg-teal-600', light: 'text-teal-600 bg-teal-50' },
  { n: '6', icon: <BarChart2 className="h-7 w-7" />, title: 'Monitor Progress', text: 'Visual Recharts dashboards track your trends over time.', color: 'bg-indigo-600', light: 'text-indigo-600 bg-indigo-50' },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="bg-slate-50 py-24 px-4">
    <div className="max-w-6xl mx-auto">
      <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
        <motion.div variants={fadeUp} className="text-center mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3 block">The Process</span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">How It Works</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Six simple steps from data input to continuous academic monitoring.</p>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:hidden absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
          {STEPS.map((step, i) => (
            <motion.div
              layout
              key={i} variants={fadeUp}
              whileHover={{ y: -6, scale: 1.02 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden group md:ml-0 ml-5"
            >
              <div className="md:hidden absolute left-[-1.6rem] top-7 h-3 w-3 rounded-full bg-indigo-500" />
              <div className="absolute top-0 right-0 text-[7rem] font-black text-slate-100/60 leading-none -mr-4 -mt-4 select-none group-hover:text-slate-100 transition-colors">
                {step.n}
              </div>
              <div className={`h-14 w-14 rounded-2xl ${step.color} flex items-center justify-center text-white mb-5 shadow-lg relative z-10`}>
                {step.icon}
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2 relative z-10">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed relative z-10">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   CTA BANNER
═══════════════════════════════════════════ */
const CtaBanner = () => (
  <section className="relative py-24 px-4 overflow-hidden bg-slate-950">
    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/60 to-cyan-900/40 pointer-events-none" />
    <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
    <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none" />

    <motion.div
      initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
      className="relative z-10 max-w-3xl mx-auto text-center"
    >
      <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-sm font-semibold mb-6">
        <Zap className="h-4 w-4" /> Take Action Today
      </motion.div>
      <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
        Ready to Secure Your Academic Future?
      </motion.h2>
      <motion.p variants={fadeUp} className="text-lg text-slate-300 mb-10 leading-relaxed max-w-2xl mx-auto">
        Join students who are already using AI to predict and prevent academic burnout. Your personalized risk report is just one click away.
      </motion.p>
      <motion.div variants={fadeUp}>
        <Link to="/login">
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
            className="px-10 py-5 text-lg font-extrabold rounded-2xl text-white bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.3)]"
          >
            Get Your Prediction Now →
          </motion.button>
        </Link>
      </motion.div>
    </motion.div>
  </section>
);


/* ═══════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════ */
const Footer = () => (
  <footer className="bg-slate-950 text-slate-400 border-t border-slate-800">
    <div className="max-w-6xl mx-auto px-4 py-16">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        {/* Brand */}
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2.5 mb-4">
            <BrainCircuit className="h-7 w-7 text-cyan-400" />
            <span className="text-white font-extrabold text-lg">EduPredict AI</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            An AI-powered risk prediction platform helping students and educators understand academic behavior patterns through machine learning.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
          <ul className="space-y-2.5 text-sm">
            {[['/', 'Home'], ['/login', 'Sign In'], ['/predict', 'New Prediction'], ['/dashboard', 'Dashboard']].map(([href, label]) => (
              <li key={href}>
                <Link to={href} className="hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Features */}
        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Features</h4>
          <ul className="space-y-2.5 text-sm">
            {['AI Risk Prediction', 'Smart Suggestions', 'Progress Dashboard', 'History Tracking', 'JWT Authentication'].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Connect</h4>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="mailto:hello@edupredict.ai" className="flex items-center gap-2.5 hover:text-white transition-colors">
                <Mail className="h-4 w-4" /> hello@edupredict.ai
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
        <p>© {new Date().getFullYear()} EduPredict AI. All rights reserved.</p>
        <div className="flex items-center gap-1 text-slate-500">
          Built with <Activity className="h-4 w-4 text-rose-500 mx-1" /> and React + FastAPI
        </div>
      </div>
    </div>
  </footer>
);

export default LandingPage;
