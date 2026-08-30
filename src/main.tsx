import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app/AppShell";
import { StrictMode, lazy, Suspense, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import "./index.css";

const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Words = lazy(() => import("./pages/Words.tsx"));
const Practice = lazy(() => import("./pages/Practice.tsx"));
const Watch = lazy(() => import("./pages/Watch.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));

function RouteLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-background"><div className="animate-pulse text-muted-foreground">Loading…</div></div>;
}
function RouteSyncer() {
  const location = useLocation();
  useEffect(() => { window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*"); }, [location.pathname]);
  return null;
}
function LocalRoute({ children }: { children: ReactNode }) { return <AppShell>{children}</AppShell>; }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="dark min-h-screen bg-background text-foreground">
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<LocalRoute><Dashboard /></LocalRoute>} />
            <Route path="/words" element={<LocalRoute><Words /></LocalRoute>} />
            <Route path="/practice" element={<LocalRoute><Practice /></LocalRoute>} />
            <Route path="/watch/:subtitleId" element={<LocalRoute><Watch /></LocalRoute>} />
            <Route path="/settings" element={<LocalRoute><Settings /></LocalRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </div>
  </StrictMode>,
);
