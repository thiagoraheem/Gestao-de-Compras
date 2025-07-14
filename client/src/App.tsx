import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import KanbanPage from "@/pages/kanban";
import SuppliersPage from "@/pages/suppliers";
import UsersPage from "@/pages/users";
import DepartmentsPage from "@/pages/departments";
import DeliveryLocationsPage from "@/pages/delivery-locations";
import ProfilePage from "@/pages/profile";
import ChangePasswordPage from "@/pages/change-password";
import RequestManagementPage from "@/pages/request-management";
import CompaniesPage from "@/pages/companies";
import PipefyHeader from "@/components/pipefy-header";
import FloatingNewRequestButton from "@/components/floating-new-request-button";
import AdminCleanupPage from "@/pages/admin-cleanup";
import DashboardPage from "@/pages/dashboard";
import ManagerRoute from "@/components/manager-route";
import AdminRoute from "@/components/admin-route";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PipefyHeader />
      <main className="pt-16 h-screen">
        {children}
      </main>
      <FloatingNewRequestButton />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Store the current URL to redirect after login, but only if it's not the root
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== '/' && !currentPath.includes('login') && !currentPath.includes('forgot-password') && !currentPath.includes('reset-password')) {
        sessionStorage.setItem('redirectAfterLogin', currentPath);
      }
    }
    
    // Public routes (no authentication required)
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={KanbanPage} />
        <Route path="/kanban" component={KanbanPage} />
        <Route path="/dashboard">
          <ManagerRoute>
            <DashboardPage />
          </ManagerRoute>
        </Route>
        <Route path="/request-management" component={RequestManagementPage} />
        <Route path="/companies">
          <AdminRoute>
            <CompaniesPage />
          </AdminRoute>
        </Route>
        <Route path="/suppliers" component={SuppliersPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/departments" component={DepartmentsPage} />
        <Route path="/delivery-locations" component={DeliveryLocationsPage} />
        <Route path="/admin/cleanup" component={AdminCleanupPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/change-password" component={ChangePasswordPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;