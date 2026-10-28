"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";

const item = "btn btn-ghost btn-sm w-full justify-start font-mono text-xs uppercase tracking-wider";

// The signed-in person at the foot of the navigation rail. It opens upwards to Settings and Sign out, and
// closes on Escape (returning focus to the button), on a click outside it, or when Settings is chosen.
export function AccountMenu({ name, role, onNavigate }: { name: string; role: string; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div ref={root} className="relative border-t border-base-300">
      <div
        id="account-menu"
        hidden={!open}
        className="absolute inset-x-3 bottom-full mb-2 space-y-1 border border-base-300 bg-base-100 p-2"
      >
        <Link
          href="/settings"
          className={item}
          onClick={() => {
            setOpen(false);
            onNavigate?.();
          }}
        >
          Settings
        </Link>
        <LogoutButton className={item} />
      </div>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`${name}, ${role}: account menu`}
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-base-300/30"
      >
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm">{name}</span>
          <span className="block truncate text-xs text-muted">{role}</span>
        </span>
        <span aria-hidden="true" className="font-mono text-xs text-decor">
          {open ? "▾" : "▴"}
        </span>
      </button>
    </div>
  );
}
