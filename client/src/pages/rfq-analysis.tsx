import { useQuery } from "@tanstack/react-query"
import RFQAnalysis from "@/components/rfq-analysis"
import { useLocation } from "wouter"

export default function RFQAnalysisPage({ params }: { params: { id: string } }) {
  const quotationId = Number(params.id)
  const [, setLocation] = useLocation()

  const { data: quotation } = useQuery({
    queryKey: ["/api/quotations", quotationId],
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}`)
      return res.json()
    }
  })

  const { data: quotationItems = [] } = useQuery({
    queryKey: ["/api/quotations", quotationId, "items"],
    enabled: !!quotationId,
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}/items`)
      return res.json()
    }
  })

  const { data: supplierQuotations = [] } = useQuery({
    queryKey: ["/api/quotations", quotationId, "supplier-quotations"],
    enabled: !!quotationId,
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}/supplier-quotations`)
      return res.json()
    }
  })

  if (!quotation) return null

  return (
    <RFQAnalysis
      quotation={quotation}
      quotationItems={quotationItems}
      supplierQuotations={supplierQuotations}
      fullPage={true}
      onClose={() => setLocation("/kanban")}
    />
  )
}

