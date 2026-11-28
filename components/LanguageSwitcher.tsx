'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useLanguage, type AppLanguage } from '@/lib/i18n';

function FlagIcon({ code }: { code: AppLanguage }) {
  if (code === 'id') {
    return (
      <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px] border border-black/10">
        <rect width="24" height="8" fill="#CE1126" />
        <rect y="8" width="24" height="8" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 16" className="h-3.5 w-5 shrink-0 rounded-[2px] border border-black/10">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M0 0L24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.5" />
      <path d="M12 0V16M0 8H24" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M12 0V16M0 8H24" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

const OPTIONS: Array<{ code: AppLanguage; label: string; short: string }> = [
  { code: 'en', label: 'English (Global)', short: 'English' },
  { code: 'id', label: 'Bahasa Indonesia', short: 'Indonesia' },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const current = OPTIONS.find((o) => o.code === lang) || OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] font-medium text-[#0F172A] transition-colors hover:bg-[#F4F7FB] cursor-pointer"
      >
        <FlagIcon code={current.code} />
        <span className="hidden sm:inline">{current.short}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#5B6B82] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-dropdown-in absolute right-0 top-[calc(100%+6px)] z-50 w-[195px] overflow-hidden rounded-xl border border-[#DCE4F0] bg-white p-1.5 shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
          {OPTIONS.map((opt) => {
            const active = opt.code === lang;
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  setLang(opt.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EAF1FE] font-semibold text-[#1E2A5A]'
                    : 'text-[#0F172A] hover:bg-[#F4F7FB]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FlagIcon code={opt.code} />
                  <span>{opt.label}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-[#1E2A5A]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}