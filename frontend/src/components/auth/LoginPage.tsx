import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Synchronous, single-click login handler
  const handleLogin = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setErrorMsg(null);

    const cleanId = employeeId.trim();
    if (!cleanId) {
      setErrorMsg('ইউজারনেম প্রবেশ করান (Please enter your Username / Employee ID)');
      return;
    }

    if (!password) {
      setErrorMsg('পাসওয়ার্ড প্রবেশ করান (Please enter your password)');
      return;
    }

    // Direct single-click execution — no artificial delay or setTimeout
    const res = login(cleanId, password);
    if (res.success) {
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } else {
      setErrorMsg(res.message || 'ভুল ইউজারনেম বা পাসওয়ার্ড (Invalid credentials)');
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 select-none relative font-sans overflow-hidden"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: `
          linear-gradient(to right, rgba(226, 232, 240, 0.75) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(226, 232, 240, 0.75) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      }}
    >
      <style>{`
        @keyframes orbDrift1 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(45px, -35px) scale(1.08); }
          100% { transform: translate(-25px, 30px) scale(0.94); }
        }
        @keyframes orbDrift2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-40px, 40px) scale(1.1); }
          100% { transform: translate(35px, -25px) scale(0.92); }
        }
        @keyframes ekgSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes floatCrossA {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.25; }
          50% { transform: translateY(-18px) rotate(45deg); opacity: 0.55; }
        }
        @keyframes floatCrossB {
          0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.2; }
          50% { transform: translateY(-22px) rotate(-45deg); opacity: 0.5; }
        }
        @keyframes pulseRadial {
          0%, 100% { opacity: 0.12; transform: scale(0.96); }
          50% { opacity: 0.22; transform: scale(1.04); }
        }
      `}</style>

      {/* Aesthetic Animated Background System */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        {/* Calming Radial Breath Glow behind Central Card */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-radial from-teal-400/20 via-emerald-300/10 to-transparent blur-[80px]"
          style={{ animation: 'pulseRadial 8s ease-in-out infinite' }}
        />

        {/* Ambient Floating Soft Teal Orb (Top Left) */}
        <div 
          className="absolute -top-24 -left-24 w-[480px] h-[480px] rounded-full bg-teal-300/15 blur-[100px]"
          style={{ animation: 'orbDrift1 18s ease-in-out infinite alternate' }}
        />

        {/* Ambient Floating Soft Mint/Emerald Orb (Bottom Right) */}
        <div 
          className="absolute -bottom-28 -right-28 w-[540px] h-[540px] rounded-full bg-emerald-300/15 blur-[110px]"
          style={{ animation: 'orbDrift2 22s ease-in-out infinite alternate' }}
        />

        {/* Subtle Clinical ECG Waveform Telemetry Strip in Background */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-20 opacity-30 flex items-center justify-center overflow-hidden">
          <svg className="w-full h-16 min-w-[1200px]" viewBox="0 0 1200 64" fill="none" preserveAspectRatio="none">
            <path 
              d="M 0 32 L 380 32 L 395 18 L 408 48 L 424 10 L 440 42 L 452 28 L 468 32 L 740 32 L 755 18 L 768 48 L 784 10 L 800 42 L 812 28 L 828 32 L 1200 32" 
              stroke="#0d9488" 
              strokeWidth="1.5" 
              strokeDasharray="4 4"
            />
          </svg>
          {/* Gentle Light Sweep passing across the Telemetry Line */}
          <div 
            className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-teal-400/20 to-transparent"
            style={{ animation: 'ekgSweep 6s linear infinite' }}
          />
        </div>

        {/* Serene Floating Micro-Medical Crosses & Pharmaceutical Dots */}
        {/* Cross 1 (Top Right) */}
        <div 
          className="absolute top-20 right-[15%] text-teal-600/35 font-mono text-xl select-none"
          style={{ animation: 'floatCrossA 10s ease-in-out infinite' }}
        >
          +
        </div>

        {/* Cross 2 (Bottom Left) */}
        <div 
          className="absolute bottom-24 left-[14%] text-teal-600/30 font-mono text-2xl select-none"
          style={{ animation: 'floatCrossB 14s ease-in-out infinite' }}
        >
          +
        </div>

        {/* Cross 3 (Top Left) */}
        <div 
          className="absolute top-28 left-[18%] text-emerald-600/25 font-mono text-lg select-none"
          style={{ animation: 'floatCrossA 12s ease-in-out infinite 2s' }}
        >
          +
        </div>

        {/* Floating Capsule Silhouette Dot (Bottom Right) */}
        <div 
          className="absolute bottom-36 right-[20%] w-3 h-5 rounded-full border border-teal-500/30 select-none rotate-45"
          style={{ animation: 'floatCrossB 16s ease-in-out infinite 1s' }}
        />

        {/* Micro Pulse Dot (Center Left) */}
        <div 
          className="absolute top-1/2 left-[8%] w-2 h-2 rounded-full bg-teal-500/25 select-none animate-ping"
          style={{ animationDuration: '4s' }}
        />

        {/* Micro Pulse Dot (Center Right) */}
        <div 
          className="absolute top-[45%] right-[9%] w-2 h-2 rounded-full bg-emerald-500/25 select-none animate-ping"
          style={{ animationDuration: '5s' }}
        />
      </div>

      {/* Central White Login Card */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] max-w-[370px] w-full p-7 sm:p-8 relative z-10 transition-all">
        
        {/* Upper-Right Corner Info Icon with Hover Speech Bubble */}
        <div 
          className="absolute top-6 right-6 z-20"
          onMouseEnter={() => setShowInfo(true)}
          onMouseLeave={() => setShowInfo(false)}
        >
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="w-6 h-6 rounded-full border-[1.5px] border-[#0d9488] text-[#0d9488] hover:bg-[#0d9488]/10 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer select-none"
            aria-label="About Us Information"
          >
            i
          </button>

          {/* Tooltip / Speech Bubble */}
          <div 
            className={`absolute top-8 right-0 w-60 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xl transition-all duration-200 pointer-events-auto ${
              showInfo ? 'opacity-100 translate-y-0 visible' : 'opacity-0 -translate-y-1 invisible pointer-events-none'
            }`}
          >
            {/* Speech bubble pointer notch pointing directly to the (i) circle */}
            <div className="absolute -top-1.5 right-2 w-3 h-3 bg-white border-t border-l border-slate-200/90 rotate-45" />

            <div className="relative z-10 space-y-1">
              <h4 className="text-[11px] font-black tracking-wide text-[#0d9488] uppercase">
                ABOUT US
              </h4>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                QUANTUM is a specialized industrial software lab.
              </p>
            </div>
          </div>
        </div>

        {/* Brand Logo & Header */}
        <div className="text-center pt-2 pb-5">
          {/* Custom PHARMA PLUS Pharmaceutical Cross & Vital Pulse Emblem */}
          <div className="flex justify-center mb-3.5">
            <svg 
              width="68" 
              height="68" 
              viewBox="0 0 68 68" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="transition-transform duration-300 hover:scale-105 drop-shadow-sm select-none"
            >
              <defs>
                <linearGradient id="pharmaTealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
                <linearGradient id="pharmaPillGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <filter id="logoDepthShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0d9488" floodOpacity="0.22" />
                </filter>
              </defs>

              {/* Ambient Background Circle Badge */}
              <circle cx="34" cy="34" r="32" fill="#f0fdfa" stroke="#ccfbf1" strokeWidth="1.5" />

              {/* Pharmaceutical Medical Plus & Capsule Form */}
              <g filter="url(#logoDepthShadow)">
                {/* Vertical Capsule Pillar */}
                <rect x="27.5" y="11" width="13" height="46" rx="6.5" fill="url(#pharmaTealGrad)" />

                {/* Horizontal Capsule Pillar */}
                <rect x="11" y="27.5" width="46" height="13" rx="6.5" fill="url(#pharmaTealGrad)" />

                {/* Center Core Node with Deep Teal Contrast */}
                <rect x="25.5" y="25.5" width="17" height="17" rx="5" fill="url(#pharmaPillGrad)" />

                {/* Clinical Vital ECG Heartbeat Waveform across the Plus */}
                <path 
                  d="M 16 34 L 25 34 L 28 27 L 32 41 L 36 29 L 39 37 L 42 34 L 52 34" 
                  stroke="#ffffff" 
                  strokeWidth="2.4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />

                {/* Top-Right Emerald Healing Node */}
                <circle cx="51.5" cy="16.5" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
              </g>
            </svg>
          </div>

          {/* Titles: PHARMA (black) PLUS (teal & tilted) */}
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 font-sans">
            PHARMA <span className="text-[#0d9488] italic">PLUS</span>
          </h1>
          <p className="text-[10px] tracking-[0.25em] font-bold text-slate-500 uppercase mt-1">
            SECURE ACCESS PORTAL
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username / Employee ID Field */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
              ইউজারনেম (USERNAME)
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. admin"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20 transition-all font-medium"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1.5">
              পাসওয়ার্ড (PASSWORD)
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 bg-[#f1f5f9] border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d9488] focus:bg-white focus:ring-2 focus:ring-[#0d9488]/20 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Single-Click Login Button in Teal */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full py-3 px-4 bg-[#0d9488] hover:bg-[#0f766e] active:bg-[#115e59] text-white rounded-xl font-bold text-xs tracking-wide shadow-md shadow-teal-600/25 transition-all cursor-pointer flex items-center justify-center text-center"
            >
              লগইন করুন (LOGIN)
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="border-t border-slate-200/80 my-5" />

        {/* Footer Brand with Teal Accent */}
        <div className="text-center">
          <p className="text-[10px] tracking-[0.25em] font-extrabold text-slate-500 uppercase">
            A <span className="text-[#0d9488] font-black">QUANTUM</span> PROJECT
          </p>
        </div>

      </div>
    </div>
  );
};
