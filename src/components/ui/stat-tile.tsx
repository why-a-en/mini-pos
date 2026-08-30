import { Figure } from "@/components/ui/figure";
import { cn } from "@/lib/utils";

/** Big numeric readout. Number in the metric sans cut, label in mono micro-caps. */
export function StatTile({ value, label, className }: { value: string | number; label: string; className?: string }) {
  return (
    <div className={cn("min-w-0 flex-1 rounded-md border border-line-hairline bg-surface-card px-3.5 py-3 shadow-raised", className)}>
      <div className="font-ui text-metric-lg tracking-metric text-text-strong [font-variant-numeric:tabular-nums]">
        <Figure value={value} />
      </div>
      <div className="mt-1.5 truncate font-mono text-label tracking-label uppercase text-text-faint">{label}</div>
    </div>
  );
}
