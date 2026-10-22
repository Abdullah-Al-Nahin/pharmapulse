import React, { useState, useEffect } from 'react';
import {
  Barcode,
  Clock,
  Bell,
  Sun,
  Moon,
  Printer,
  Search,
  AlertTriangle,
  Keyboard,
  Scan,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BranchService } from '../../services/branchService';

interface PharmaPulseHeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: (isDark: boolean) => void;
  onFefoAuditClick?: () => void;
  onPrinterStatusClick?: () => void;
  onSearchFocus?: () => void;
  language: 'EN' | 'BN';
  onToggleLanguage: (lang: 'EN' | 'BN') => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
  onHoldOrder?: () => void;
  onOpenBarcodeScanner?: () => void;
  onOpenInventoryAnomalies?: () => void;
  anomalyCount?: number;
}

export const PharmaPulseHeader: React.FC<PharmaPulseHeaderProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onFefoAuditClick = () => {},
  onPrinterStatusClick = () => {},
  onSearchFocus,
  language,
  onToggleLanguage,
  onOpenSettings,
  onOpenShortcuts,
  onHoldOrder,
  onOpenBarcodeScanner,
  onOpenInventoryAnomalies,
  anomalyCount = 3,
}) => {
  const { currentUser } = useAuth();
  const [branches, setBranches] = useState(() => BranchService.getBranches());
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    return BranchService.subscribe(() => {
      setBranches(BranchService.getBranches());
    });
  }, []);

  const currentBranch = branches.find(
    (b) =>
      (currentUser?.branchId && b.id === currentUser.branchId) ||
      (currentUser?.branchName && b.name.toLowerCase() === currentUser.branchName.toLowerCase()) ||
      (currentUser?.branchId && b.code.toLowerCase() === currentUser.branchId.toLowerCase())
  );

  const displayBranchName = currentUser?.branchName || currentBranch?.name || 'Central Dispensary';
  const displayBranchCode =
    currentBranch?.code ||
    (currentUser?.branchId && currentUser.branchId !== 'main'
      ? currentUser.branchId.toUpperCase()
      : 'REG-01');

  const userInitials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'PH';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 px-6 bg-white dark:bg-[#12161f] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 z-20">
      {/* Left: Store Node & Fast Barcode / Omnibox Trigger */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {/* Branch / Terminal Pill */}
        <div
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xs"
          title={`Active Branch: ${displayBranchName} (${displayBranchCode})`}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]">
            {displayBranchName}
          </span>
          <span className="text-slate-400 dark:text-slate-600">•</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold uppercase text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/60">
            {displayBranchCode}
          </span>
        </div>

        {/* Global Omnibox Search Field */}
        <div
          onClick={onSearchFocus}
          className="w-full flex items-center bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 px-3.5 py-2 text-slate-400 hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">
            {language === 'BN'
              ? 'ওষুধ, জেনেরিক বা বারকোড খুঁজুন (F2)...'
              : 'Search Medicine, Generic, Barcode (F2)...'}
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Register Metrics, Quick Action Tools & Profile */}
      <div className="flex items-center gap-2.5">
        {/* Live Drawer Cash */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-xs">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            {language === 'BN' ? 'ক্যাশ ড্রয়ার:' : 'Drawer Cash:'}
          </span>
          <span className="font-mono font-black text-emerald-800 dark:text-emerald-300 text-xs">
            ৳3,420.50
          </span>
        </div>

        {/* Smart Barcode Scanner Shortcut */}
        {onOpenBarcodeScanner && (
          <button
            onClick={onOpenBarcodeScanner}
            title="Smart Barcode Scanner (F3)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition cursor-pointer"
          >
            <Scan className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Scanner</span>
            <kbd className="font-mono text-[9px] font-bold px-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500">
              F3
            </kbd>
          </button>
        )}

        {/* AI Anomalies Pill */}
        {onOpenInventoryAnomalies && (
          <button
            onClick={onOpenInventoryAnomalies}
            title="AI Inventory Alerts"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Alerts</span>
            <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
              {anomalyCount}
            </span>
          </button>
        )}

        {/* Hotkeys Modal / Help */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px]">Hotkeys</span>
          </button>
        )}

        {/* System Live Clock */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-[11px] font-semibold">{currentTime}</span>
        </div>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => onToggleDarkMode(!isDarkMode)}
          aria-label="Toggle Theme"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Language Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 text-xs font-bold">
          <button
            onClick={() => onToggleLanguage('EN')}
            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
              language === 'EN'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => onToggleLanguage('BN')}
            className={`px-2 py-1 rounded-lg transition cursor-pointer ${
              language === 'BN'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            বাং
          </button>
        </div>

        {/* Pharmacist / Active User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {userInitials}
          </div>
          <div className="flex flex-col text-left leading-tight hidden md:flex min-w-0 max-w-[140px]">
            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
              {currentUser?.name || 'Administrator'}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {currentUser?.roleName || 'System Admin'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
