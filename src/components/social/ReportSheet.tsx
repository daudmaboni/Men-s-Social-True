"use client";

import { useState } from "react";
import Sheet from "@/components/motion/Sheet";
import { useToast } from "@/components/motion/Toast";
import { REPORT_REASONS } from "@/lib/social/community";
import { useCommunity } from "./useCommunity";
import { useT } from "@/lib/i18n";

/** Report a post or reply. It's hidden for him straight away and queued for moderators. */
export default function ReportSheet({
  targetId,
  type = "post",
  open,
  onClose,
  onReported,
}: {
  targetId: string;
  type?: "post" | "reply";
  open: boolean;
  onClose: () => void;
  onReported?: () => void;
}) {
  const showToast = useToast();
  const t = useT();
  const c = useCommunity();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [error, setError] = useState("");

  return (
    <Sheet open={open} onClose={onClose} title={t("Report")}>
      <p className="text-xs text-ink-soft">
        {t("Tell us what's wrong. It will be hidden for you now and sent to our moderators. The person won't know who reported it.")}
      </p>
      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={t("Reason")}>
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
            {t(r)}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-line">
          {t("Cancel")}
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            if (!reason) return setError(t("Choose a reason first."));
            setBusy(true);
            try {
              await c.report(type, targetId, reason);
            } catch (e) {
              setBusy(false);
              return setError(t((e as Error).message));
            }
            setBusy(false);
            showToast(t("Reported. Thanks for keeping the community safe."));
            setReason("");
            onClose();
            onReported?.();
          }}
          className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {t("Report")}
        </button>
      </div>
    </Sheet>
  );
}
