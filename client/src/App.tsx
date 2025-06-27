import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import KanbanPage from "@/pages/kanban";
import SuppliersPage from "@/pages/suppliers";
import UsersPage from "@/pages/users";
import DepartmentsPage from "@/pages/departments";

function Router() {
  return (
    <Switch>
      <Route path="/" component={KanbanPage} />
      <Route path="/suppliers" component={SuppliersPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/departments" component={DepartmentsPage} />
      <Route component={NotFound} />
    </Switch>
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
