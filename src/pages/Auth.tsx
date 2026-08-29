import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Quote, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export default function AuthPage({ redirectAfterAuth = "/dashboard" }: { redirectAfterAuth?: string }) {
  const { isLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("returnTo")?.startsWith("/") ? params.get("returnTo")! : redirectAfterAuth;
  useEffect(() => { if (!isLoading && isAuthenticated) navigate(redirect, { replace: true }); }, [isLoading, isAuthenticated, navigate, redirect]);
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><Card className="w-full max-w-md shadow-xl"><CardHeader className="text-center"><div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Quote className="size-5" /></div><CardTitle>Local learner workspace</CardTitle><CardDescription>Your data stays on this computer. No account, email, cloud service, or API key is required.</CardDescription></CardHeader><CardContent><Button className="w-full gap-2" onClick={() => signIn().then(() => navigate(redirect))}><ShieldCheck className="size-4" />Continue locally</Button></CardContent></Card></main>;
}
