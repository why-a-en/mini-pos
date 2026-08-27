import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/icon";

const GLYPH = { "icon-sm": 15, icon: 18, "icon-lg": 22 } as const;

/** An icon-only tap target — TopBar actions, sheet close buttons.
 *
 *  A thin wrapper over Button's `icon-*` sizes rather than a second button
 *  implementation (it used to be one, with its own hover, focus ring and
 *  disabled handling that drifted from Button's). Two things justify the
 *  wrapper over calling `<Button size="icon">` directly:
 *
 *  - `label` is REQUIRED and becomes the accessible name. A control with no
 *    text is invisible to assistive tech otherwise, and a plain Button can't
 *    make that mandatory at the type level.
 *  - `href` renders a real `<Link>`. Every navigating call site had wrapped
 *    this in one, producing `<a><button></button></a>` — invalid HTML that
 *    announces two nested controls.
 *
 *  `variant` maps onto Button's: solid → the bordered chrome used for a
 *  TopBar's primary action, ghost → everything else. */
function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "icon",
  href,
  ...props
}: Omit<
  React.ComponentProps<typeof Button>,
  "variant" | "size" | "icon" | "iconAfter" | "children" | "asChild" | "full"
> & {
  icon: IconName;
  label: string;
  variant?: "ghost" | "solid";
  size?: keyof typeof GLYPH;
  href?: string;
}) {
  const glyph = <Icon name={icon} size={GLYPH[size]} />;
  const shared = {
    "data-slot": "icon-button",
    "aria-label": label,
    title: label,
    variant: variant === "solid" ? ("secondary" as const) : ("ghost" as const),
    size,
  };

  if (href) {
    return (
      <Button asChild {...shared} {...props}>
        <Link href={href} className="ds-nav-link">
          {glyph}
        </Link>
      </Button>
    );
  }

  return (
    <Button {...shared} {...props}>
      {glyph}
    </Button>
  );
}

export { IconButton };
