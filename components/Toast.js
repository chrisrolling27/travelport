"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DISMISS_MS = 5000;

function normalizeToastMessage(message) {
  return String(message).replace(/^\n+|\n+$/g, "");
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const dismissTimerRef = useRef(null);

  const clearToast = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (type, message) => {
      if (!message) return;
      const normalizedMessage = normalizeToastMessage(message);
      if (!normalizedMessage) return;
      clearToast();
      setToast({ type, message: normalizedMessage });
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = null;
        setToast(null);
      }, TOAST_DISMISS_MS);
    },
    [clearToast]
  );

  const showSuccess = useCallback(
    (message) => {
      showToast("success", message);
    },
    [showToast]
  );

  const showError = useCallback(
    (message) => {
      showToast("error", message);
    },
    [showToast]
  );

  useEffect(() => () => clearToast(), [clearToast]);

  return {
    toast,
    clearToast,
    showToast,
    showSuccess,
    showError,
  };
}

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-5 right-5 z-50 min-w-[320px] max-w-[460px] rounded-xl border px-5 py-4 text-base shadow-lg ${
        toast.type === "error"
          ? "border-[#F4CACA] bg-[#FDECEC] text-[#A43232]"
          : "border-[#BFECD0] bg-[#E8F9EF] text-[#046E31]"
      }`}
    >
      <div className="space-y-1">
        {toast.message.split("\n").map((line, index) => (
          <p key={index} className="text-sm font-medium leading-5">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

