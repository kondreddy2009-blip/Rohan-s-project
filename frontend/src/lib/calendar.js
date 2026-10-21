// Add-to-calendar helpers for a table booking ({ venue_name, date: YYYY-MM-DD, time: HH:MM, party_size, code }).
const DURATION_MIN = 90;

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

function window_(b) {
  const [h, m] = b.time.split(":").map(Number);
  const start = new Date(`${b.date}T00:00:00`);
  // Slots between midnight and 6am belong to the previous evening's service (hours like 18:00–01:00).
  if (h < 6) start.setDate(start.getDate() + 1);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + DURATION_MIN * 60000);
  return { start, end };
}

const title = (b) => `Dinner at ${b.venue_name}`;
const details = (b) =>
  `Table reservation for ${b.party_size}. Code: ${b.code}. Show this code at the host stand.`;

export function googleCalendarUrl(b) {
  const { start, end } = window_(b);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title(b),
    dates: `${stamp(start)}/${stamp(end)}`,
    details: details(b),
    location: b.venue_name,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const esc = (s) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function downloadIcs(b) {
  const { start, end } = window_(b);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Table//Reservations//EN",
    "BEGIN:VEVENT",
    `UID:${b.id || b.code}@table`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(title(b))}`,
    `DESCRIPTION:${esc(details(b))}`,
    `LOCATION:${esc(b.venue_name)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reservation reminder",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `table-${b.code}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
