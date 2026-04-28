'use client';
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "../../components/Logo";
import { AnimatedInput } from "../../components/AnimatedInput";
import { AnimatedButton } from "../../components/AnimatedButton";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { logAuditEvent } from "@/utils/telemetry";
import { useI18n } from "@/lib/i18n";
const REMEMBER_ME_STORAGE_KEY = "mofid_remember_me";

export default function Login() {
  const { t, isRtl } = useI18n();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    try {
      setRememberMe(window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) !== "false");
    } catch {
      setRememberMe(true);
    }
  }, []);

  const persistRememberPreference = (enabled: boolean) => {
    try {
      window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // no-op
    }
  };

  const handleGoogleLogin = async () => {
    try {
      persistRememberPreference(rememberMe);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) {
        setError(error.message);
      } else {
        void logAuditEvent({
          action: "oauth_login_started",
          entityType: "auth",
          metadata: { provider: "google" },
        });
      }
    } catch {
      setError(t("authError.description"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      persistRememberPreference(rememberMe);

      // Sign in user
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        await logAuditEvent({
          actorId: authData.user.id,
          action: "user_signed_in",
          entityType: "auth",
          metadata: { method: "password" },
        });
        // Get user profile to determine account type
        // Try governance columns first, fallback to basic if they don't exist
        let profile: {
          account_type?: string | null;
          doctor_verification_status?: string | null;
          is_doctor_verified?: boolean | null;
          moderation_status?: string | null;
        } | null = null;

        const { data: fullProfile, error: fullProfileError } = await supabase
          .from('profiles')
          .select('account_type, doctor_verification_status, is_doctor_verified, moderation_status')
          .eq('id', authData.user.id)
          .single();

        if (!fullProfileError && fullProfile) {
          profile = fullProfile;
        } else {
          // Governance columns may not exist yet — fallback to basic select
          const { data: basicProfile, error: basicError } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('id', authData.user.id)
            .single();

          if (basicError || !basicProfile) {
            setError(t("login.profileLoadError"));
            setLoading(false);
            return;
          }

          profile = {
            ...basicProfile,
            doctor_verification_status: null,
            is_doctor_verified: null,
            moderation_status: null,
          };
        }

        setSuccess(true);

        // Redirect based on account type
        if (profile?.account_type === 'doctor') {
          router.replace('/dashboardoctlarabi');
        } else {
          router.replace('/dashboardpatientlarabi');
        }
      }
    } catch {
      setError(t("authError.description"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-[#020617] dark:to-[#0f172a] flex items-center justify-center p-3 py-4 sm:p-6 lg:p-8 transition-colors duration-200">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="mb-6 flex items-center justify-center sm:mb-8">
          <Logo size="lg" />
        </Link>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-8 transition-colors duration-200">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{t("login.title")}</h1>
            <p
              dir={isRtl ? "rtl" : "ltr"}
              className="text-slate-600 dark:text-slate-400"
            >
              {t("login.subtitlePrefix")}{" "}
              <bdi dir="ltr" className="font-semibold tracking-[0.08em]">
                TIRYAQ
              </bdi>
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="error-message"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900/70 rounded-xl flex items-start gap-3 text-sm"
              >
                <AlertCircle className="size-5 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div
                key="success-message"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/70 rounded-xl flex items-start gap-3 text-sm"
              >
                <CheckCircle2 className="size-5 shrink-0" />
                <p>{t("login.success")}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {/* Email */}
            <AnimatedInput
              id="email"
              type="email"
              placeholder={t("login.emailPlaceholder")}
              label={t("common.email")}
              icon={Mail}
              iconDelay={0}
              fieldDelay={0.1}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {/* Password */}
            <AnimatedInput
              id="password"
              type="password"
              placeholder={t("login.passwordPlaceholder")}
              label={t("common.password")}
              icon={Lock}
              iconDelay={0.5}
              fieldDelay={0.2}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* Remember Me */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="size-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-slate-600 dark:text-slate-300">
                  {t("common.rememberMe")}
                </label>
              </div>
              <AnimatedButton variant="link" type="button" className="self-start sm:self-auto">
                {t("common.forgotPassword")}
              </AnimatedButton>
            </div>

            {/* Submit Button */}
            <AnimatedButton disabled={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </AnimatedButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6 sm:my-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-700 to-transparent" />
            <span className="text-sm font-medium text-gray-500 dark:text-slate-400 px-2 bg-white dark:bg-slate-900 transition-colors">{t("login.googleDivider")}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-700 to-transparent" />
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-1 gap-3">
            {/* made by mohamed - removed facebook logic and kept google */}
            <AnimatedButton variant="social" type="button" onClick={handleGoogleLogin}>
              <svg className="size-5 flex-shrink-0 align-middle" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t("common.google")}
            </AnimatedButton>
            {/* made by mohamed */}
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-6">
            {t("login.noAccount")}{" "}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold transition-colors">
              {t("login.signUpLink")}
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p
          dir={isRtl ? "rtl" : "ltr"}
          className="mt-6 px-2 text-center text-sm font-medium text-slate-600 dark:text-slate-500"
        >
          {t("login.footerPrefix")}{" "}
          <bdi dir="ltr" className="font-semibold tracking-[0.08em]">
            TIRYAQ
          </bdi>
        </p>
      </div>
    </div>
  );
}
