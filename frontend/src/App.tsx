import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/supabase";
import { AppLayout } from "./components/layout/AppLayout";
import { Skeleton } from "./components/ui/skeleton";
import Login from "./pages/Login";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Conversations = lazy(() => import("./pages/Conversations"));
const ConversationDetail = lazy(() => import("./pages/ConversationDetail"));
const Followups = lazy(() => import("./pages/Followups"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Reports = lazy(() => import("./pages/Reports"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const SalesmanDetail = lazy(() => import("./pages/SalesmanDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Stores = lazy(() => import("./pages/Stores"));
const StoreDetail = lazy(() => import("./pages/StoreDetail"));
const StoreComparison = lazy(() => import("./pages/StoreComparison"));
const Devices = lazy(() => import("./pages/Devices"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const WhatsAppSettings = lazy(() => import("./pages/WhatsAppSettings"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Rules = lazy(() => import("./pages/Rules"));
const Products = lazy(() => import("./pages/Products"));
const Scripts = lazy(() => import("./pages/Scripts"));
const AdvancedAnalytics = lazy(() => import("./pages/AdvancedAnalytics"));

function PageFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-40" />
    </div>
  );
}

function ProtectedLayout() {
  const { session, loading, twoFactorRequired } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  if (isSupabaseConfigured && (!session || twoFactorRequired)) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/conversations/:id" element={<ConversationDetail />} />
          <Route path="/followups" element={<Followups />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/advanced" element={<AdvancedAnalytics />} />
          <Route path="/products" element={<Products />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/salesmen/:id" element={<SalesmanDetail />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/stores/compare" element={<StoreComparison />} />
          <Route path="/stores/:id" element={<StoreDetail />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/Rules" element={<Rules />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/whatsapp" element={<WhatsAppSettings />} />
          <Route path="/settings/security" element={<SecuritySettings />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
