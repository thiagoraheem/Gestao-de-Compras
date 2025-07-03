import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import KanbanPage from "@/pages/kanban";
import SuppliersPage from "@/pages/suppliers";
import UsersPage from "@/pages/users";
import DepartmentsPage from "@/pages/departments";
import ProfilePage from "@/pages/profile";
import ChangePasswordPage from "@/pages/change-password";
import RequestManagementPage from "@/pages/request-management";
import PipefyHeader from "@/components/pipefy-header";
import FloatingNewRequestButton from "@/components/floating-new-request-button";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <PipefyHeader />
      <main className="pt-16 min-h-screen">
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
    return <LoginPage />;
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={KanbanPage} />
        <Route path="/request-management" component={RequestManagementPage} />
        <Route path="/suppliers" component={SuppliersPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/departments" component={DepartmentsPage} />
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
