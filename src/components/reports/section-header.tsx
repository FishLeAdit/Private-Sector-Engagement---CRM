import type { ReactNode } from "react";
import { SysCode } from "@/components/ui/hud";

// A numbered report section heading, e.g. "01 // FIN-01" above "Monetary fundraising".
export function SectionHeader({
  id,
  index,
  code,
  title,
  children,
}: {
  id: string;
  index: string;
  code: string;
  title: string;
  children: ReactNode; // One-line description of what the section counts.
}) {
  return (
    <div className="border-b border-base-300 pb-3">
      <SysCode className="block">{`${index} // ${code}`}</SysCode>
      <h2 id={id} className="mt-1 font-mono text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}
