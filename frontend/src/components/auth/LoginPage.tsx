import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Lock, 
  BadgeCheck, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Plus, 
  AlertTriangle,
  Sparkles,
  Activity,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = employeeId.trim();
    if (!cleanId) {
      setErrorMsg('Please enter your Employee ID.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = login(cleanId, password);
      setIsSubmitting(false);

      if (res.success) {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setErrorMsg(res.message || 'Invalid Employee ID or password. Please verify and try again.');
      }
    }, 200);
  };

  const handleQuickAdminLogin = () => {
    setEmployeeId('admin');
    setPassword('1800');
    setErrorMsg(null);

    const res = login('admin', '1800');
    if (res.success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen w-full bg-radial from-[#0d1627] via-[#090d16] to-[#04060b] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 select-none relative overflow-hidden font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[650px] h-[650px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[650px] h-[650px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[20%] w-[350px] h-[350px] bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Subtle Background Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="w-full max-w-[440px] space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-18 h-18 rounded-3xl bg-gradient-to-tr from-emerald-500 via-emerald-600 to-teal-700 shadow-2xl shadow-emerald-500/30 border border-emerald-400/40 p-2.5 transition-transform hover:scale-105 duration-300">
            <Plus className="w-12 h-12 text-white stroke-[3.5] drop-shadow-md" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2.5">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-sm">
                PharmaPulse
              </h1>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold uppercase tracking-widest shadow-inner">
                ERP OS
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium tracking-wide">
              Clinical POS &bull; Smart Inventory &bull; Regulatory Enterprise
            </p>
          </div>
        </div>

        {/* Main Glassmorphic Login Card */}
        <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-800/90 hover:border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] space-y-5 transition-all">
          <div className="space-y-1.5 pb-2 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <KeyRound className="w-4 h-4" />
                </span>
                <span>Terminal Authorization</span>
              </h2>
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Online
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sign in with your registered Employee ID to unlock your workstation.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-shake shadow-inner">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="flex-1">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Employee ID Field (NO EMAIL, NO @ REQUIRED) */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 flex items-center justify-between">
                <span>Employee ID</span>
                <span className="text-[10px] text-slate-500 font-normal">No email required</span>
              </label>
              <div className="relative flex items-center group">
                <div className="absolute left-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                  <BadgeCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  autoFocus
                  placeholder="e.g. admin or EMP-001"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-950/70 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                Terminal Password
              </label>
              <div className="relative flex items-center group">
                <div className="absolute left-3.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your security password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700/80 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Session Option */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300 transition-colors">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                />
                <span className="text-[11px]">Remember active session</span>
              </label>

              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                256-Bit SSL
              </span>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white rounded-2xl font-bold shadow-xl shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 mt-3 text-xs tracking-wide"
            >
              <span>{isSubmitting ? 'Authenticating Terminal...' : 'Sign In to Terminal'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {/* Quick 1-Click Super Admin Access */}
          <div className="pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleQuickAdminLogin}
              className="w-full py-2.5 px-3 rounded-2xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 hover:border-purple-500/60 text-purple-200 transition-all cursor-pointer flex items-center justify-between text-xs font-semibold group shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs">
                  👑
                </span>
                <div className="text-left">
                  <div className="font-bold text-[11px] text-purple-200 group-hover:text-white transition-colors">
                    Quick Sign-In: Super Admin
                  </div>
                  <div className="text-[10px] text-purple-400/80 font-mono">
                    ID: admin &bull; Pass: 1800
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                1-Click
              </span>
            </button>
          </div>
        </div>

        {/* Footer Security Certifications */}
        <div className="text-center text-[10px] text-slate-500 space-y-1.5">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>DGDA Regulated</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>ISO 27001 Certified</span>
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>End-to-End Audit</span>
            </span>
          </div>
          <p className="text-slate-500 text-[10px]">
            &copy; 2026 PharmaPulse Hospital OS. Authorized medical and pharmacy staff only.
          </p>
        </div>
      </div>
    </div>
  );
};
