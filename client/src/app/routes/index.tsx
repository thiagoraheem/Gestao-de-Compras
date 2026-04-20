import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import LoginPage from "@/features/auth/pages/LoginPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/features/auth/pages/ResetPasswordPage";
import PublicRequestView from "@/features/requests/pages/PublicRequestPage";
import NotFound from "@/shared/pages/NotFoundPage";
import KanbanPage from "@/features/requests/pages/KanbanPage";
import KanbanIOSPage from "@/features/requests/pages/KanbanIOSPage";
import { isIPhone } from "@/lib/device";
import ListPage from "@/features/requests/pages/ListPage";
import SuppliersManagement from "@/features/suppliers";
import UsersManagement from "@/features/users";
import DepartmentsManagement from "@/features/departments";
import DeliveryLocationsManagement from "@/features/delivery-locations";
import ProfilePage from "@/features/auth/pages/ProfilePage";
import ChangePasswordPage from "@/features/auth/pages/ChangePasswordPage";
import RequestManagementPage from "@/features/requests/pages/RequestManagementPage";
import QuotationManagementPage from "@/features/quotations/pages/QuotationManagementPage";
import CompaniesManagement from "@/features/companies";
import PipefyHeader from "@/shared/components/pipefy-header";
import FloatingNewRequestButton from "@/shared/components/floating-new-request-button";
import FloatingHelpButton from "@/shared/components/floating-help-button";
import AdminCleanupPage from "@/features/admin/pages/AdminCleanupPage";
import AdminSuperUser from "@/features/admin/super-user";
import AdminApprovalConfig from "@/features/admin/approval-config";
import AdminLocadorConfig from "@/features/admin/locador-config";
import DashboardPage from "@/features/dashboard";
import UserManualPage from "@/shared/pages/UserManualPage";
import PurchaseRequestsReportPage from "@/features/reports/pages/PurchaseRequestsReportPage";
import ItemsAnalysisReportPage from "@/features/reports/items-analysis-report";
import SuppliersReportPage from "@/features/reports/suppliers-report";
import RFQAnalysisPage from "@/features/quotations/pages/RFQAnalysisPage";
import ReceiptFormPage from "@/features/receipts/pages/ReceiptFormPage";
// import ReceiptsBoardPage from "@/pages/receipts-board";
import MaterialConferencePage from "@/features/receipts/pages/MaterialConferencePage";
import InvoicesReportPage from "@/features/reports/invoices-report";
import ManagerRoute from "@/app/guards/manager-route";
import AdminRoute from "@/app/guards/admin-route";
import AdminOrBuyerRoute from "@/app/guards/admin-or-buyer-route";
import { RealtimeSyncProvider } from "@/shared/components/realtime-sync";
import { useApprovalsBadge } from "@/hooks/useApprovalsBadge";
import NotificationsPermission from "@/shared/components/NotificationsPermission";

const KanbanRoute = () => (isIPhone() ? <KanbanIOSPage /> : <KanbanPage />);

export function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
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

export function AppRoutes() {
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
            <CompaniesManagement />
          </AdminRoute>
        </Route>
        <Route path="/suppliers" component={SuppliersManagement} />
        <Route path="/users" component={UsersManagement} />
        <Route path="/departments" component={DepartmentsManagement} />
        <Route path="/delivery-locations" component={DeliveryLocationsManagement} />
        <Route path="/admin/cleanup" component={AdminCleanupPage} />
        <Route path="/admin/super-user">
          <AdminRoute>
            <AdminSuperUser />
          </AdminRoute>
        </Route>
        <Route path="/admin/approval-config">
          <AdminRoute>
            <AdminApprovalConfig />
          </AdminRoute>
        </Route>
        <Route path="/admin/locador-config">
          <AdminRoute>
            <AdminLocadorConfig />
          </AdminRoute>
        </Route>
        <Route path="/profile" component={ProfilePage} />
        <Route path="/change-password" component={ChangePasswordPage} />
        <Route path="/manual" component={UserManualPage} />
        <Route path="/recebimentos/novo" component={ReceiptFormPage} />
        {/* <Route path="/recebimentos" component={ReceiptsBoardPage} /> */}
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
