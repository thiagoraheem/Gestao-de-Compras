import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import EnhancedNewRequestModal from "./enhanced-new-request-modal";

export default function FloatingNewRequestButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-14 md:bottom-6 left-6 z-50 h-14 px-6 bg-orange-500 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-full"
        size="lg"
      >
        <Plus className="w-5 h-5 mr-2" />
        Nova Solicitação
      </Button>

      <EnhancedNewRequestModal 
        open={isModalOpen} 
        onOpenChange={(open) => setIsModalOpen(open)} 
      />
    </>
  );
}
