"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string | null;
  variant?: "success" | "danger" | "info";
  onClose: () => void;
};

export function AppToast({ message, variant = "success", onClose }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;

  const bg =
    variant === "success"
      ? "text-bg-success"
      : variant === "danger"
        ? "text-bg-danger"
        : "text-bg-primary";

  return (
    <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1090 }}>
      <div className={`toast show align-items-center border-0 ${bg}`} role="alert" aria-live="assertive">
        <div className="d-flex">
          <div className="toast-body">{message}</div>
          <button type="button" className="btn-close btn-close-white me-2 m-auto" aria-label="Close" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}
