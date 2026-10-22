import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Plus, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  Building2,
  Users,
  ShieldAlert,
  Activity
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { login, allUsers, allRoles } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter your email or Staff ID.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const res = login(email, password);
      setIsSubmitting(false);

      if (res.success) {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setErrorMsg(res.message || 'Invalid credentials. Please verify your email and password.');
      }
    }, 200);
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);

    const res = login(demoEmail, demoPass);
    if (res.success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  // Quick Demo Profiles
  const quickProfiles = [
    {
      role: 'Super Admin',
      name: 'Dr. Alexander Wright',
      email: 'admin@phamerp.io',
      pass: 'admin123',
      color: 'border-purple-500/40 bg-purple-950/30 text-purple-300 hover:border-purple-400',
      badgeColor: 'bg-purple-500/20 text-purple-300',
    },
    {
      role: 'Pharmacy Manager',
      name: 'Sarah Conner, PharmD',
      email: 's.conner@phamerp.io',
      pass: 'pharma123',
      color: 'border-indigo-500/40 bg-indigo-950/30 text-indigo-300 hover:border-indigo-400',
      badgeColor: 'bg-indigo-500/20 text-indigo-300',
    },
    {
      role: 'Pharmacist',
      name: 'Marcus Vance, BPharm',
      email: 'm.vance@phamerp.io',
      pass: 'pharma123',
      color: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:border-emerald-400',
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      role: 'Cashier',
      name: 'Emily Davis',
      email: 'e.davis@phamerp.io',
      pass: 'pharma123',
      color: 'border-amber-500/40 bg-amber-950/30 text-amber-300 hover:border-amber-400',
      badgeColor: 'bg-amber-500/20 text-amber-300',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0c121e] via-[#111827] to-[#18182f] flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 select-none relative overflow-hidden">
      {/* Decorative background glow spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 border border-emerald-400/30 p-2">
            <Plus className="w-10 h-10 text-white stroke-[3]" />
          </div>

          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>PharmaPulse</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-widest">
                ERP OS
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Enterprise Pharmacy, Clinical POS &amp; Regulatory Management
            </p>
          </div>
        </div>

        {/* Main Glassmorphic Login Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Terminal Authorization</span>
            </h2>
            <p className="text-xs text-slate-400">
              Sign in with your registered employee credentials to unlock your workspace.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block">
                Staff Email / Login ID
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-500 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="e.g. admin@phamerp.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-300 block">
                  Password
                </label>
                <span className="text-[10px] text-slate-500">
                  Default: <code className="text-emerald-400 font-mono">admin123</code> / <code className="text-emerald-400 font-mono">pharma123</code>
                </span>
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-500 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember & Terminal Status */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                />
                <span>Remember session</span>
              </label>

              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                Terminal Online
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 mt-2 text-xs"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Terminal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Fast Login Buttons */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                1-Click Quick Demo Sign In
              </span>
              <span>Fast Testing</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {quickProfiles.map((p) => (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => handleQuickLogin(p.email, p.pass)}
                  className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${p.color}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] truncate">{p.role}</span>
                    <span className={`text-[8px] font-bold px-1 rounded uppercase ${p.badgeColor}`}>
                      Demo
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {p.name.split(',')[0]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="text-center text-[10px] text-slate-500 space-y-1">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>DGDA / Hospital Regulated</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>256-Bit Encrypted</span>
            </span>
          </div>
          <p>© 2026 PharmaPulse Hospital OS. Authorized medical and pharmacy staff only.</p>
        </div>
      </div>
    </div>
  );
};
