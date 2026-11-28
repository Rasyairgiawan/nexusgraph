'use client';

import React from 'react';
import Image from 'next/image';
import {
  FolderKanban,
  GitFork,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import type { AppMode, FilterState, ProfileStats, UserProfile } from '@/types';
import { useLanguage } from '@/lib/i18n';
import type { AuthModalMode } from './AuthModal';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ProfileMenu, type ProfileMenuAction } from './ProfileMenu';

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  queryInput: string;
  onQueryInputChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onRefresh: () => void;
  shownCount: number;
  totalCount: number;
  isLoading: boolean;
  user: UserProfile | null;
  profileStats: ProfileStats;
  onOpenAuth: (mode: AuthModalMode) => void;
  onOpenAddThesis: () => void;
  onProfileAction: (action: ProfileMenuAction) => void;
  onSignOutClick: () => void;
  filters: FilterState;
  availableYears: number[];
  onFilterChange: (next: FilterState) => void;
  onResetFilters: () => void;
  activeProjectName?: string | null;
  onExitProjectScope?: () => void;
}

const MODE_OPTIONS: Array<{
  id: AppMode;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'graph', Icon: GitFork },
  { id: 'table', Icon: Table2 },
  { id: 'ai', Icon: Sparkles },
];

export function Header({
  mode,
  onModeChange,
  queryInput,
  onQueryInputChange,
  onSearchSubmit,
  onRefresh,
  shownCount,
  totalCount,
  isLoading,
  user,
  profileStats,
  onOpenAuth,
  onOpenAddThesis,
  onProfileAction,
  onSignOutClick,
  filters,
  availableYears,
  onFilterChange,
  onResetFilters,
  activeProjectName,
  onExitProjectScope,
}: HeaderProps) {
  const { t } = useLanguage();
  const hasActiveFilters =
    filters.year !== 'all' || filters.verifiedOnly || filters.availableGapsOnly;
  return (
    <header className="border-b border-[#DCE4F0] bg-white px-4 pt-2.5 pb-2 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Logo + Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/nexusgraph-logo-v2.jpg"
            alt="NexusGraph Logo"
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded-lg object-cover shadow-xs"
            priority
          />
          <div className="leading-tight">
            <h1 className="text-[15px] font-bold tracking-tight text-[#0F172A]">
              NexusGraph
            </h1>
            <p className="text-[11px] text-[#5B6B82]">
              {t('subtitle')}
            </p>
          </div>
        </div>

        {/* Center: Semantic Natural-Language Search + Refresh */}
        <form
          onSubmit={onSearchSubmit}
          className="flex flex-1 max-w-[500px] min-w-[240px] items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A97AB]" />
            <input
              id="header-search-input"
              type="text"
              value={queryInput}
              onChange={(e) => onQueryInputChange(e.target.value)}
              aria-label={t('searchPlaceholder')}
              placeholder={t('searchPlaceholder')}
              className="h-9 w-full rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] pl-9 pr-3 text-[13px] text-[#0F172A] placeholder:text-[#8A97AB] focus:border-[#1E2A5A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E2A5A]/15"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="h-9 rounded-lg border border-[#DCE4F0] bg-[#F4F7FB] px-4 text-[13px] font-medium text-[#0F172A] transition-colors hover:bg-[#EAF1FE] active:border-[#1E2A5A] active:bg-[#1E2A5A] active:text-white focus:border-[#1E2A5A] focus:bg-[#1E2A5A] focus:text-white focus:outline-none disabled:opacity-60 cursor-pointer shrink-0"
          >
            {isLoading ? t('searchingBtn') : t('searchBtn')}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Reload all theses from Supabase"
            aria-label="Reload all theses"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE4F0] bg-white text-[#5B6B82] transition-colors hover:bg-[#F4F7FB] hover:text-[#0F172A] disabled:opacity-60 cursor-pointer shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </form>

        {/* Right: Dynamic counter + Add Thesis + Auth / Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden text-[12px] text-[#5B6B82] md:inline">
            {t('showing')} <strong className="font-semibold text-[#0F172A]">{shownCount}</strong>{' '}
            {t('of')}{' '}
            <strong className="font-semibold text-[#0F172A]">{totalCount}</strong> {t('theses')}
          </span>

          <button
            type="button"
            onClick={onOpenAddThesis}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E2A5A] px-3 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-[#172148] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('addThesis')}</span>
          </button>

          <LanguageSwitcher />
          <ProfileMenu
            user={user}
            stats={profileStats}
            onOpenAuth={onOpenAuth}
            onSelectAction={onProfileAction}
            onLogout={onSignOutClick}
          />
        </div>
      </div>

      {/* Mode Switcher + Inline Filter Row */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5">
        {/* Left: Filter Pill */}
        <div className="inline-flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] px-3 py-1 text-[12px]">
          <span className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
            {t('filter')}
          </span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="filter-year" className="text-[#5B6B82]">
              {t('year')}
            </label>
            <select
              id="filter-year"
              value={filters.year === 'all' ? 'all' : String(filters.year)}
              onChange={(e) => {
                const value = e.target.value;
                onFilterChange({
                  ...filters,
                  year: value === 'all' ? 'all' : Number(value),
                });
              }}
              className="h-6 rounded-md border border-[#DCE4F0] bg-white px-2 text-[11.5px] font-medium text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none cursor-pointer"
            >
              <option value="all">{t('allYears')}</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-1.5 text-[#0F172A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  verifiedOnly: e.target.checked,
                })
              }
              className="h-3.5 w-3.5 rounded border-[#DCE4F0] accent-[#1E2A5A] cursor-pointer"
            />
            <span>{t('verifiedOnly')}</span>
          </label>

          <label className="inline-flex items-center gap-1.5 text-[#0F172A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.availableGapsOnly}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  availableGapsOnly: e.target.checked,
                })
              }
              className="h-3.5 w-3.5 rounded border-[#DCE4F0] accent-[#1E2A5A] cursor-pointer"
            />
            <span>{t('availableGaps')}</span>
          </label>

          {activeProjectName && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EAF1FE] px-2 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
              <FolderKanban className="h-3 w-3" />
              <span>Project: {activeProjectName}</span>
              {onExitProjectScope && (
                <button
                  type="button"
                  onClick={onExitProjectScope}
                  aria-label="Exit project scope"
                  className="rounded-full p-0.5 hover:bg-[#DBEAFE] cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          )}
        </div>

        {/* Center: Mode Switcher Pill */}
        <div
          role="tablist"
          aria-label="Workspace View Mode"
          className="inline-flex items-center gap-1 rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-1"
        >
          {MODE_OPTIONS.map(({ id, Icon }) => {
            const isActive = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onModeChange(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1 text-[12px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#1E2A5A] shadow-[0_1px_3px_rgba(15,23,42,0.08)]'
                    : 'text-[#5B6B82] hover:text-[#0F172A]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(id)}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Clear Filters Pill */}
        <div className="inline-flex items-center rounded-xl border border-[#DCE4F0] bg-[#F4F7FB] p-1">
          <button
            type="button"
            onClick={onResetFilters}
            className={`rounded-lg px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
              hasActiveFilters || activeProjectName
                ? 'bg-white text-[#1E2A5A] shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:text-[#1D4ED8]'
                : 'text-[#8A97AB] hover:text-[#5B6B82]'
            }`}
          >
            {t('clearFilters')}
          </button>
        </div>
      </div>
    </header>
  );
}
