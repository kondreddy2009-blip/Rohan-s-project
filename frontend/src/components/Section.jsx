import { NavBar } from "@/components/NavBar";
import { cn } from "@/lib/utils";

/** One dark rounded container in the page stack. The first one on a page carries the nav. */
export function Section({ withNav = false, className, children, ...props }) {
  return (
    <section className={cn("tbl-section", className)} {...props}>
      {withNav && <NavBar />}
      {children}
    </section>
  );
}
