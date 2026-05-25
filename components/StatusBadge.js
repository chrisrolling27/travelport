const STYLE = {
  allowed: "bg-[#E8F9EF] text-[#058B3C]",
  active: "bg-[#E8F9EF] text-[#058B3C]",
  pending: "bg-[#FFF6DF] text-[#9A6B00]",
  notApplicable: "bg-[#EEF2F7] text-[#60728F]",
  rejected: "bg-[#FDECEC] text-[#C0392B]",
  inactive: "bg-[#EEF2F7] text-[#60728F]",
  suspended: "bg-[#FFF1E6] text-[#C66A00]",
  closed: "bg-[#FDECEC] text-[#C0392B]",
};

export default function StatusBadge({ status = "unknown" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        STYLE[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

