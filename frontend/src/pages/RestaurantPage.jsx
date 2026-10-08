import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { toast } from "sonner";
import { api, formatApiError } from "@/lib/api";
import { useAuth, useIsAdmin } from "@/lib/auth-context";
import { PRICE_BANDS, isUpcoming, partnerStatus, usePartnerMutations, usePartners } from "@/lib/partnersService";
import { pointsAtVenue, useWallet } from "@/lib/member";
import { Section } from "@/components/Section";
import { RestaurantTabs } from "@/components/RestaurantTabs";
import { RestaurantCard } from "@/components/RestaurantCard";
import { StatusDot } from "@/components/StatusPill";
import { TierCard } from "@/components/TierCard";
import { EventCard } from "@/components/EventCard";
import { BookingModal } from "@/components/BookingModal";
import { ConciergeModal } from "@/components/ConciergeModal";
import { usePartnerForm } from "@/components/PartnerFormModal";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Remaining bookable slots tonight, from the existing availability endpoint. */
function useTonightSlots(venueId) {
  const [slots, setSlots] = useState(null);
  useEffect(() => {
    if (!venueId) return undefined;
    let cancelled = false;
    const now = new Date();
    const nowHm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    api
      .get(`/venues/${venueId}/availability`, { params: { date: todayIso() } })
      .then(({ data }) => {
        const open = data.slots.filter((s) => s.available && s.time > nowHm);
        if (!cancelled) setSlots(open);
      })
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [venueId]);
  return slots;
}

function RemovePartnerDialog({ partner, open, onOpenChange }) {
  const navigate = useNavigate();
  const { remove } = usePartnerMutations();
  const confirm = (e) => {
    e.preventDefault();
    remove.mutate(partner.id, {
      onSuccess: () => {
        toast.success(`${partner.name} removed from Table`);
        onOpenChange(false);
        navigate("/discover");
      },
      onError: (err) => toast.error(formatApiError(err.response?.data?.detail)),
    });
  };
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="tbl-overlay" />
        <AlertDialog.Content className="tbl-modal tbl-modal--sm p-6" data-testid="remove-partner-dialog">
          <AlertDialog.Title className="tbl-h2 text-[19px]">Remove {partner.name}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[14px] text-ritual-muted">
            It disappears from Discover, the network list and events. Past visits and points stay in
            members&apos; history.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className="tbl-pill tbl-pill--filled tbl-pill--lg">Keep</AlertDialog.Cancel>
            <AlertDialog.Action
              onClick={confirm}
              disabled={remove.isPending}
              className="tbl-pill tbl-pill--accent tbl-pill--lg"
              data-testid="confirm-remove-partner"
            >
              {remove.isPending ? "Removing…" : "Remove partner"}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export default function RestaurantPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const isAdmin = useIsAdmin();
  const { openPartnerForm } = usePartnerForm();
  const { data: partners, isLoading } = usePartners();
  const { data: wallet } = useWallet();
  const partner = partners?.find((p) => p.slug === slug);
  const slots = useTonightSlots(partner?.id);
  const [holding, setHolding] = useState(false);
  const [concierge, setConcierge] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (isLoading) {
    return (
      <Section withNav>
        <div className="tbl-panel h-[420px]" aria-busy="true" />
      </Section>
    );
  }
  if (!partner) {
    return (
      <Section withNav>
        <RestaurantTabs />
        <div className="tbl-panel p-10 text-center">
          <h1 className="tbl-h2">This partner isn&apos;t on Table.</h1>
          <p className="mt-2 text-ritual-muted">It may have been renamed or removed.</p>
          <Link to="/discover" className="mt-5 tbl-pill tbl-pill--filled tbl-pill--lg">
            Back to Discover
          </Link>
        </div>
      </Section>
    );
  }

  const status = partnerStatus(partner);
  const events = partner.events.filter((e) => isUpcoming(e));
  const here = pointsAtVenue(wallet, partner.id);
  const isMember = user && user.role !== "staff";
  const facts = [
    ["Walk-ins", partner.walk_in ? "Welcome" : "Bookings only"],
    ["Price", PRICE_BANDS.find((b) => b.value === partner.price_band)?.label],
    ["Hours", partner.hours],
    ["Address", partner.address],
  ].filter(([, v]) => v);

  return (
    <>
      <Section withNav data-testid="restaurant-page">
        <RestaurantTabs activeSlug={partner.slug} />

        {isAdmin && (
          <div className="mb-3 flex justify-end gap-2" data-testid="partner-admin-actions">
            <button type="button" onClick={() => openPartnerForm(partner)} className="tbl-pill tbl-pill--filled" data-testid="edit-partner-button">
              Edit
            </button>
            <button type="button" onClick={() => setRemoving(true)} className="tbl-pill tbl-pill--filled" data-testid="remove-partner-button">
              Remove
            </button>
          </div>
        )}

        <h1 className="sr-only">{partner.name}</h1>
        <RestaurantCard
          partner={partner}
          variant="hero"
          link={false}
          showPoints
          onHold={() => setHolding(true)}
          className="h-[400px] desk:h-[440px]"
        />

        <div className="mt-4 grid grid-cols-1 desk:grid-cols-[1.7fr_1fr] gap-4">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="tbl-panel p-6">
              <div className="tbl-eyebrow">Tonight</div>
              <div className="mt-2 flex items-center gap-2 text-[16px] font-bold">
                <StatusDot tone={status.tone} />
                {status.long}
              </div>
              {isMember && (
                <div className="mt-4">
                  <div className="text-[12px] font-semibold text-ritual-muted mb-2">Open tables</div>
                  {slots === null ? (
                    <div className="h-8" aria-busy="true" />
                  ) : slots.length ? (
                    <div className="flex flex-wrap gap-2">
                      {slots.slice(0, 6).map((s) => (
                        <button key={s.time} type="button" onClick={() => setHolding(true)} className="tbl-pill tbl-pill--filled tbl-pill--lg">
                          {s.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-ritual-muted">No tables left tonight. Try another day.</p>
                  )}
                </div>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                {facts.map(([k, v]) => (
                  <div key={k} className={k === "Address" ? "col-span-2" : undefined}>
                    <dt className="text-ritual-muted">{k}</dt>
                    <dd className="font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              {isMember && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConcierge(true)} className="tbl-pill tbl-pill--filled tbl-pill--lg">
                    Message the room
                  </button>
                  <Link to={`/checkin/${partner.id}`} className="tbl-pill tbl-pill--ghost tbl-pill--lg">
                    Check in on arrival
                  </Link>
                </div>
              )}
            </div>

            <div>
              <h2 className="tbl-h2 text-[18px]">Upcoming at {partner.name}</h2>
              {events.length ? (
                <div className="mt-3 grid grid-cols-1 desk:grid-cols-2 gap-3">
                  {events.map((e) => (
                    <EventCard key={e.id} event={e} partner={partner} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[14px] text-ritual-muted">No events on the calendar yet.</p>
              )}
            </div>
          </div>

          {isMember && (
            <div className="flex flex-col gap-4 min-w-0">
              <TierCard />
              <div className="tbl-panel p-6" data-testid="points-here">
                <div className="tbl-eyebrow">Your points here</div>
                <div className="mt-2 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
                  {here.points.toLocaleString("en-IN")}
                </div>
                <div className="mt-1 text-[13px] text-ritual-muted">
                  {here.visits} {here.visits === 1 ? "visit" : "visits"} · {partner.points_per_visit} pts per visit
                  {partner.double_points_tonight && " · 2× tonight"}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      {holding && <BookingModal venue={partner} onClose={() => setHolding(false)} />}
      {concierge && <ConciergeModal venue={partner} onClose={() => setConcierge(false)} />}
      {isAdmin && <RemovePartnerDialog partner={partner} open={removing} onOpenChange={setRemoving} />}
    </>
  );
}
