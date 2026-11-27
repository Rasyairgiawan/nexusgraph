'use client';

import React from 'react';
import { FolderKanban, X } from 'lucide-react';
import type { FilterState } from '@/types';

interface FilterBarProps {
  filters: FilterState;
  availableYears: number[];
  onFilterChange: (next: FilterState) => void;
  onResetFilters: () => void;
  activeProjectName?: string | null;
  onExitProjectScope?: () => void;
  highlight?: boolean;
}

export function FilterBar({
  filters,
  availableYears,
  onFilterChange,
  onResetFilters,
  activeProjectName,
  onExitProjectScope,
  highlight = false,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.year !== 'all' || filters.verifiedOnly || filters.availableGapsOnly;

  return (
    <div
      className={`flex min-h-[40px] flex-wrap items-center justify-between gap-3 border-b px-4 py-1.5 text-[12px] transition-colors lg:px-6 ${
        highlight
          ? 'border-[#1E2A5A] bg-[#EAF1FE]'
          : 'border-[#DCE4F0]/60 bg-transparent'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[11px] font-semibold tracking-wider text-[#5B6B82] uppercase">
          FILTER:
        </span>

        {/* Year Dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-year" className="text-[#5B6B82]">
            Year
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
            className="h-7 rounded-md border border-[#DCE4F0] bg-white px-2 text-[12px] font-medium text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none cursor-pointer"
          >
            <option value="all">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={String(yr)}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        {/* Verified only */}
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
          <span>Verified only</span>
        </label>

        {/* Available gaps */}
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
          <span>Available gaps</span>
        </label>

        {activeProjectName && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFDBFE] bg-[#EAF1FE] px-2.5 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
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

      {/* Clear filters */}
      <button
        type="button"
        onClick={onResetFilters}
        className={`font-medium transition-colors cursor-pointer ${
          hasActiveFilters || activeProjectName
            ? 'text-[#1E2A5A] hover:text-[#1D4ED8] hover:underline'
            : 'text-[#8A97AB] hover:text-[#5B6B82]'
        }`}
      >
        Clear filters
      </button>
    </div>
  );
}
