export default function EmptyState({ title, message }) {
  return (
    <div className="rounded-xl border border-dashed border-[#D4DDEB] bg-[#FBFCFE] p-8 text-center text-[#5C6B84]">
      <p className="text-lg font-semibold text-[#0B0B0B]">{title}</p>
      <p className="mt-2 text-sm">{message}</p>
    </div>
  );
}

