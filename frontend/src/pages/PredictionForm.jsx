import React, { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, CheckCircle, ShieldAlert, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { submitPrediction } from '../utils/api';
import { useProfileContext } from '../context/ProfileContext';
import { NotificationContext } from '../context/NotificationContext';

const steps = [
  {
    id: 'attendance',
    title: 'Attendance',
    emoji: '📅',
    label: 'What is your current attendance percentage?',
    min: 0, max: 100, step: 1,
    unit: '%',
  },
  {
    id: 'study_hours',
    title: 'Study Habits',
    emoji: '📚',
    label: 'Average study hours per day?',
    min: 0, max: 16, step: 0.5,
    unit: 'hrs',
  },
  {
    id: 'sleep',
    title: 'Sleep Pattern',
    emoji: '😴',
    label: 'Average hours of sleep per night?',
    min: 3, max: 14, step: 0.5,
    unit: 'hrs',
  },
  {
    id: 'social_media_usage',
    title: 'Screen Time',
    emoji: '📱',
    label: 'Daily social media usage in hours?',
    min: 0, max: 16, step: 0.5,
    unit: 'hrs',
  },
  {
    id: 'stress',
    title: 'Mental Health',
    emoji: '🧠',
    label: 'Rate your baseline stress level (1 = Relaxed, 10 = Overwhelmed)',
    min: 1, max: 10, step: 1,
    unit: '/10',
  },
  {
    id: 'assignment_status',
    title: 'Assignment Status',
    emoji: '📝',
    label: 'Current assignment completion status',
    options: [
      { label: 'On Track', value: 'on_track' },
      { label: 'Delayed', value: 'delayed' },
      { label: 'Overdue', value: 'overdue' },
    ],
  },
];

const PredictionForm = () => {
  const { profile } = useProfileContext();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    attendance: 80,
    study_hours: 4,
    sleep: 7,
    social_media_usage: 3,
    stress: 5,
    assignment_status: 'on_track',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addNotification } = useContext(NotificationContext);
  const previousRiskRef = useRef(null);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      submitForm();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  };

  const submitForm = async () => {
    setLoading(true);
    setError('');

    addNotification?.({
      source: 'Predictions',
      type: 'info',
      title: 'Prediction started',
      message: 'Student risk analysis is running now.',
      event: 'prediction_started',
      timestamp: new Date().toISOString(),
      isRead: false,
      data: { formData },
    });

    try {
      const res = await submitPrediction(formData);
      const nextResult = res.data;
      setResult(nextResult);

      addNotification?.({
        source: 'Predictions',
        type: 'success',
        title: 'Prediction completed',
        message: `Prediction completed with ${nextResult.risk_result || 'Unknown'} risk.`,
        event: 'prediction_completed',
        timestamp: new Date().toISOString(),
        isRead: false,
        data: nextResult,
      });

      if (previousRiskRef.current && previousRiskRef.current !== nextResult.risk_result) {
        addNotification?.({
          source: 'Predictions',
          type: nextResult.risk_result === 'High' ? 'danger' : 'warning',
          title: 'Risk level changed',
          message: `Risk level changed from ${previousRiskRef.current} to ${nextResult.risk_result}.`,
          event: 'risk_level_changed',
          timestamp: new Date().toISOString(),
          isRead: false,
          data: {
            previous_risk: previousRiskRef.current,
            next_risk: nextResult.risk_result,
          },
        });
      }

      previousRiskRef.current = nextResult.risk_result;
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      }
      setError(err.response?.data?.detail || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const riskColor = result
    ? result.risk_result === 'High'
      ? 'text-red-600'
      : result.risk_result === 'Medium'
      ? 'text-amber-600'
      : 'text-green-600'
    : '';

  const riskBg = result
    ? result.risk_result === 'High'
      ? 'bg-red-100 dark:bg-red-900/30'
      : result.risk_result === 'Medium'
      ? 'bg-amber-100 dark:bg-amber-900/30'
      : 'bg-green-100 dark:bg-green-900/30'
    : '';

  const RiskIcon =
    result?.risk_result === 'High'
      ? ShieldAlert
      : result?.risk_result === 'Medium'
      ? AlertTriangle
      : CheckCircle;

  const confidenceScore = typeof result?.confidence_score === 'number' ? result.confidence_score : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors selection:bg-cyan-300 selection:text-slate-950">
      <Navbar profile={profile} />

      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in">
        {!result ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
            </div>

            <div className="p-8 md:p-12">
              <div className="text-center mb-10">
                <span className="text-4xl">{step.emoji}</span>
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mt-3 mb-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  {step.title}
                </h1>
              </div>

              <div className="py-6 text-center" key={step.id}>
                <label className="block text-lg font-medium text-slate-600 dark:text-slate-300 mb-10 max-w-sm mx-auto leading-relaxed">
                  {step.label}
                </label>

                {step.options ? (
                  <div className="grid sm:grid-cols-3 gap-3 max-w-xl mx-auto">
                    {step.options.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, [step.id]: option.value })}
                        className={`px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                          formData[step.id] === option.value
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <input
                      type="range"
                      min={step.min}
                      max={step.max}
                      step={step.step}
                      value={formData[step.id]}
                      onChange={(e) =>
                        setFormData({ ...formData, [step.id]: Number(e.target.value) })
                      }
                      className="w-full max-w-sm h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />

                    <div className="mt-6">
                      <span className="text-6xl font-black text-cyan-600 dark:text-cyan-400">
                        {formData[step.id]}
                      </span>
                      <span className="text-2xl text-slate-500 dark:text-slate-400 font-medium ml-1">
                        {step.unit}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 text-center mt-4">{error}</p>
              )}

              <div className="flex justify-between mt-10 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2 px-5 py-3 font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-0 disabled:pointer-events-none"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <button
                  onClick={handleNext}
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3 bg-slate-900 dark:bg-cyan-600 hover:bg-slate-800 dark:hover:bg-cyan-500 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-70"
                >
                  {loading
                    ? 'Analyzing...'
                    : currentStep === steps.length - 1
                    ? 'Analyze Risk'
                    : 'Continue'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Result Card */
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-10 text-center animate-fade-in">
            <div className={`mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-6 ${riskBg}`}>
              <RiskIcon className={`h-12 w-12 ${riskColor}`} />
            </div>

            <h2 className={`text-5xl font-extrabold mb-2 ${riskColor}`}>
              {result.risk_result}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg mb-1">Risk Level</p>

            {/* Confidence bar */}
            <div className="mt-6 mb-8 max-w-xs mx-auto">
              <div className="flex justify-between text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                <span>Confidence</span>
                <span className="font-black text-slate-900 dark:text-cyan-300">{(confidenceScore * 100).toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    result.risk_result === 'High'
                      ? 'bg-red-500'
                      : result.risk_result === 'Medium'
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${confidenceScore * 100}%` }}
                />
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-sm mx-auto">
              {result.risk_result === 'High'
                ? 'Immediate attention is recommended. Consider speaking with a counselor or academic advisor.'
                : result.risk_result === 'Medium'
                ? 'Some areas need improvement. Focus on study habits and sleep consistency.'
                : 'Great job! Keep maintaining your healthy academic habits.'}
            </p>

            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => { setResult(null); setCurrentStep(0); }}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Retake Assessment
              </button>
              <button
                onClick={() => navigate('/dashboard', { state: { refreshed: true } })}
                className="px-6 py-3 bg-cyan-600 text-white font-medium rounded-full hover:bg-cyan-500 transition shadow-lg shadow-cyan-500/30"
              >
                View Dashboard →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PredictionForm;
