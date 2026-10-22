import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { getCurrentLocale, setLocale } from '../../utils/i18nFormatter';

export const LanguageSwitcher: React.FC<{ variant?: 'header' | 'compact' | 'pill' }> = ({ variant = 'header' }) => {
  const { i18n } = useTranslation();
  const currentLang = getCurrentLocale();

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'bn' : 'en';
    setLocale(nextLang);
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none ${
        currentLang === 'bn'
          ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 shadow-xs'
          : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700/80'
      }`}
      title={currentLang === 'en' ? 'Switch language to বাংলা' : 'Switch language to English'}
    >
      <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span className="font-sans">
        {currentLang === 'en' ? 'EN | বাংলা' : 'বাংলা | EN'}
      </span>
      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono uppercase">
        {currentLang}
      </span>
    </button>
  );
};
