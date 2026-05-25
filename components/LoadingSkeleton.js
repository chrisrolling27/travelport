export default function LoadingSkeleton({ className = "h-28 w-full" }) {
  return <div className={`animate-pulse rounded-xl bg-adyen-gray-100 ${className}`} />;
}

