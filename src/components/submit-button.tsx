"use client";

import { LoaderCircle } from "@/components/icons";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size,
  confirm,
  title,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
  confirm?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      title={title}
      disabled={pending}
      className={`btn btn-${variant}${size ? ` btn-${size}` : ""}`}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending && <LoaderCircle size={14} className="spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
