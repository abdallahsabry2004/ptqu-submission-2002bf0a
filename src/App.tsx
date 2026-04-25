import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCourseDetail from "./pages/admin/AdminCourseDetail";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminAssignments from "./pages/admin/AdminAssignments";
import AdminAssignmentGroups from "./pages/admin/AdminAssignmentGroups";
import AdminSupervisors from "./pages/admin/AdminSupervisors";
import SupervisorDashboard from "./pages/supervisor/SupervisorDashboard";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCourses from "./pages/student/StudentCourses";
import StudentCourseDetail from "./pages/student/StudentCourseDetail";
import StudentAssignmentDetail from "./pages/student/StudentAssignmentDetail";
import StudentAssignmentGroups from "./pages/student/StudentAssignmentGroups";
import StudentSubmissions from "./pages/student/StudentSubmissions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" dir="rtl" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute requiredRole="admin"><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/courses/:id" element={<ProtectedRoute requiredRole="admin"><AdminCourseDetail /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute requiredRole="admin"><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/supervisors" element={<ProtectedRoute requiredRole="admin"><AdminSupervisors /></ProtectedRoute>} />
            <Route path="/admin/assignments" element={<ProtectedRoute requiredRole="admin"><AdminAssignments /></ProtectedRoute>} />
            <Route path="/admin/assignments/:id/groups" element={<ProtectedRoute requiredRole="admin"><AdminAssignmentGroups /></ProtectedRoute>} />

            {/* Supervisor */}
            <Route path="/supervisor" element={<ProtectedRoute requiredRole="supervisor"><SupervisorDashboard /></ProtectedRoute>} />
            <Route path="/supervisor/courses" element={<ProtectedRoute requiredRole="supervisor"><AdminCourses /></ProtectedRoute>} />
            <Route path="/supervisor/courses/:id" element={<ProtectedRoute requiredRole="supervisor"><AdminCourseDetail /></ProtectedRoute>} />
            <Route path="/supervisor/students" element={<ProtectedRoute requiredRole="supervisor"><AdminStudents /></ProtectedRoute>} />
            <Route path="/supervisor/assignments" element={<ProtectedRoute requiredRole="supervisor"><AdminAssignments /></ProtectedRoute>} />
            <Route path="/supervisor/assignments/:id/groups" element={<ProtectedRoute requiredRole="supervisor"><AdminAssignmentGroups /></ProtectedRoute>} />

            {/* Student */}
            <Route path="/student" element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/courses" element={<ProtectedRoute requiredRole="student"><StudentCourses /></ProtectedRoute>} />
            <Route path="/student/courses/:id" element={<ProtectedRoute requiredRole="student"><StudentCourseDetail /></ProtectedRoute>} />
            <Route path="/student/assignments/:id" element={<ProtectedRoute requiredRole="student"><StudentAssignmentDetail /></ProtectedRoute>} />
            <Route path="/student/assignments/:id/groups" element={<ProtectedRoute requiredRole="student"><StudentAssignmentGroups /></ProtectedRoute>} />
            <Route path="/student/submissions" element={<ProtectedRoute requiredRole="student"><StudentSubmissions /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
