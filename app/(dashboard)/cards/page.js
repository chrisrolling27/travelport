"use client";

import CardsContent from "@/components/CardsContent";
import PageHeader from "@/components/PageHeader";

export default function CardsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Cards" subtitle="Create payment instruments that spend funds in your balance account" />
      <CardsContent />
    </div>
  );
}

