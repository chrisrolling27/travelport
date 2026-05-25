/** Visa wordmark path (Simple Icons, CC0). */
const VISA_PATH =
  "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z";

export function isVisaBrand(brand) {
  return String(brand || "").toLowerCase().includes("visa");
}

/**
 * @param {{ tone?: "onDark" | "onLight", size?: "wallet" | "picker", className?: string }} props
 */
export function VisaWordmark({ tone = "onDark", size = "wallet", className = "" }) {
  const color = tone === "onDark" ? "text-white" : "text-[#1434CB]";
  const box =
    size === "wallet"
      ? "h-12 w-[8rem] translate-x-3 sm:h-[3.25rem] sm:w-[9rem] sm:translate-x-4"
      : "h-8 w-[5.5rem] sm:h-9 sm:w-[6.25rem]";
  return (
    <svg
      className={`${color} ${box} shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Visa"
    >
      <path d={VISA_PATH} />
    </svg>
  );
}

/**
 * @param {{ tone?: "onDark" | "onLight", size?: "wallet" | "picker", layout?: "stack" | "row", className?: string }} props
 */
export function MastercardBrandMark({
  tone = "onDark",
  size = "wallet",
  layout = "stack",
  className = "",
}) {
  const textColor = tone === "onDark" ? "text-white" : "text-[#0B0B0B]";
  const svgBox =
    size === "wallet" ? "h-10 w-[4rem] sm:h-11 sm:w-[4.5rem]" : "h-9 w-[3.75rem] sm:h-10 sm:w-[4.25rem]";
  const showWordmark = size === "picker";
  const textSize = "text-xs font-semibold sm:text-sm";
  const flexDir = layout === "row" ? "flex-row items-center gap-2.5" : "flex-col items-end gap-1";

  return (
    <div className={`flex ${flexDir} ${className}`} role="img" aria-label="Mastercard">
      <svg className={`${svgBox} shrink-0`} viewBox="0 0 46 28" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="17" cy="14" r="9" fill="#EB001B" />
        <circle cx="29" cy="14" r="9" fill="#F79E1B" />
        <path
          d="M23 7.55a8.997 8.997 0 010 12.9 8.997 8.997 0 010-12.9z"
          fill="#FF5F00"
        />
      </svg>
      {showWordmark ? (
        <span className={`${textSize} leading-none tracking-tight ${textColor}`}>Mastercard</span>
      ) : null}
    </div>
  );
}

/**
 * @param {{ brand?: string, tone?: "onDark" | "onLight", size?: "wallet" | "picker", layout?: "stack" | "row", className?: string }} props
 */
export function CardNetworkBrandMark({ brand, tone = "onDark", size = "wallet", layout, className = "" }) {
  const mcLayout = layout ?? (size === "wallet" ? "stack" : "row");
  if (isVisaBrand(brand)) {
    return <VisaWordmark tone={tone} size={size} className={className} />;
  }
  return (
    <MastercardBrandMark tone={tone} size={size} layout={mcLayout} className={className} />
  );
}
