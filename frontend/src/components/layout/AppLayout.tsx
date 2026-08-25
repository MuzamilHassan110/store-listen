import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, CalendarClock, FileText, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquare, MonitorSmartphone, ScrollText, Settings, Shield, Store, Trophy, Users, X } from "lucide-react";
import { useRef, useState, type TouchEvent } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../lib/auth";
import { useRealtimeDashboard } from "../../hooks/useRealtimeDashboard";
import { LanguageSelector } from "../LanguageSelector";
import { Notifications } from "../Notifications";
import { StoreSelector } from "../StoreSelector";
import { Button } from "../ui/button";
import { BottomNav, MOBILE_TABS } from "./BottomNav";
import { InstallPrompt } from "../pwa/InstallPrompt";
import { PushPermission } from "../pwa/PushPermission";

const LINKS = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/conversations", labelKey: "nav.conversations", icon: MessageSquare },
  { to: "/stores", labelKey: "nav.stores", icon: Store },
  { to: "/devices", labelKey: "nav.devices", icon: MonitorSmartphone },
  { to: "/followups", labelKey: "nav.followups", icon: CalendarClock },
  { to: "/customers", labelKey: "nav.customers", icon: Users },
  { to: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { to: "/leaderboard", labelKey: "nav.leaderboard", icon: Trophy },
  { to: "/rules", labelKey: "nav.rules", icon: ListChecks },
  { to: "/reports", labelKey: "nav.reports", icon: FileText },
  { to: "/notifications", labelKey: "nav.notifications", icon: Bell },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
  { to: "/settings/security", labelKey: "nav.security", icon: Shield },
  { to: "/audit-logs", labelKey: "nav.audit", icon: ScrollText },
  { to: "/settings/whatsapp", labelKey: "nav.whatsapp", icon: MessageSquare },
];

export function AppLayout() {
  const { session, signOut } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const touchStartX = useRef(0);
  useRealtimeDashboard();

  function onTouchStart(event: TouchEvent<HTMLElement>): void {
    touchStartX.current = event.changedTouches[0]?.clientX ?? 0;
  }

  function onTouchEnd(event: TouchEvent<HTMLElement>): void {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) < 80) return;
    const index = MOBILE_TABS.indexOf(location.pathname as (typeof MOBILE_TABS)[number]);
    if (index < 0) return;
    const next = delta < 0 ? MOBILE_TABS[index + 1] : MOBILE_TABS[index - 1];
    if (next) navigate(next);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:grid lg:grid-cols-[240px_1fr]">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 lg:hidden">
        <p className="font-semibold tracking-wide text-emerald-400">StoreListen</p>
        <div className="flex items-center gap-2">
          <StoreSelector />
          <LanguageSelector />
          <Notifications />
          <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <aside
        className={`${open ? "block" : "hidden"} border-b border-slate-800 bg-slate-950 p-4 lg:block lg:border-b-0 lg:border-r`}
      >
        <p className="hidden text-lg font-semibold tracking-wide text-emerald-400 lg:block">StoreListen</p>
        <nav className="mt-4 flex flex-col gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  isActive ? "bg-emerald-500/15 text-emerald-300" : "text-slate-300 hover:bg-slate-900"
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {t(link.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <p className="truncate">{session?.user.email ?? t("nav.notSignedIn")}</p>
          {session ? (
            <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              {t("nav.signOut")}
            </Button>
          ) : null}
        </div>
      </aside>

      <main
        className="min-w-0 px-4 py-6 pb-24 md:pb-6 lg:px-8"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
          <StoreSelector />
          <LanguageSelector />
          <Notifications />
        </div>
        <InstallPrompt />
        <PushPermission />
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
