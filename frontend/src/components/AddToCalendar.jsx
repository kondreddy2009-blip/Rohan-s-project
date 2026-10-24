import { CalendarPlus } from "lucide-react";
import { downloadIcs, googleCalendarUrl } from "@/lib/calendar";

const btn =
  "inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-[#CE6A4A] hover:text-[#CE6A4A] transition-colors";

export function AddToCalendar({ booking }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="add-to-calendar">
      <a href={googleCalendarUrl(booking)} target="_blank" rel="noopener noreferrer" className={btn}>
        <CalendarPlus strokeWidth={1.6} className="h-4 w-4" />
        Google Calendar
      </a>
      <button type="button" onClick={() => downloadIcs(booking)} className={btn} data-testid="download-ics">
        <CalendarPlus strokeWidth={1.6} className="h-4 w-4" />
        Apple / Outlook (.ics)
      </button>
    </div>
  );
}
