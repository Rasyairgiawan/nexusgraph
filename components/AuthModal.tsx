'use client';

import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { forgotPasswordApi, signInApi, signUpApi } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import type {
  AiConversationRecord,
  ProjectRecord,
  UserProfile,
} from '@/types';

export type AuthModalMode = 'signin' | 'signup';

interface AuthModalProps {
  mode: AuthModalMode;
  required?: boolean;
  onModeChange: (mode: AuthModalMode) => void;
  onClose: () => void;
  onAuthenticated: (payload: {
    user: UserProfile;
    projects: ProjectRecord[];
    conversations: AiConversationRecord[];
  }) => void;
}

function getPasswordStrength(password: string): {
  label: string;
  bars: number;
  colorClass: string;
} {
  if (!password) {
    return { label: '', bars: 0, colorClass: 'bg-[#DCE4F0]' };
  }
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { label: 'Weak', bars: 1, colorClass: 'bg-[#DC2626]' };
  }
  if (score === 2) {
    return { label: 'Moderate', bars: 2, colorClass: 'bg-[#EA7A1A]' };
  }
  return { label: 'Strong', bars: 3, colorClass: 'bg-[#16A34A]' };
}

export function AuthModal({
  mode,
  required = false,
  onModeChange,
  onClose,
  onAuthenticated,
}: AuthModalProps) {
  const { t, translateStatus } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [major, setMajor] = useState('');
  const [nim, setNim] = useState('');
  const [researchInterests, setResearchInterests] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [forgotView, setForgotView] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const switchMode = (nextMode: AuthModalMode) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setForgotView(false);
    onModeChange(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (forgotView) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMsg(t('validEmailError'));
        return;
      }
      setIsSubmitting(true);
      try {
        const msg = await forgotPasswordApi(email.trim());
        setInfoMsg(msg);
      } catch (err) {
        setErrorMsg((err as Error).message || 'Could not send reset link.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'signin') {
      setIsSubmitting(true);
      try {
        const result = await signInApi({
          email: email.trim(),
          password,
        });
        onAuthenticated(result);
        onClose();
      } catch (err) {
        setErrorMsg((err as Error).message || 'Sign In failed.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Sign Up (Unified User Model — no Role)
    if (fullName.trim().length < 2) {
      setErrorMsg(t('fullNameMinError'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMsg(t('validAcademicEmailError'));
      return;
    }
    if (password.length < 8) {
      setErrorMsg(t('passwordMinError'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('passwordConfirmMismatchError'));
      return;
    }
    if (!institution.trim() || !major.trim() || !researchInterests.trim()) {
      setErrorMsg(t('academicFieldsRequiredError'));
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg(t('acceptTermsError'));
      return;
    }

    setIsSubmitting(true);
    try {
      const { user } = await signUpApi({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        institution: institution.trim(),
        major: major.trim(),
        nim: nim.trim(),
        researchInterests: researchInterests.trim(),
        acceptedTerms,
      });
      onAuthenticated({ user, projects: [], conversations: [] });
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Sign Up failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={forgotView
        ? t('forgotPasswordLabel')
        : mode === 'signin'
          ? t('signInTitle')
          : t('signUpForNexusGraph')}
      onClick={(e) => {
        if (!required && e.target === e.currentTarget && !isSubmitting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]"
    >
      <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-[#DCE4F0] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#DCE4F0] px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">
              {forgotView
                ? t('resetPassword')
                : mode === 'signin'
                  ? t('signInTitle')
                  : t('createAccountTitle')}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#5B6B82]">
              {forgotView
                ? t('resetPasswordDescription')
                : mode === 'signin'
                  ? t('signInDescription')
                  : t('createAccountDescription')}
            </p>
          </div>
          {!required && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('closeAuthDialog')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DCE4F0] text-[#5B6B82] hover:bg-[#F4F7FB] hover:text-[#0F172A] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {!forgotView && mode === 'signup' && (
            <div>
              <label className="block text-[12px] font-medium text-[#0F172A]">
                {t('fullName')}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('nameExamplePlaceholder')}
                required
                className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-[#0F172A]">
            {t('emailLabel')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailExamplePlaceholder')}
              required
              className="mt-1 h-9 w-full rounded-lg border border-[#DCE4F0] px-3 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
            />
          </div>

          {!forgotView && (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-[12px] font-medium text-[#0F172A]">
                    {t('password')}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setForgotView(true);
                      }}
                      className="text-[11.5px] font-medium text-[#1E2A5A] hover:underline cursor-pointer"
                    >
                      {t('forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    required
                    className="h-9 w-full rounded-lg border border-[#DCE4F0] pl-3 pr-9 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A97AB] hover:text-[#0F172A] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {mode === 'signup' && password && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3].map((step) => (
                        <span
                          key={step}
                          className={`h-1 flex-1 rounded-full ${
                            step <= strength.bars ? strength.colorClass : 'bg-[#EEF2F7]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-[#5B6B82]">
                      {translateStatus(strength.label)}
                    </span>
                  </div>
                )}
              </div>

              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-[12px] font-medium text-[#0F172A]">
                      {t('confirmPassword')}
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('reenterPassword')}
                        required
                        className="h-9 w-full rounded-lg border border-[#DCE4F0] pl-3 pr-9 text-[12.5px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((prev) => !prev)}
                        aria-label={showConfirm ? t('hideConfirmation') : t('showConfirmation')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A97AB] hover:text-[#0F172A] cursor-pointer"
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Academic Background Fields */}
                  <div className="rounded-xl border border-[#DCE4F0] bg-[#F8FAFC] p-3.5 space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#5B6B82]">
                      {t('academicBackground')}
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11.5px] font-medium text-[#0F172A]">
                          {t('institution')}
                        </label>
                        <input
                          type="text"
                          value={institution}
                          onChange={(e) => setInstitution(e.target.value)}
                          placeholder={t('institutionExamplePlaceholder')}
                          required
                          className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-[#0F172A]">
                          {t('majorProgram')}
                        </label>
                        <input
                          type="text"
                          value={major}
                          onChange={(e) => setMajor(e.target.value)}
                          placeholder={t('majorExamplePlaceholder')}
                          required
                          className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11.5px] font-medium text-[#0F172A]">
                          {t('studentId')}
                        </label>
                        <input
                          type="text"
                          value={nim}
                          onChange={(e) => setNim(e.target.value)}
                          placeholder={t('studentIdExamplePlaceholder')}
                          className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11.5px] font-medium text-[#0F172A]">
                          {t('researchInterests')}
                        </label>
                        <input
                          type="text"
                          value={researchInterests}
                          onChange={(e) => setResearchInterests(e.target.value)}
                          placeholder={t('interestsExamplePlaceholder')}
                          required
                          className="mt-1 h-8 w-full rounded-lg border border-[#DCE4F0] bg-white px-2.5 text-[12px] text-[#0F172A] focus:border-[#1E2A5A] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-2 text-[11.5px] text-[#5B6B82] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-[#DCE4F0] accent-[#1E2A5A] cursor-pointer"
                    />
                    <span>
                      {t('agreeTerms')}
                    </span>
                  </label>
                </>
              )}
            </>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-lg border border-[#BCE6CA] bg-[#E6F6EC] px-3 py-2 text-[12px] text-[#15803D]">
              {infoMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1E2A5A] text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {forgotView
                ? t('sendResetLink')
                : mode === 'signin'
                  ? t('signIn')
                  : t('signUp')}
            </span>
          </button>

          <div className="pt-1 text-center text-[12px] text-[#5B6B82]">
            {forgotView ? (
              <button
                type="button"
                onClick={() => setForgotView(false)}
                className="font-semibold text-[#1E2A5A] hover:underline cursor-pointer"
              >
                {t('backToSignIn')}
              </button>
            ) : mode === 'signin' ? (
              <>
                {t('dontHaveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-[#1E2A5A] hover:underline cursor-pointer"
                >
                  {t('signUp')}
                </button>
              </>
            ) : (
              <>
                {t('alreadyHaveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-semibold text-[#1E2A5A] hover:underline cursor-pointer"
                >
                  {t('signIn')}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
