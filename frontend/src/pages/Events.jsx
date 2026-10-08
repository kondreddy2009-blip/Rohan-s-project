import { useMemo, useState } from "react";
import { Section } from "@/components/Section";
import { FilterChips } from "@/components/FilterChips";
import { EventsBlock } from "@/pages/Discover";
import { PARTNER_FILTERS, isUpcoming, usePartners } from "@/lib/partnersService";

export default function Events() {
  const { data: partners = [], isLoading } = usePartners();
  const [filter, setFilter] = useState("all");
  const match = (PARTNER_FILTERS.find((f) => f.key === filter) || PARTNER_FILTERS[0]).match;

  const events = useMemo(() => {
    const now = new Date();
    return partners
      .filter(match)
      .flatMap((p) => p.events.filter((e) => isUpcoming(e, now)).map((e) => ({ event: e, partner: p })))
      .sort((a, b) => `${a.event.date}${a.event.time}`.localeCompare(`${b.event.date}${b.event.time}`));
  }, [partners, match]);

  return (
    <Section withNav data-testid="events-page">
      <div className="flex justify-end mb-6">
        <FilterChips value={filter} onChange={setFilter} />
      </div>
      {isLoading ? <div className="tbl-panel h-[220px]" aria-busy="true" /> : <EventsBlock events={events} heading="h1" />}
    </Section>
  );
}
