import { Link, Navigate } from "react-router-dom";
import { BrandLockup } from "@/components/BrandLockup";
import { Footer } from "@/components/Footer";
import { usePageTitle } from "@/lib/usePageTitle";

const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "";
const LEGAL_NAME = process.env.REACT_APP_LEGAL_NAME || "";
const BUSINESS_ADDRESS = process.env.REACT_APP_BUSINESS_ADDRESS || "";
const SUPPORT_PHONE = process.env.REACT_APP_SUPPORT_PHONE || "";
const UPDATED = "21 October 2026";

const PAGES = {
  about: {
    title: "About Table",
    intro: "Table is a loyalty and reservations network for restaurants worth returning to.",
    sections: [
      {
        h: "What we do",
        p: [
          "Members book tables, check in when they arrive and earn points at the restaurants they love. Those points are theirs to redeem at the same restaurant, for perks the room chooses to offer.",
          "Restaurants get a simple way to fill tables, recognise their regulars and hear from guests, without handing their relationship over to a marketplace.",
        ],
      },
      {
        h: "How membership works",
        p: [
          "Every check-in counts toward your tier: Guest, Regular, Insider and Inner Circle. Your tier follows you to every restaurant on Table and unlocks richer perks. The points you spend stay with the restaurant that issued them.",
        ],
      },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    intro: "Quick answers about points, bookings and your account.",
    sections: [
      { h: "Where can I redeem my points?", p: ["Only at the restaurant where you earned them. Your wallet shows your balance at each restaurant, and the Redeem page lists the ones where you hold points."] },
      { h: "What is a tier, and how do I move up?", p: ["Your tier reflects the lifetime points you've earned across every restaurant. It rises as you dine and gives you access to higher-tier perks and events."] },
      { h: "How do I earn points?", p: ["Check in at a restaurant by scanning its code when you arrive. Some restaurants also award points for bookings."] },
      { h: "How do I book a table?", p: ["Open a restaurant, choose Reserve a table, pick a night, a time and your party size. You'll need to be signed in to confirm. Your reservations, with add-to-calendar, are under Bookings."] },
      { h: "Can I cancel a reservation?", p: ["Yes. Open Bookings and choose Release the table. Cancel at least 24 hours before and your deposit is refunded in full. If a restaurant declines your booking, you are always refunded."] },
      { h: "Who can leave a review?", p: ["Members who have checked in at, or been seated by, a restaurant. You can edit or delete your review any time."] },
      { h: "I run a restaurant. How do I join?", p: ["Use List your restaurant to create your venue and staff login. You can then set your profile, photos, loyalty rewards and booking deposit."] },
    ],
  },
  terms: {
    title: "Terms of use",
    intro: "Please read these terms before using Table. By creating an account or making a booking you agree to them.",
    sections: [
      { h: "Who we are", p: ["Table is a platform that connects members with partner restaurants for reservations and loyalty rewards. Table does not run the restaurants. The dining experience is provided by the restaurant you book."] },
      { h: "Using Table", p: ["You must be 18 or older, provide accurate information and keep your sign-in details private. You are responsible for all activity on your account."] },
      { h: "Points and perks", p: ["Table Points have no cash value and cannot be exchanged for money. Points are earned and redeemed at the restaurant that issued them, and each restaurant decides which perks it honours. Points and perks may be changed or withdrawn, and may be removed where we find misuse."] },
      { h: "Reservations", p: ["A reservation request is confirmed by the restaurant. Restaurants may decline or reschedule a request. Please arrive on time; a restaurant may release your table if you are significantly late."] },
      {
        h: "Booking deposits and payments",
        p: ["Some restaurants ask for a refundable booking deposit. Where required, it is shown before you pay and is adjusted against your bill at the restaurant."],
        list: [
          "Payments are processed by Razorpay Software Private Limited, a payment aggregator regulated by the Reserve Bank of India. We never see or store your card, UPI or bank details.",
          "All amounts are in Indian Rupees (INR) and include applicable taxes unless stated otherwise.",
          "By paying, you also agree to Razorpay's terms and privacy policy.",
        ],
      },
      {
        h: "Failed or duplicate payments",
        p: ["If a payment fails but money leaves your account, or you are charged more than once, the amount is automatically reversed by your bank or Razorpay to the original payment method, normally within 5 to 7 business days. Responsibility is shared as follows:"],
        list: [
          "Table is responsible for the booking record. If your payment succeeded but your booking was not confirmed because of a fault on our side, we will confirm the booking or refund you in full.",
          "Razorpay and your bank are responsible for processing, authorising and reversing the transaction itself, including delays in returning money for failed transactions.",
          "The restaurant is responsible for honouring a confirmed booking. If it declines or cannot honour your booking, your deposit is refunded in full.",
          "You are responsible for entering correct payment details and for any charges your bank applies to your own account.",
        ],
      },
      { h: "Cancellations and refunds", p: ["Our Cancellation and refunds policy forms part of these terms."] },
      { h: "Content you post", p: ["Reviews and photos you submit must be your own, honest and lawful. You grant Table and the relevant restaurant permission to display them on the service. We may remove content that breaks these rules."] },
      { h: "Limits of liability", p: ["To the extent permitted by law, Table is not liable for the food, service, safety or conduct of any restaurant, or for losses caused by events outside our control, including payment-network or internet outages. Nothing in these terms limits any right you have under Indian consumer law."] },
      { h: "Disputes and governing law", p: ["Please write to us first so we can try to resolve your concern. These terms are governed by the laws of India, and the courts at our registered location have jurisdiction, subject to any consumer-forum rights you have by law."] },
      { h: "Changes", p: ["We may update these terms as the service evolves. Continued use after an update means you accept the new terms."] },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro: "How Table collects, uses, shares and protects your personal information.",
    sections: [
      {
        h: "What we collect",
        p: ["We collect only what we need to run the service:"],
        list: [
          "Account details: name, email address and password (stored only as a secure hash).",
          "Activity: check-ins, points history, reservations, party size, reviews and messages you send to restaurants.",
          "Payment information: for deposits, Razorpay collects your payment details directly. We receive only an order and payment reference, the amount and the payment status. We never receive or store your card number, CVV, UPI PIN or net-banking credentials.",
          "Technical data: device and browser type, IP address and basic usage data, used for security and analytics.",
          "Restaurants also provide business and payout details.",
        ],
      },
      { h: "How we use it", p: ["To create and secure your account, confirm and manage bookings, process deposits and refunds, show your wallet and tier, let restaurants prepare for your visit, respond to your messages, prevent fraud and improve the service. We do not sell your personal information."] },
      {
        h: "Who we share it with",
        p: ["We share information only where needed:"],
        list: [
          "The restaurant you book or message sees your name, tier, party size and your activity relating to that restaurant.",
          "Razorpay processes payments and refunds on our behalf, under its own privacy policy and RBI and PCI-DSS requirements.",
          "Service providers that host our systems or help us operate the service, under confidentiality obligations.",
          "Authorities, where the law requires it or to protect against fraud and abuse.",
          "Reviews you post show your name publicly.",
        ],
      },
      { h: "Payment security", p: ["Payments are made on Razorpay's secure, PCI-DSS compliant checkout. Traffic between your device and Table is encrypted, and sign-in uses secure, httpOnly cookies. No system is perfectly secure, but we use reasonable safeguards to protect your information."] },
      { h: "Cookies", p: ["We use a secure sign-in cookie to keep you logged in. We also use analytics to understand how the service is used. You can block cookies in your browser, but you will not be able to stay signed in."] },
      { h: "How long we keep it", p: ["We keep account data while your account is active. Transaction records are kept for as long as tax, accounting and payment-regulation rules require, even after your account is deleted."] },
      { h: "Your rights and choices", p: ["You can view and update your details, edit or delete your reviews and cancel reservations. You can also ask us to access, correct or delete your personal data, or withdraw consent, by contacting us below. We will respond within a reasonable time and in line with applicable Indian law, including the Digital Personal Data Protection Act, 2023."] },
      { h: "Children", p: ["Table is not intended for anyone under 18, and we do not knowingly collect their data."] },
      { h: "Grievance officer", p: ["For privacy questions or complaints, contact us using the details on our Contact page. We aim to acknowledge complaints within 48 hours and resolve them within 30 days."] },
      { h: "Changes", p: ["We will update this page when our practices change and revise the date above."] },
    ],
  },
  refunds: {
    title: "Cancellation and refunds",
    intro: "What happens to your booking deposit if plans change, a payment fails or a restaurant cannot host you.",
    sections: [
      { h: "Booking without a deposit", p: ["Most reservations need no payment. You can release your table any time from Bookings. Please do so as early as you can so the restaurant can offer it to someone else."] },
      {
        h: "Booking deposits",
        p: ["Where a restaurant asks for a deposit, the amount is shown before you pay. It is not an extra fee. It is adjusted against your final bill when you dine."],
      },
      {
        h: "When you get a refund",
        p: [],
        list: [
          "The restaurant declines or cannot honour your booking: full refund.",
          "Your payment succeeded but the booking was not created because of a technical fault: full refund, or we confirm the booking if you prefer.",
          "You were charged more than once for the same booking: the extra amount is refunded in full.",
          "You cancel at least 24 hours before your booking time: full refund.",
        ],
      },
      { h: "When a refund may not apply", p: ["If you do not show up, or you cancel less than 24 hours before your booking time, the restaurant keeps the deposit."] },
      {
        h: "Failed payments",
        p: ["If your payment fails and money is deducted, do not pay again straight away. The amount is automatically reversed to your original payment method by Razorpay or your bank, normally within 5 to 7 business days. If it has not arrived after 7 business days, contact us with your booking code or payment reference and we will follow it up with Razorpay."],
      },
      { h: "How refunds are paid", p: ["Refunds go back to the original payment method only. Once we issue a refund, Razorpay and your bank usually take 5 to 7 business days to show it in your account. UPI and wallet refunds are often faster; card refunds can take longer depending on your bank."] },
      { h: "How to ask for a refund", p: ["Release your table from Bookings, or write to us using the details on the Contact page with your booking code (T-XXXXXX). We will review your request and reply within 2 business days."] },
    ],
  },
  pricing: {
    title: "Pricing",
    intro: "What Table costs for members and restaurants.",
    sections: [
      { h: "For members", p: ["Joining Table, booking a table, checking in and earning points are free. There are no subscription or hidden fees."] },
      { h: "Booking deposits", p: ["Some restaurants set a refundable booking deposit. The exact amount, in Indian Rupees (INR), is shown on the booking screen before you pay and is adjusted against your bill at the restaurant. Table does not add any extra charge on top of it."] },
      { h: "Taxes", p: ["Prices include applicable taxes unless stated otherwise. Food and beverage charges are set by each restaurant and billed by them at the venue."] },
      { h: "For restaurants", p: ["Listing your restaurant and managing bookings and loyalty from the staff dashboard is free. Payment-gateway charges on deposits, where applicable, are charged by Razorpay."] },
    ],
  },
  shipping: {
    title: "Shipping and delivery",
    intro: "How you receive what you book on Table.",
    sections: [
      { h: "No physical delivery", p: ["Table provides reservations and digital loyalty benefits. We do not ship physical goods, so no shipping charges or courier timelines apply."] },
      { h: "Instant confirmation", p: ["Once a booking is made, your booking code (T-XXXXXX) appears under Bookings straight away, and the restaurant confirms your table. If a booking has not been confirmed within a reasonable time, contact us. Points are credited to your wallet after check-in or seating."] },
    ],
  },
  contact: {
    title: "Contact",
    intro: "We're here to help. Write to us for bookings, payments, refunds or privacy requests.",
    sections: [
      { h: "Members", p: ["For anything about a booking or a restaurant, use Speak with the room on the restaurant's page. It goes straight to the venue's team."] },
      { h: "Payments and refunds", p: ["For a failed payment, a duplicate charge or a refund, email us with your booking code or payment reference. We reply within 2 business days."] },
      { h: "Restaurants", p: ["Manage your bookings, correspondence and payouts from your staff dashboard."] },
    ],
  },
};

export default function Info({ slug }) {
  const page = PAGES[slug];
  usePageTitle(page?.title);
  if (!page) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#0B0A0A] text-[#F2EDE7] flex flex-col" data-testid={`info-${slug}`}>
      <header className="mx-auto w-full max-w-3xl px-5 py-4">
        <Link to="/" aria-label="Table home"><BrandLockup /></Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16 pt-6">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-[-0.03em]">{page.title}</h1>
        <p className="mt-3 text-lg text-[#B8B2AA]">{page.intro}</p>
        {["terms", "privacy", "refunds"].includes(slug) && (
          <p className="mt-2 text-sm text-[#8F8781]">Last updated {UPDATED}</p>
        )}
        <div className="mt-10 space-y-8">
          {page.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-xl font-extrabold tracking-tight">{s.h}</h2>
              {s.p.map((t) => (
                <p key={t} className="mt-2 leading-relaxed text-[#B8B2AA]">{t}</p>
              ))}
              {s.list && (
                <ul className="mt-3 space-y-2.5">
                  {s.list.map((t) => (
                    <li key={t} className="flex gap-3 leading-relaxed text-[#B8B2AA]">
                      <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EE9B79]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {slug === "contact" && (LEGAL_NAME || BUSINESS_ADDRESS || SUPPORT_PHONE || SUPPORT_EMAIL) && (
            <section data-testid="contact-details" className="rounded-2xl border border-white/[0.08] bg-[#1C1B19] p-6">
              <h2 className="text-xl font-extrabold tracking-tight">Business details</h2>
              <dl className="mt-4 space-y-3 text-[#B8B2AA]">
                {LEGAL_NAME && <div><dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8F8781]">Registered name</dt><dd className="mt-1">{LEGAL_NAME}</dd></div>}
                {BUSINESS_ADDRESS && <div><dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8F8781]">Address</dt><dd className="mt-1">{BUSINESS_ADDRESS}</dd></div>}
                {SUPPORT_PHONE && <div><dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8F8781]">Phone</dt><dd className="mt-1"><a href={`tel:${SUPPORT_PHONE}`} className="hover:text-white">{SUPPORT_PHONE}</a></dd></div>}
                {SUPPORT_EMAIL && <div><dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#8F8781]">Email</dt><dd className="mt-1"><a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold text-[#EE9B79] hover:text-[#CE6A4A]">{SUPPORT_EMAIL}</a></dd></div>}
              </dl>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
