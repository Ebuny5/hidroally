import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { resolvePostLoginRoute } from "@/utils/onboardingStatus";

type OtpType = "recovery" | "signup" | "email" | "email_change" | "magiclink" | "invite";

const AuthConfirm = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirming your request...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get("token_hash");
    const type = (params.get("type") || "") as OtpType;
    if (!token_hash || !type) {
      navigate("/login", { replace: true });
      return;
    }
    (async () => {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (error || !data.user) {
        setMessage("This link is invalid or has expired. Please request a new one.");
        setTimeout(() => navigate(type === "recovery" ? "/forgot-password" : "/login", { replace: true }), 2500);
        return;
      }
      if (type === "recovery") {
        navigate("/reset-password", { replace: true });
      } else {
        void supabase.functions.invoke('send-welcome-email', { body: {} }).catch(() => {});
        navigate(await resolvePostLoginRoute(data.user), { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <AppLayout isAuthenticated={false}>
      <div className="flex justify-center items-center min-h-screen bg-background p-4">
        <p className="text-muted-foreground text-center">{message}</p>
      </div>
    </AppLayout>
  );
};

export default AuthConfirm;
