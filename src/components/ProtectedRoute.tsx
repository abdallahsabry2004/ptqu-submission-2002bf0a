import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  children,
  requiredRole,
  allowRoles,
}: {
  children: ReactNode;
  requiredRole?: AppRole;
  allowRoles?: AppRole[];
}) {
  const { user, role, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (profile?.must_change_password && location.pathname !== "/settings") {
    return <Navigate to="/settings" replace state={{ forcedPasswordChange: true }} />;
  }

  const allowed = allowRoles ?? (requiredRole ? [requiredRole] : null);
  if (allowed && (!role || !allowed.includes(role))) {
    const dest = role === "admin" ? "/admin" : role === "supervisor" ? "/supervisor" : "/student";
    return <Navigate to={dest} replace />;
  }

  return <>{children}</>;
}
