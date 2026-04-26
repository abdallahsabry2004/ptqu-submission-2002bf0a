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
  { to: "/supervisor/students", label: "الطلاب", icon: Users },
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
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to={home} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-hero text-primary-foreground shadow-soft">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="hidden sm:block">
              <p className="font-display text-sm font-bold leading-tight">منصة التسليم</p>
              <p className="text-[11px] text-muted-foreground">{roleLabel}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm">
              <span className="text-muted-foreground">مرحبًا،</span>
              <span className="font-semibold">{profile?.full_name}</span>
            </div>
            <Link to="/settings">
              <Button variant="ghost" size="icon" aria-label="الإعدادات">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="خروج">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container grid gap-6 py-6 lg:grid-cols-[240px_1fr] flex-1">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <nav className="flex flex-row flex-wrap gap-2 lg:flex-col">
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

      <AppFooter />
    </div>
  );
}
