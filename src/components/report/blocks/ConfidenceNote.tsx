import type { ConfidenceNoteViewModel, RenderMedium } from "@/modules/report/report.renderer";
import { cn } from "@/lib/utils";

interface ConfidenceNoteProps {
  note: ConfidenceNoteViewModel;
  medium?: RenderMedium;
}

export function ConfidenceNote({ note, medium = "app" }: ConfidenceNoteProps) {
  if (!note.visible) return null;

  return (
    <section
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 px-5 py-4",
        medium === "print" && "print-avoid-break",
      )}
    >
      <p className="text-sm leading-7 text-amber-900">{note.message}</p>
      {note.instrumentFirst && (
        <p className="mt-2 text-xs text-amber-800">
          پیشنهاد موازی: ساخت داشبورد ساده اندازه‌گیری فروش در هفته اول.
        </p>
      )}
    </section>
  );
}
