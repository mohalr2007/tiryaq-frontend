// made by mohamed
import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const authType = searchParams.get('type')
    const requestedRole = searchParams.get('role')
    const oauthError = searchParams.get('error')

    if (oauthError) {
        return NextResponse.redirect(`${origin}/auth/auth-error`)
    }

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            // Fetch the user to determine where to redirect
            const { data: { user } } = await supabase.auth.getUser()

            if (user?.id) {
                void (async () => {
                  try {
                    await supabase.from('system_audit_logs').insert({
                      actor_id: user.id,
                      action: 'user_signed_in',
                      entity_type: 'auth',
                      metadata: { method: 'oauth_google_callback' }
                    });
                  } catch {
                    // Best-effort only: auth redirect must never depend on audit persistence.
                  }
                })();
            }
            
            // Check profiles table for account type - try governance columns first, fallback to basic
            let profile: {
              account_type?: string | null;
              doctor_verification_status?: string | null;
              is_doctor_verified?: boolean | null;
              moderation_status?: string | null;
            } | null = null;

            const { data: fullProfile, error: fullError } = await supabase
                .from('profiles')
                .select('account_type, doctor_verification_status, is_doctor_verified, moderation_status')
                .eq('id', user?.id || '')
                .single()

            if (!fullError && fullProfile) {
              profile = fullProfile;
            } else {
              // Governance columns may not exist yet — fallback to basic select
              const { data: basicProfile } = await supabase
                  .from('profiles')
                  .select('account_type')
                  .eq('id', user?.id || '')
                  .single()
              profile = basicProfile ? { ...basicProfile, doctor_verification_status: null, is_doctor_verified: null, moderation_status: null } : null;
            }
            
            const accountType = profile?.account_type || user?.user_metadata?.account_type

            if (accountType === 'doctor') {
                return NextResponse.redirect(`${origin}/doctor-dashboard`)
            } else if (accountType === 'patient') {
                return NextResponse.redirect(`${origin}/patient-dashboard`)
            } else {
                // If the user doesn't have an account type yet (fresh Google sign in),
                // redirect them to the signup page to complete their profile.
                const completionParams = new URLSearchParams({ step: 'complete' })
                if (authType === 'signup' && (requestedRole === 'doctor' || requestedRole === 'patient')) {
                    completionParams.set('role', requestedRole)
                }
                return NextResponse.redirect(`${origin}/signup?${completionParams.toString()}`)
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-error`)
}
// made by mohamed
