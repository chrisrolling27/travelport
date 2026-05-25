import { Suspense } from "react";
import DashboardShell from "./DashboardShell";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function DashboardLayout({ children }) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-6">
          <LoadingSkeleton className="h-72 w-full max-w-3xl" />
        </main>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
