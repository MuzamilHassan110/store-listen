import { NavLink, Outlet } from "react-router-dom";
import { BarChart3, CalendarClock, FileText, LayoutDashboard, ListChecks, LogOut, Menu, MessageSquare, Trophy, Users, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { Notifications } from "../Notifications";
import { Button } from "../ui/button";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/conversations", label: "Conversations", icon: MessageSquare },
  { to: "/followups", label: "Follow-ups", icon: CalendarClock },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/rules", label: "Rules", icon: ListChecks },
  { to: "/reports", label: "Reports", icon: FileText },
];

export function AppLayout() {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:grid lg:grid-cols-[240px_1fr]">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 lg:hidden">
        <p className="font-semibold tracking-wide text-emerald-400">StoreListen</p>
        <div className="flex items-center gap-2">
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
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
          <p className="truncate">{session?.user.email ?? "Not signed in"}</p>
          {session ? (
            <Button variant="ghost" size="sm" className="mt-2 px-0" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 lg:px-8">
        <div className="mb-4 hidden justify-end lg:flex">
          <Notifications />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
