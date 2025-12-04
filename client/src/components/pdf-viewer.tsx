import { useEffect, useRef } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/build/pdf";

interface PdfViewerProps {
  data: ArrayBuffer | null;
  className?: string;
}

export default function PdfViewer({ data, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data || !containerRef.current) return;

    try {
      GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    } catch {}

    const typed = new Uint8Array(data);
    const task = getDocument({ data: typed });
    let destroyed = false;

    task.promise
      .then(async (pdf: any) => {
        if (destroyed) return;
        const container = containerRef.current!;
        container.innerHTML = "";
        const pageCount = pdf.numPages;
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.2 });
          const canvas = document.createElement("canvas");
          canvas.style.display = "block";
          canvas.style.margin = "12px auto";
          const context = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: context, viewport }).promise;
          container.appendChild(canvas);
        }
      })
      .catch(() => {
        // Silent fail; container will remain empty
      });

    return () => {
      destroyed = true;
      try {
        (task as any)?.destroy?.();
      } catch {}
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      className={className || "w-full h-[72vh] overflow-auto bg-slate-50 dark:bg-slate-900 rounded-lg border border-border"}
      aria-label="Visualização de PDF"
    />
  );
}

