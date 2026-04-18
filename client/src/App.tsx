import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { Toaster } from "@/shared/ui/toaster";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { AppRoutes } from "@/app/routes";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Toaster />
          <AppRoutes />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
