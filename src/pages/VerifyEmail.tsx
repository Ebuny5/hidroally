import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailCheck } from "lucide-react";
import { resolvePostLoginRoute } from "@/utils/onboardingStatus";

const VerifyEmail = () => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const email = location.state?.email || new URLSearchParams(location.search).get("email");

  useEffect(() => {
    if (!email) navigate("/login", { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (!email || token.length < 6) {
      setErrorMsg("Enter the 6-digit code from your email.");
      return;
    }
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (error || !data.user) {
        setErrorMsg(
          error?.message?.toLowerCase().includes("expired")
            ? "This code has expired. Tap resend to get a new one."
            : "That code didn't work. Check it and try again."
        );
        return;
      }
      toast({ title: "Email verified 🎉", description: "Welcome to HidroAlly, your dashboard is ready." });
      const route = await resolvePostLoginRoute(data.user);
      navigate(route, { replace: true });
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `https://www.hidroally.space/auth/callback` },
      });
      if (error) {
        toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
      } else {
        setCooldown(60);
        toast({ title: "Code sent!", description: "A new verification code is on its way." });
      }
    } finally {
      setIsResending(false);
    }
  };

  if (!email) return null;

  return (
    <AppLayout isAuthenticated={false}>
      <div className="flex justify-center items-center min-h-screen bg-background p-4">
        <div className="bg-card rounded-2xl shadow-md border border-border p-6 sm:p-8 max-w-md w-full text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <MailCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mt-3">
            We sent a verification code to <strong className="text-foreground">{email}</strong>. Enter it below to activate your account.
          </p>

          <form onSubmit={handleVerify} className="mt-6 space-y-4">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErrorMsg(null); }}
              placeholder="••••••"
              aria-label="Verification code"
              className="h-14 text-center text-2xl tracking-[0.5em] font-bold"
            />
            {errorMsg && <p className="text-sm text-destructive" role="alert">{errorMsg}</p>}
            <Button type="submit" className="w-full h-14 text-base font-semibold" disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Verify & Activate Warrior Dashboard"}
            </Button>
          </form>

          <div className="flex flex-col space-y-4 pt-6 mt-6 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Can't find it? Check spam or promotions, or{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || cooldown > 0}
                className="text-primary hover:underline font-medium disabled:opacity-50"
              >
                {isResending ? "resending..." : cooldown > 0 ? `resend in ${cooldown}s` : "resend the code"}
              </button>.
            </div>
            <Link to="/register" className="text-xs text-primary hover:underline">Wrong email address? Change it</Link>
            <Link to="/login" className="text-primary text-sm hover:underline font-medium">Return to Login</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default VerifyEmail;
