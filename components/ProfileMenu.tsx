'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderKanban,
  Lightbulb,
  LogOut,
  MessageSquare,
  UserCircle2,
} from 'lucide-react';
import type { ProfileStats, UserProfile } from '@/types';
import type { AuthModalMode } from './AuthModal';

export type ProfileMenuAction =
  | 'open_profile'
  | 'open_projects'
  | 'open_history'
  | 'open_claimed_gaps';

interface ProfileMenuProps {
  user: UserProfile | null;
  stats: ProfileStats;
  onOpenAuth: (mode: AuthModalMode) => void;
  onSelectAction: (action: ProfileMenuAction) => void;
  onLogout: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ProfileMenu({
  user,
  stats,
  onOpenAuth,
  onSelectAction,
  onLogout,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => onOpenAuth('signin')}
        className="inline-flex h-8 items-center rounded-lg bg-[#1E2A5A] px-3.5 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] cursor-pointer"
      >
        Sign In
      </button>
    );
  }

  const initials = getInitials(user.fullName);

  const handleAction = (action: ProfileMenuAction) => {
    setIsOpen(false);
    onSelectAction(action);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open researcher profile menu"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#DCE4F0] bg-[#F8FAFC] pl-1 pr-2 text-[12px] font-medium text-[#0F172A] transition-colors hover:border-[#1E2A5A] hover:bg-[#EAF1FE] cursor-pointer"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E2A5A] text-[10.5px] font-bold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[110px] truncate sm:inline">
          {user.fullName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-[#5B6B82]" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="animate-dropdown-in absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-[12px] border border-[#DCE4F0] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.12)]"
        >
          {/* Identity Header (Unified User Model — no Role badge) */}
          <div className="border-b border-[#DCE4F0] p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E2A5A] text-[13px] font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-[#0F172A]">
                  {user.fullName}
                </div>
                <div className="truncate text-[11.5px] text-[#5B6B82]">
                  {user.email}
                </div>
                {user.institution && (
                  <div className="mt-0.5 truncate text-[10.5px] font-medium text-[#1E2A5A]">
                    {user.institution}
                    {user.major ? ` · ${user.major}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Counts */}
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-[#F4F7FB] p-2 text-center">
              <div>
                <div className="text-[13px] font-bold text-[#0F172A] tabular-nums">
                  {stats.savedThesesCount}
                </div>
                <div className="text-[10px] text-[#5B6B82]">Saved</div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#0F172A] tabular-nums">
                  {stats.projectsCount}
                </div>
                <div className="text-[10px] text-[#5B6B82]">Projects</div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#B45309] tabular-nums">
                  {stats.claimedGapsCount}
                </div>
                <div className="text-[10px] text-[#5B6B82]">Claimed</div>
              </div>
            </div>
          </div>

          {/* Navigation Items (No Settings) */}
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction('open_profile')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[#0F172A] hover:bg-[#EAF1FE] hover:text-[#1E2A5A] cursor-pointer"
            >
              <UserCircle2 className="h-4 w-4 text-[#1E2A5A]" />
              <span>Researcher Profile</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction('open_claimed_gaps')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[#0F172A] hover:bg-[#EAF1FE] hover:text-[#1E2A5A] cursor-pointer"
            >
              <Lightbulb className="h-4 w-4 text-[#B45309]" />
              <span>My Claimed Research Gaps</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction('open_projects')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[#0F172A] hover:bg-[#EAF1FE] hover:text-[#1E2A5A] cursor-pointer"
            >
              <FolderKanban className="h-4 w-4 text-[#5B6B82]" />
              <span>My Projects</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleAction('open_history')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[#0F172A] hover:bg-[#EAF1FE] hover:text-[#1E2A5A] cursor-pointer"
            >
              <MessageSquare className="h-4 w-4 text-[#5B6B82]" />
              <span>Chat History</span>
            </button>
          </div>

          <div className="border-t border-[#DCE4F0] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
