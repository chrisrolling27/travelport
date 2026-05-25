const STYLE = {
  GET: "bg-black",
  POST: "bg-[#2575FC]",
  PATCH: "bg-[#F39C12]",
  DELETE: "bg-[#E74C3C]",
};

export default function MethodBadge({ method }) {
  return (
    <span
      className={`inline-flex min-w-14 items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold text-white ${
        STYLE[method] || "bg-slate-500"
      }`}
    >
      {method}
    </span>
  );
}

