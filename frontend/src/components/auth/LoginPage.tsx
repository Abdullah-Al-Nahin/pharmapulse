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
      className="min-h-screen w-full flex items-center justify-center p-4 select-none relative font-sans"
      style={{
        backgroundColor: '#f8fafc',
        backgroundImage: `
          linear-gradient(to right, rgba(226, 232, 240, 0.75) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(226, 232, 240, 0.75) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      }}
    >
      {/* Central White Login Card */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] max-w-[370px] w-full p-7 sm:p-8 relative transition-all">
        
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
          {/* Logo SVG Icon with Teal Palettes */}
          <div className="flex justify-center mb-3">
            <svg 
              width="64" 
              height="64" 
              viewBox="0 0 64 64" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="transition-transform duration-300 hover:scale-105"
            >
              {/* Outer Teal Arc */}
              <path 
                d="M 32 8 A 24 24 0 1 0 56 32" 
                stroke="#0d9488" 
                strokeWidth="4.5" 
                strokeLinecap="round" 
              />
              {/* Inner Light Teal Arc */}
              <path 
                d="M 32 17 A 15 15 0 1 0 47 32" 
                stroke="#14b8a6" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
              />
              {/* Green Horizontal Connection & Arrow */}
              <circle cx="32" cy="32" r="4.5" fill="#22c55e" />
              <path 
                d="M 32 32 L 53 32" 
                stroke="#22c55e" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
              />
              <path 
                d="M 48 26 L 53 32 L 48 38" 
                stroke="#22c55e" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
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
