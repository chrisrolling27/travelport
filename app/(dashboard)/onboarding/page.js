"use client";

import OnboardingContent from "@/components/OnboardingContent";
import PageHeader from "@/components/PageHeader";

export default function OnboardingPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Onboarding" subtitle="Submit information to satisfy KYC onboarding and enable Capabilities" />
      <OnboardingContent />
    </div>
  );
}
