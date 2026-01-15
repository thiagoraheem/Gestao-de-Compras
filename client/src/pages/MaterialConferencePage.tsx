import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import ConferenceDashboard from "@/components/conference/ConferenceDashboard";
import ConferenceOrderList from "@/components/conference/ConferenceOrderList";
import ReceiptPhase from "@/components/receipt-phase";
import { PackageCheck } from "lucide-react";

export default function MaterialConferencePage() {
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Poll every 30 seconds as requested
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/purchase-requests/phase/recebimento"],
    queryFn: async () => {
      const res = await fetch("/api/purchase-requests/phase/recebimento");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!user,
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto py-8 px-4 flex flex-col min-h-full">
        <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-full">
          <PackageCheck className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conferência de Material</h1>
          <p className="text-muted-foreground">
            Gerencie o recebimento físico e conferência de pedidos de compra.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          <ConferenceDashboard requests={requests} />
          <ConferenceOrderList 
            requests={requests} 
            onSelect={setSelectedRequest} 
          />
        </>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRequest(null)}>
          <div className="bg-background dark:bg-slate-900 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto shadow-xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <ReceiptPhase 
              request={selectedRequest} 
              onClose={() => setSelectedRequest(null)} 
              className="p-6" 
              hideTabsByDefault 
              mode="physical"
              compactHeader
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
