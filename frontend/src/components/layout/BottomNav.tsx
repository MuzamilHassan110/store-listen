import { NavLink } from "react-router-dom";
import { Bell, LayoutDashboard, MessageSquare, Settings, Trophy } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

const ITEMS = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/conversations", labelKey: "nav.conversations", icon: MessageSquare, end: false },
  { to: "/leaderboard", labelKey: "nav.salesmen", icon: Trophy, end: false },
  { to: "/notifications", labelKey: "nav.notifications", icon: Bell, end: false },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, end: false },
] as const;

export const MOBILE_TABS = ITEMS.map((item) => item.to);

export function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] ${
                  isActive ? "text-emerald-300" : "text-slate-400"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
