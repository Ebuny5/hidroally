import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginRoute } from "@/utils/onboardingStatus";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [processingOAuth, setProcessingOAuth] = useState(true);

  // Parse hash params coming back from Supabase (OAuth/email confirmation flows)
  const { type, error, error_description } = useMemo(() => {
    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    const params = new URLSearchParams(hash);
    return {
      type: params.get("type") || "",
      error: params.get("error") || "",
      error_description: params.get("error_description") || "",
    };
  }, []);

  // Process OAuth tokens from URL hash
  useEffect(() => {
    const processOAuthCallback = async () => {
      const hash = window.location.hash;
      
      // If there's an access_token in the hash, Supabase needs to process it
      if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
        console.log('Processing OAuth callback...');
        try {
          // Give Supabase time to process the hash and set up the session
          // The onAuthStateChange listener in AuthContext will pick this up
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verify session was established
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('OAuth session established:', session.user.id);
          } else {
            console.log('No session after OAuth callback');
          }
        } catch (err) {
          console.error('Error processing OAuth callback:', err);
        }
      }
      setProcessingOAuth(false);
    };

    processOAuthCallback();
  }, []);

  useEffect(() => {
    // Wait for OAuth processing to complete
    if (processingOAuth) return;

    // If there's an explicit error coming from the provider/email link, go to login
    if (error || error_description) {
      const t = setTimeout(() => {
        navigate("/login", { replace: true });
      }, 800);
      return () => clearTimeout(t);
    }

    // Once auth context finishes loading, decide where to go
    if (!loading) {
      // For recoveries, we should send users to the reset password page
      if (type === "recovery") {
        navigate("/reset-password", { replace: true });
        return;
      }

      // Default: if we have a user, check if they need profile setup. If not, back to login.
      const t = setTimeout(async () => {
        if (user) {
          // The server allows only a verified signup queued in the protected delivery ledger.
          // A failed profile read must never turn a returning login into a new welcome.
          void supabase.functions.invoke('send-welcome-email', { body: {} }).catch(() => {});

          const route = await resolvePostLoginRoute(user);
          navigate(route, { replace: true });
        } else {
          console.log('No user found, redirecting to login');
          navigate("/login", { replace: true });
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [loading, user, type, error, error_description, navigate, processingOAuth]);

  return (
    <AppLayout isAuthenticated={false}>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 bg-primary/30 rounded-full blur-xl animate-pulse" />
            <img src="/sweatsmart-logo.png" alt="HidroAlly" className="w-16 h-16 relative z-10 animate-bounce object-contain" />
          </div>
          <p className="text-sm font-semibold text-primary tracking-wide animate-pulse">
            {processingOAuth ? "Signing you in to HidroAlly…" : "Getting HidroAlly ready…"}
          </p>
          {error_description ? (
            <p className="text-xs text-destructive max-w-sm">
              {error_description}
            </p>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
};

export default AuthCallback;
