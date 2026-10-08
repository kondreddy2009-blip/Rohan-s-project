import { Section } from "@/components/Section";

/**
 * Off-white page with a centred stack of dark sections.
 * Pages that compose their own sections render them directly (the first one
 * passes withNav); `single` wraps older single-column pages in one section.
 */
export function Layout({ children, single = false }) {
  return (
    <div className="tbl-page">
      <main className="tbl-stack">
        {single ? <Section withNav>{children}</Section> : children}
      </main>
    </div>
  );
}
