import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import PublicRequestView from "@/pages/public-request-view";
import NotFound from "@/pages/not-found";
import KanbanPage from "@/pages/kanban";
import KanbanIOSPage from "@/pages/kanban-ios";
import { isIPhone } from "@/lib/device";
import ListPage from "@/pages/list";
import SuppliersPage from "@/pages/suppliers";
import UsersPage from "@/pages/users";
import DepartmentsPage from "@/pages/departments";
import DeliveryLocationsPage from "@/pages/delivery-locations";
import ProfilePage from "@/pages/profile";
import ChangePasswordPage from "@/pages/change-password";
import RequestManagementPage from "@/pages/request-management";
import QuotationManagementPage from "@/pages/quotation-management";
import CompaniesPage from "@/pages/companies";
import PipefyHeader from "@/components/pipefy-header";
import FloatingNewRequestButton from "@/components/floating-new-request-button";
import FloatingHelpButton from "@/components/floating-help-button";
import AdminCleanupPage from "@/pages/admin-cleanup";
import AdminSuperUserPage from "@/pages/admin-super-user";
import ApprovalConfigPage from "@/pages/approval-config";
import AdminLocadorConfigPage from "@/pages/admin-locador-config";
import DashboardPage from "@/pages/dashboard";
import UserManualPage from "@/pages/user-manual";
import PurchaseRequestsReportPage from "@/pages/purchase-requests-report";
import ItemsAnalysisReportPage from "@/pages/items-analysis-report";
import SuppliersReportPage from "@/pages/suppliers-report";
import RFQAnalysisPage from "@/pages/rfq-analysis";
import ReceiptFormPage from "@/pages/receipt-form";
import MaterialConferencePage from "@/pages/MaterialConferencePage";
import InvoicesReportPage from "@/pages/invoices-report";
import ManagerRoute from "@/components/manager-route";
import AdminRoute from "@/components/admin-route";
import AdminOrBuyerRoute from "@/components/admin-or-buyer-route";
import { RealtimeSyncProvider } from "@/components/realtime-sync";
import { useApprovalsBadge } from "@/hooks/useApprovalsBadge";
import NotificationsPermission from "@/components/NotificationsPermission";
import ApprovalsInlineBadge from "@/components/approvals-inline-badge";

const KanbanRoute = () => (isIPhone() ? <KanbanIOSPage /> : <KanbanPage />);

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  useApprovalsBadge();
  return (
    <div className="min-h-[100svh] bg-background">
      <div className="flex items-center justify-between">
        <PipefyHeader />
        <div className="hidden md:flex items-center gap-2 pr-4">
          <NotificationsPermission />
        </div>
      </div>
      <main className="pt-16 min-h-[100svh] md:h-[100vh] md:overflow-y-hidden">
        {children}
      </main>
      <FloatingNewRequestButton />
      <FloatingHelpButton />
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated && user?.forceChangePassword && location !== '/change-password') {
      setLocation('/change-password');
    }
  }, [isAuthenticated, user, location, setLocation]);

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
      if (currentPath !== '/' && !currentPath.includes('login') && !currentPath.includes('forgot-password') && !currentPath.includes('reset-password') && !currentPath.includes('public')) {
        try {
          sessionStorage.setItem('redirectAfterLogin', currentPath);
        } catch {}
      }
    }

    // Public routes (no authentication required)
    return (
      <Switch>
        <Route path="/public/request/:id" component={PublicRequestView} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <RealtimeSyncProvider />
      <Switch>
        <Route path="/" component={KanbanRoute} />
        <Route path="/kanban" component={KanbanRoute} />
        <Route path="/list" component={ListPage} />
        <Route path="/dashboard">
          <ManagerRoute>
            <DashboardPage />
          </ManagerRoute>
        </Route>
        <Route path="/request-management" component={RequestManagementPage} />
        <Route path="/quotations" component={QuotationManagementPage} />
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
        <Route path="/admin/super-user">
          <AdminRoute>
            <AdminSuperUserPage />
          </AdminRoute>
        </Route>
        <Route path="/admin/approval-config">
          <AdminRoute>
            <ApprovalConfigPage />
          </AdminRoute>
        </Route>
        <Route path="/admin/locador-config">
          <AdminRoute>
            <AdminLocadorConfigPage />
          </AdminRoute>
        </Route>
        <Route path="/profile" component={ProfilePage} />
        <Route path="/change-password" component={ChangePasswordPage} />
        <Route path="/manual" component={UserManualPage} />
        <Route path="/recebimentos/novo" component={ReceiptFormPage} />
        <Route path="/conferencia-material" component={MaterialConferencePage} />
        <Route path="/reports/invoices" component={InvoicesReportPage} />
        <Route path="/reports/purchase-requests" component={PurchaseRequestsReportPage} />
        <Route path="/reports/items-analysis" component={ItemsAnalysisReportPage} />
        <Route path="/reports/suppliers" component={SuppliersReportPage} />
        <Route path="/rfq-analysis/:id" component={RFQAnalysisPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
