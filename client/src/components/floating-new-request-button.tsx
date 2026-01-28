import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Eye } from "lucide-react";
import EnhancedNewRequestModal from "./enhanced-new-request-modal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function FloatingNewRequestButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Load visibility state from localStorage on mount
  useEffect(() => {
    const storedVisibility = localStorage.getItem("newRequestBtnVisible");
    if (storedVisibility === "false") {
      setIsVisible(false);
    }
  }, []);

  const toggleVisibility = (visible: boolean) => {
    setIsVisible(visible);
    localStorage.setItem("newRequestBtnVisible", String(visible));
  };

  return (
    <>
      {isVisible ? (
        <div className="fixed bottom-14 md:bottom-6 left-6 z-50 group animate-in fade-in zoom-in duration-300">
          <Button
            onClick={() => setIsModalOpen(true)}
            className="h-14 px-6 bg-orange-500 hover:bg-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 rounded-full"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Solicitação
          </Button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVisibility(false);
            }}
            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-slate-700 focus:opacity-100 outline-none"
            title="Ocultar botão temporariamente"
            aria-label="Ocultar botão de nova solicitação"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => toggleVisibility(true)}
                className="fixed bottom-14 md:bottom-6 left-6 z-50 h-10 w-10 p-0 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 shadow-md transition-all duration-200 rounded-full opacity-50 hover:opacity-100 animate-in fade-in zoom-in duration-300"
                variant="secondary"
                aria-label="Mostrar botão de nova solicitação"
              >
                <Eye className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Mostrar botão "Nova Solicitação"</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <EnhancedNewRequestModal 
        open={isModalOpen} 
        onOpenChange={(open) => setIsModalOpen(open)} 
      />
    </>
  );
}
