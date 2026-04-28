// made by larabi
'use client';
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "../../components/Logo";
import { AnimatedInput } from "../../components/AnimatedInput";
import Stepper, { Step } from "../../components/Stepper";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Stethoscope, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { createClient, getStableAuthUser } from "@/utils/supabase/client";
import { findExistingAccountByEmail } from "@/utils/supabase/auth";
import { useI18n } from "@/lib/i18n";
import { getBrowserLocation, searchAddressLocation } from "@/utils/location";

function SignupForm() {
  const { t, isRtl, language } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const roleFromQuery = searchParams.get("role");
  const [accountType, setAccountType] = useState<"patient" | "doctor">(
    roleFromQuery === "doctor" ? "doctor" : "patient"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [license, setLicense] = useState("");
  const [gender, setGender] = useState<"Homme" | "Femme" | "">("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");

  // New location states
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [searchAddressLoading, setSearchAddressLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const checkEmailEligibility = async (candidateEmail: string) => {
    const normalizedEmail = candidateEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    const response = await fetch(`/api/account-eligibility?email=${encodeURIComponent(normalizedEmail)}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { blocked?: boolean; block?: { reason?: string | null } | null; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Impossible de vérifier cet email pour le moment.");
    }

    if (payload?.blocked) {
      throw new Error(
        payload.block?.reason
          ? `Cet email est bloqué par l'administration TERIAQ. Motif: ${payload.block.reason}`
          : "Cet email est bloqué par l'administration TERIAQ et ne peut pas créer de compte."
      );
    }
  };

  const getRoleConflictMessage = (
    existingRole: "patient" | "doctor",
    requestedRole: "patient" | "doctor"
  ) => {
    const existingLabel = existingRole === "doctor" ? t("common.doctor") : t("common.patient");
    const requestedLabel = requestedRole === "doctor" ? t("common.doctor") : t("common.patient");
    if (existingRole === requestedRole) {
      return existingRole === "doctor"
        ? t("signup.roleConflict.same.doctor")
        : t("signup.roleConflict.same.patient");
    }
    return t("signup.roleConflict.cross", { existing: existingLabel, requested: requestedLabel });
  };


  const validateCurrentStep = (step: number) => {
     if (step === 1) {
       if (!accountType || !gender) {
         setError(t("signup.validation.roleGender"));
         return false;
       }
     }
     if (step === 2) {
        if (!password || password.length < 8) {
           setError(t("signup.validation.passwordLength"));
           return false;
        }
        if (password !== confirmPassword) {
           setError(t("signup.validation.passwordMismatch"));
           return false;
        }
     }
     if (step === 3) {
        if (!latitude || !longitude) {
           setError(t("signup.validation.location"));
           return false;
        }
     }
     if (step === 4) {
        if (accountType === 'doctor' && (!specialty || !license)) {
            setError(t("signup.validation.doctorFields"));
            return false;
        }
     }
     setError(null);
     return true;
  };

  // Detect if user is arriving from Google OAuth with ?step=complete
  const isGoogleCompletion = searchParams.get('step') === 'complete';

  useEffect(() => {
    if (roleFromQuery === "doctor" || roleFromQuery === "patient") {
      setAccountType(roleFromQuery);
    }
  }, [roleFromQuery]);

  // Automatically fetch Google User Data if we are in completion step
  useEffect(() => {
    if (isGoogleCompletion) {
      const fetchUserData = async () => {
        const { user } = await getStableAuthUser();
        if (user) {
          const userEmail = user.email || "";
          setEmail(userEmail);
          setName(user.user_metadata?.full_name || user.user_metadata?.name || "");

          try {
            await checkEmailEligibility(userEmail);
          } catch (eligibilityError) {
            await supabase.auth.signOut();
            const message =
              eligibilityError instanceof Error
                ? eligibilityError.message
                : "Cet email ne peut pas ouvrir de compte sur TERIAQ.";
            setError(message);
          }
        }
      };
      void fetchUserData();
    }
  }, [isGoogleCompletion, supabase]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?type=signup`
        }
      });
      if (error) setError(error.message);
    } catch {
      setError(t("signup.error.googleSignup"));
    }
  };

  const handleLocationSearch = async () => {
    if (!address) return alert(t("signup.locationPlaceholder"));
    setSearchAddressLoading(true);
    try {
      const resolvedLocation = await searchAddressLocation(address, language);
      setLatitude(resolvedLocation.latitude);
      setLongitude(resolvedLocation.longitude);
      setAddress(resolvedLocation.address || resolvedLocation.rawAddress || address);
      alert(t("signup.gpsValidated"));
    } catch {
      alert(t("signup.error.addressNotFound"));
    }
    setSearchAddressLoading(false);
  };

  const handleAutoGPS = async () => {
    if (!navigator.geolocation) {
      alert(t("signup.error.gpsUnsupported"));
      return;
    }

    try {
      const resolvedLocation = await getBrowserLocation(language);
      setLatitude(resolvedLocation.latitude);
      setLongitude(resolvedLocation.longitude);
      setAddress(resolvedLocation.address || resolvedLocation.rawAddress || t("signup.gpsValidated"));
      alert(t("signup.gpsValidated"));
    } catch {
      alert(t("signup.error.gpsPermission"));
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("signup.validation.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("signup.validation.passwordLength"));
      return;
    }
    if (!latitude || !longitude) {
      setError(t("signup.validation.locationRequired"));
      return;
    }
    
    setLoading(true);
    
    try {
      let userId = "";
      const normalizedEmail = email.trim().toLowerCase();
      await checkEmailEligibility(normalizedEmail);
      const existingAccount = normalizedEmail ? await findExistingAccountByEmail(normalizedEmail) : null;

      if (existingAccount?.account_type) {
        throw new Error(getRoleConflictMessage(existingAccount.account_type, accountType));
      }

      if (isGoogleCompletion) {
         // User already created via Google OAuth, we just update metadata & profiles table
         const { user, error: userErr } = await getStableAuthUser();
         if (userErr || !user) throw new Error(t("signup.error.googleSession"));
         
         // Verification: Prevent overwriting an existing account_type role
         const { data: existingProf } = await supabase.from('profiles').select('account_type').eq('id', user.id).single();
         if (existingProf?.account_type && existingProf.account_type !== accountType) {
            throw new Error(getRoleConflictMessage(existingProf.account_type, accountType));
         }

         const { error: metaError } = await supabase.auth.updateUser({
            password: password,
            data: {
              full_name: name,
              account_type: accountType,
              specialty: accountType === 'doctor' ? specialty : null,
              license_number: accountType === 'doctor' ? license : null,
            }
         });
         if (metaError) throw new Error(metaError.message);
         userId = user.id;

      } else {
         // Normal Email/Password Signup creation
         const { data: authData, error: authError } = await supabase.auth.signUp({
           email: normalizedEmail,
           password,
           options: {
             data: {
               full_name: name,
               account_type: accountType,
               specialty: accountType === 'doctor' ? specialty : null,
               license_number: accountType === 'doctor' ? license : null,
             }
           }
         });
         if (authError) throw new Error(authError.message);
         if (!authData.user) throw new Error("Erreur inconnue lors de l'inscription");
         userId = authData.user.id;
      }

      if (!gender) {
        throw new Error("Veuillez sélectionner votre sexe (Homme/Femme).");
      }

      // Update the public database 'profiles' pour TOUS les flux
      // On utilise .update() et non .upsert() pour respecter vos règles RLS (Row Level Security) car le Triger a déjà inséré la ligne!
      const { error: profileError } = await supabase.from('profiles').update({
         full_name: name,
         gender: gender,
         account_type: accountType,
         specialty: accountType === 'doctor' ? specialty : null,
         license_number: accountType === 'doctor' ? license : null,
         address: address,
         latitude: latitude,
         longitude: longitude,
         google_maps_link: accountType === 'doctor' ? googleMapsLink : null,
         doctor_verification_status: accountType === 'doctor' ? 'pending' : null,
         is_doctor_verified: accountType === 'doctor' ? false : null,
         doctor_verification_note: null,
         doctor_verification_requested_at: null,
         doctor_verification_decided_at: null,
         doctor_verification_admin_label: null
      }).eq('id', userId);

      if (profileError) {
         throw new Error(t("signup.error.profileConfig", { message: profileError.message }));
      }

      setSuccess(true);
      setTimeout(() => {
        if (accountType === 'doctor') {
          router.push('/doctor-verification');
        } else {
          router.push('/dashboardpatientlarabi');
        }
      }, 1500);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(message || t("signup.error.profileSave"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 dark:from-[#020617] dark:to-[#0f172a] flex items-start justify-center p-3 py-4 transition-colors duration-200 sm:items-center sm:p-6">
      <div className="my-4 w-full max-w-md sm:my-8">
        {/* Logo */}
        <Link href="/" className="mb-6 flex items-center justify-center sm:mb-8">
          <Logo size="xl" />
        </Link>

        {/* Signup Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 p-4 sm:p-8 transition-colors duration-200">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{isGoogleCompletion ? t("signup.completeProfile") : t("signup.title")}</h1>
            <p
              dir={isRtl ? "rtl" : "ltr"}
              className="text-gray-500 dark:text-slate-400"
            >
              {t("signup.subtitlePrefix")}{" "}
              <bdi dir="ltr" className="font-semibold tracking-[0.08em]">
                TIRYAQ
              </bdi>
            </p>
          </div>

          {isGoogleCompletion && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/70 text-blue-800 dark:text-blue-300 rounded-2xl text-sm flex items-start gap-3">
              <span className="text-2xl">👋</span>
              <p>{t("signup.googleSuccess")}</p>
            </div>
          )}

          {/* Account Type Selection */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 transition-colors duration-200 dark:border-slate-800 dark:bg-slate-800/70 sm:gap-3">
            <motion.button
              type="button"
              onClick={() => setAccountType("patient")}
              className={`relative overflow-hidden rounded-xl py-3 transition-all duration-200 ${accountType === "patient"
                ? "bg-white dark:bg-slate-900 shadow text-blue-600 dark:text-blue-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
            >
              <User className="size-5 mx-auto mb-1" />
              <span className="text-sm">{t("signup.patient")}</span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setAccountType("doctor")}
              className={`relative overflow-hidden rounded-xl py-3 transition-all duration-200 ${accountType === "doctor"
                ? "bg-white dark:bg-slate-900 shadow text-emerald-600 dark:text-emerald-400 font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
            >
              <Stethoscope className="size-5 mx-auto mb-1" />
              <span className="text-sm">{t("signup.doctor")}</span>
            </motion.button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/70 rounded-xl flex items-start gap-3 text-sm font-medium"
              >
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/70 rounded-xl flex items-start gap-3 text-sm font-medium"
              >
                <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
                <p>{t("signup.success")}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4 mb-2">
              <AnimatedInput id="name" type="text" placeholder={t("signup.fullNamePlaceholder")} label={t("common.fullName")} icon={User} iconDelay={0} fieldDelay={0.1} required value={name} onChange={(e) => setName(e.target.value)} />
              <AnimatedInput id="email" type="email" placeholder={t("login.emailPlaceholder")} label={t("common.email")} icon={Mail} iconDelay={0.2} fieldDelay={0.2} required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isGoogleCompletion} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
            <Stepper
              initialStep={1}
              disableStepIndicators={true}
              validateStep={validateCurrentStep}
              onFinalStepCompleted={() => handleSubmit()}
              backButtonText={t("signup.back")}
              nextButtonText={t("signup.continue")}
            >
              <Step>
                <div className="py-4 space-y-6">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{t("signup.step1")}</h3>


            {/* Gender Selection */}
            <div className="mb-4">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 mb-1 block">{t("signup.gender")}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("Homme")}
                  className={`py-3 flex justify-center items-center gap-2 rounded-xl border transition font-bold shadow-sm ${gender === "Homme" ? "bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800"}`}
                >
                  👨 {t("signup.male")}
                </button>
                <button
                  type="button"
                  onClick={() => setGender("Femme")}
                  className={`py-3 flex justify-center items-center gap-2 rounded-xl border transition font-bold shadow-sm ${gender === "Femme" ? "bg-pink-100 dark:bg-pink-900/30 border-pink-400 text-pink-700 dark:text-pink-400" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800"}`}
                >
                  👩 {t("signup.female")}
                </button>
              </div>
            </div>

                </div>
              </Step>
              
              <Step>
                <div className="py-4 space-y-6">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{t("signup.step2")}</h3>
                  {/* Passwords */}
                  <div className="space-y-4">
              <AnimatedInput
                id="password"
                type="password"
                placeholder={t("signup.passwordCreatePlaceholder")}
                label={t("common.password")}
                icon={Lock}
                iconDelay={0.4}
                fieldDelay={0.3}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2 ml-1">{t("signup.passwordHint")}</p>

              <AnimatedInput
                id="confirm-password"
                type="password"
                placeholder={t("signup.passwordConfirmPlaceholder")}
                label={t("common.confirmPassword")}
                icon={Lock}
                iconDelay={0.6}
                fieldDelay={0.4}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

                </div>
              </Step>
              
              <Step>
                <div className="py-4 space-y-6">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{t("signup.step3")}</h3>
            {/* Doctor-specific fields */}
            

            {/* LOCATION FORM CONFIGURATION */}
            <div className={`mt-6 p-5 rounded-2xl relative overflow-hidden border ${accountType === 'doctor' ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40' : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40'}`}>
               <div className="absolute -right-4 -top-4 text-slate-200 dark:text-slate-700 transform rotate-12 pointer-events-none opacity-50">
                 <MapPin size={80} />
               </div>
               
               <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4 relative z-10">
                 <MapPin size={18} className={accountType === 'doctor' ? 'text-emerald-600' : 'text-blue-600'}/> 
                 {accountType === 'doctor' ? t("signup.locationDoctor") : t("signup.locationPatient")}
               </h3>
               
               <div className="space-y-4 relative z-10">
                 
                 {/* Ligne 1: Saisie ou affichage de l'adresse */}
                 <div className="relative">
                   <input
                     type="text"
                     placeholder={t("signup.locationPlaceholder")}
                     className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 outline-none shadow-sm"
                     value={address}
                     onChange={(e) => setAddress(e.target.value)}
                     required
                   />
                 </div>

                 {/* Ligne 2 : Boutons Recherche vs Auto */}
                 <div className="flex gap-2">
                   <button 
                     type="button"
                     className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs py-2.5 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
                     onClick={handleLocationSearch}
                     disabled={searchAddressLoading}
                   >
                     {searchAddressLoading ? t("common.searching") : `🔍 ${t("signup.searchMap")}`}
                   </button>
                   <button 
                     type="button" 
                     className={`flex-1 text-white text-xs py-2.5 rounded-xl font-bold transition shadow-sm ${accountType === 'doctor' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                     onClick={handleAutoGPS}
                   >
                     🎯 {t("signup.autoGps")}
                   </button>
                 </div>

                 {latitude && longitude && (
                   <div className="flex items-center gap-2 text-xs font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/30 px-3 py-2 rounded-lg border border-green-200 dark:border-green-900/50 shadow-sm">
                     <CheckCircle2 size={16} /> {t("signup.gpsValidated")} ({latitude.toFixed(2)}, {longitude.toFixed(2)})
                   </div>
                 )}
               </div>
            </div>
            {/* END LOCATION */}
                </div>
              </Step>

             {/* Doctor-specific fields wrapped inside Step 4 */}
             {accountType === 'doctor' && (
             <Step>
                <div className="py-4 space-y-6">
                  {/* Doctor Info */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl">👨‍⚕️ {t("signup.step4")}</h3>
                    
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">{t("signup.specialty")}</label>
                      <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition">
                        <option value="">{t("signup.specialtyPlaceholder")}</option>
                        <option value="Cardiologue">Cardiologue</option>
                        <option value="Dermatologue">Dermatologue</option>
                        <option value="Généraliste">Généraliste</option>
                        <option value="Ophtalmologue">Ophtalmologue</option>
                        <option value="Pédiatre">Pédiatre</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 mb-1 block">{t("signup.license")}</label>
                      <input type="text" placeholder="Ex: 123456" value={license} onChange={(e) => setLicense(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500" required />
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 mb-1 block">{t("signup.mapsLink")}</label>
                      <input 
                        type="url" 
                        placeholder="https://maps.google.com/..." 
                        value={googleMapsLink} 
                        onChange={(e) => setGoogleMapsLink(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500" 
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 ml-1">{t("signup.mapsLinkHint")}</p>
                    </div>
                  </div>
                </div>
              </Step>
             )}
            </Stepper>
            </div>

            {/* Submit Button */}
            <div className="pt-4 hidden">
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:-translate-y-0.5 ${accountType === 'doctor' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'}`}
              >
                {loading ? t("common.creating") : isGoogleCompletion ? t("signup.finishGoogle") : t("signup.finish")}
              </button>
            </div>
          </form>

          {/* Social Signup (Only if standard logic without completion step active) */}
          {!isGoogleCompletion && (
            <>
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{t("common.or")}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              </div>

              <button 
                type="button" 
                onClick={handleGoogleLogin}
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold py-4 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md transition-all duration-300 tracking-wide text-sm sm:text-[15px]"
              >
                <svg className="size-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t("signup.googleQuick")}
              </button>
            </>
          )}

          <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-8">
            {t("signup.hasAccount")}{" "}
            <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline transition-colors">
              {t("signup.connectNow")}
            </Link>
          </p>
        </div>
      </div>
    </div >
  );
}

export default function Signup() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950">{t("common.loading")}</div>}>
      <SignupForm />
    </Suspense>
  );
}
// made by larabi
