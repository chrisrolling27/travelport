export default function LoadingSkeleton({ className = "h-28 w-full" }) {
  return <div className={`animate-pulse rounded-xl bg-travelport-gray-100 ${className}`} />;
}

