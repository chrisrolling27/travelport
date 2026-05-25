"use client";

export default function ConfirmDialog({
  open,
  title = "Confirm",
  description,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0B]/45 p-4">
      <div className="ca-surface w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-[#0B0B0B]">{title}</h3>
        <p className="mt-2 text-sm text-[#5C6B84]">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="ca-button-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="ca-button-dark"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

