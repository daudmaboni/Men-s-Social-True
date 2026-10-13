"use client";

import { useState } from "react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { REPORT_REASONS } from "@/lib/social/community";
import { socialStore } from "@/lib/social/store";

/** Report a post or reply. It's hidden for him straight away and queued for moderators. */
export default function ReportSheet({
  targetId,
  open,
  onClose,
  onReported,
}: {
  targetId: string;
  open: boolean;
  onClose: () => void;
  onReported?: () => void;
}) {
  const showToast = useToast();
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState("");

  return (
    <Sheet open={open} onClose={onClose} title="Report">
      <p className="text-xs text-ink-soft">
        Tell us what&apos;s wrong. It will be hidden for you now and sent to our moderators. The person won&apos;t know who
        reported it.
      </p>
      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={reason === r}
            onClick={() => {
              setReason(r);
              setError("");
            }}
            className={`w-full rounded-2xl px-4 py-2.5 text-left text-sm ${
              reason === r ? "bg-forest text-white" : "ring-1 ring-line"
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
          Cancel
        </button>
        <button
          onClick={() => {
            if (!reason) return setError("Choose a reason first.");
            socialStore.report(targetId, reason);
            showToast("Reported. Thanks for keeping the community safe.");
            setReason("");
            onClose();
            onReported?.();
          }}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Report
        </button>
      </div>
    </Sheet>
  );
}
