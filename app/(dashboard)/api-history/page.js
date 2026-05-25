"use client";

import ApiHistoryContent from "@/components/ApiHistoryContent";
import PageHeader from "@/components/PageHeader";

export default function ApiHistoryPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="API History" subtitle="Review the Adyen API calls made during this session" />
      <ApiHistoryContent />
    </div>
  );
}

