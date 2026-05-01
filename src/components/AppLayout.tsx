import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  LogOut,
  Settings,
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  ClipboardList,
  UserCog,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppFooter } from "@/components/AppFooter";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { to: "/admin", label: "اللوحة", icon: LayoutDashboard },
  { to: "/admin/courses", label: "المقررات", icon: BookOpen },
  { to: "/admin/students", label: "الطلاب", icon: Users },
  { to: "/admin/supervisors", label: "المشرفون", icon: UserCog },
  { to: "/admin/assignments", label: "طلبات التسليم", icon: FileText },
  { to: "/admin/passwords", label: "كلمات المرور", icon: KeyRound },
];

const supervisorNav: NavItem[] = [
  { to: "/supervisor", label: "اللوحة", icon: LayoutDashboard },
  { to: "/supervisor/courses", label: "مقرراتي", icon: BookOpen },
  { to: "/supervisor/assignments", label: "طلبات التسليم", icon: FileText },
];

const studentNav: NavItem[] = [
  { to: "/student", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/student/courses", label: "مقرراتي", icon: BookOpen },
  { to: "/student/submissions", label: "سجل التسليمات", icon: ClipboardList },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const items =
    role === "admin" ? adminNav : role === "supervisor" ? supervisorNav : studentNav;
  const home =
    role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/student";
  const roleLabel =
    role === "admin" ? "واجهة المسؤول" : role === "supervisor" ? "واجهة المشرف" : "واجهة الطالب";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="container flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6">
          <Link to={home} className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-soft">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight">منصة التسليم</p>
              <p className="text-[11px] text-muted-foreground truncate">{roleLabel}</p>
            </div>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm max-w-[200px]">
              <span className="text-muted-foreground">مرحبًا،</span>
              <span className="font-semibold truncate">{profile?.full_name}</span>
            </div>
            <Link to="/settings">
              <Button variant="ghost" size="icon" aria-label="الإعدادات" className="h-9 w-9">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="خروج" className="h-9 w-9">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container grid gap-6 py-4 sm:py-6 px-3 sm:px-6 lg:grid-cols-[240px_1fr] flex-1">
        <aside className="hidden lg:block lg:sticky lg:top-20 lg:self-start">
          <nav className="flex flex-col gap-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin" || item.to === "/student" || item.to === "/supervisor"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-smooth",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 animate-fade-in">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="التنقل الرئيسي"
      >
        <ul className="flex items-stretch justify-around">
          {items.map((item) => (
            <li key={item.to} className="flex-1 min-w-0">
              <NavLink
                to={item.to}
                end={item.to === "/admin" || item.to === "/student" || item.to === "/supervisor"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-smooth",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate max-w-full leading-none">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <AppFooter />
    </div>
  );
}
