import type { ComponentPropsWithoutRef } from "react";

type AdminInteractiveSurfaceProps = ComponentPropsWithoutRef<"div">;

/**
 * Keeps interactive cursor behavior consistent for every admin screen and
 * anything hoisted inside it, such as confirmation modals.
 */
export function AdminInteractiveSurface({
  children,
  ...props
}: AdminInteractiveSurfaceProps) {
  return (
    <div {...props} data-admin-interactive>
      {children}
    </div>
  );
}
