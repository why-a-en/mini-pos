import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/** Product / screenshot thumbnail.
 *
 *  Built on the registry's Avatar — the primitive already solves the part
 *  that matters here: it swaps to the fallback only once the image has
 *  actually failed or is still loading, instead of flashing an empty box
 *  then popping the picture in. The square radius and the striped
 *  placeholder are ours; Avatar's default circle is for people, and this
 *  system reserves the circle for exactly that (see CustomerRow's initials). */
export function Thumb({
  src,
  alt = "",
  size = 56,
  radiusClassName = "rounded-sm",
  label,
  className,
}: {
  src?: string | null;
  alt?: string;
  size?: number;
  radiusClassName?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Avatar
      className={cn("relative shrink-0 border border-line-hairline bg-surface-sunken", radiusClassName, className)}
      style={{ width: size, height: size }}
    >
      {src ? <AvatarImage src={src} alt={alt} className="size-full object-cover" /> : null}
      <AvatarFallback
        className={cn("size-full text-text-faint", radiusClassName)}
        // The house striped placeholder — a drawn material, not an empty box.
        style={{ background: "repeating-linear-gradient(135deg, var(--surface-raised) 0 6px, var(--surface-sunken) 6px 12px)" }}
      >
        <Icon name="image" size={Math.max(14, Math.round(size * 0.28))} />
        {label ? (
          <span className="absolute inset-x-0.5 bottom-0.5 truncate text-center font-mono text-[8px] tracking-[0.08em] uppercase text-text-faint">
            {label}
          </span>
        ) : null}
      </AvatarFallback>
    </Avatar>
  );
}
