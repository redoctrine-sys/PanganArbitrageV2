"use client";

import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { CSVUploader } from "@/components/csv/CSVUploader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Topbar onUploadClick={() => setUploadOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {children}
        </main>
      </div>
      {uploadOpen && (
        <CSVUploader
          onClose={() => setUploadOpen(false)}
          onIngestSuccess={() => {
            setUploadOpen(false);
            // Trigger SP2KP page reload (simplest reliable approach for Phase 1).
            if (typeof window !== "undefined") window.location.reload();
          }}
        />
      )}
    </div>
  );
}
