import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { isSupabaseConfigured } from "./lib/supabase";
import { AppLayout } from "./components/layout/AppLayout";
import { Skeleton } from "./components/ui/skeleton";
import Analytics from "./pages/Analytics";
import ConversationDetail from "./pages/ConversationDetail";
import Conversations from "./pages/Conversations";
import CustomerDetail from "./pages/CustomerDetail";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import Followups from "./pages/Followups";
import Leaderboard from "./pages/Leaderboard";
import Login from "./pages/Login";
import Reports from "./pages/Reports";
import Rules from "./pages/Rules";
import SalesmanDetail from "./pages/SalesmanDetail";
import Settings from "./pages/Settings";
import Stores from "./pages/Stores";
import StoreDetail from "./pages/StoreDetail";
import StoreComparison from "./pages/StoreComparison";
import Devices from "./pages/Devices";
import NotificationsPage from "./pages/NotificationsPage";
import WhatsAppSettings from "./pages/WhatsAppSettings";

function ProtectedLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8">
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }
  if (isSupabaseConfigured && !session) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export default function App() {
  return (
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
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  );
}
