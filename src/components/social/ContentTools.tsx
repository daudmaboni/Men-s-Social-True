"use client";

import { useEffect, useState } from "react";
import { Check, Pause, Play, RotateCcw, X } from "lucide-react";
import type { QuizQuestion } from "@/lib/content/types";
import { useT } from "@/lib/i18n";

/* ───────────── Quiz ───────────── */
export function QuizRunner({ questions, onFinish }: { questions: QuizQuestion[]; onFinish?: () => void }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const t = useT();
  const done = i >= questions.length;
  useEffect(() => {
    if (done) onFinish?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (done) {
    return (
      <div className="rounded-3xl bg-forest-deep p-6 text-center text-white">
        <p className="text-sm text-mint">{t("Your score")}</p>
        <p className="mt-1 text-4xl font-bold">
          {score} / {questions.length}
        </p>
        <p className="mt-2 text-sm text-mint">
          {t(score === questions.length ? "Excellent — you know your facts." : "Good effort. Every answer above explains why.")}
        </p>
        <button
          onClick={() => {
            setI(0);
            setPicked(null);
            setScore(0);
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-forest-deep"
        >
          <RotateCcw size={15} /> {t("Try again")}
        </button>
      </div>
    );
  }

  const q = questions[i];
  const answered = picked !== null;
  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>
          {t("Question {n} of {total}", { n: i + 1, total: questions.length })}
        </span>
        <span>{t("Score {n}", { n: score })}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mint">
        <div className="h-full rounded-full bg-forest transition-[width] duration-500" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-base font-semibold leading-snug">{q.q}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {q.options.map((o, idx) => {
          const correct = idx === q.answer;
          const chosen = picked === idx;
          return (
            <button
              key={o}
              disabled={answered}
              onClick={() => {
                setPicked(idx);
                if (correct) setScore((s) => s + 1);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold transition-colors ${
                !answered
                  ? "ring-1 ring-line active:bg-mint"
                  : correct
                    ? "bg-forest text-white"
                    : chosen
                      ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                      : "text-ink-soft ring-1 ring-line"
              }`}
            >
              {answered && correct && <Check size={15} />}
              {answered && chosen && !correct && <X size={15} />}
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="page-enter mt-4">
          <p className="text-sm">
            <span className="font-semibold">{t(picked === q.answer ? "Correct." : "Not quite.")} </span>
            {q.explain}
          </p>
          <button
            onClick={() => {
              setI((n) => n + 1);
              setPicked(null);
            }}
            className="mt-4 w-full rounded-full bg-forest py-3 text-sm font-semibold text-white"
          >
            {t(i + 1 === questions.length ? "See my score" : "Next question")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── Pelvic floor trainer ───────────── */
const HOLD = 3; // seconds squeeze, then seconds relax
const REPS = 10;
const TOTAL = REPS * HOLD * 2;

export function PelvicFloorTrainer() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // everything else is worked out from this
  const tr = useT();

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => Math.min(e + 1, TOTAL)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const finished = elapsed >= TOTAL;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);

  const rep = Math.min(Math.floor(elapsed / (HOLD * 2)) + 1, REPS);
  const inCycle = elapsed % (HOLD * 2);
  const phase = inCycle < HOLD ? "Squeeze" : "Relax";
  const left = HOLD - (inCycle % HOLD);
  const squeezing = running && phase === "Squeeze";

  return (
    <div className="rounded-3xl bg-surface p-6 text-center ring-1 ring-line">
      <div
        className={`mx-auto flex h-40 w-40 items-center justify-center rounded-full transition-all duration-[2500ms] ease-in-out ${
          squeezing ? "scale-90 bg-forest text-white" : "scale-100 bg-mint text-forest-deep"
        }`}
        aria-live="polite"
      >
        <div>
          <p className="text-lg font-bold">{tr(finished ? "Done" : running ? phase : elapsed ? "Paused" : "Ready")}</p>
          {!finished && running && <p className="text-3xl font-bold tabular-nums">{left}</p>}
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-soft">
        {finished ? tr("Great work. Once or twice a day is plenty to start.") : tr("Rep {n} of {total}", { n: rep, total: REPS })}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {finished ? (
          <button
            onClick={() => setElapsed(0)}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white"
          >
            <RotateCcw size={15} /> {tr("Again")}
          </button>
        ) : (
          <button
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-white"
          >
            {running ? <Pause size={15} /> : <Play size={15} />} {tr(running ? "Pause" : elapsed ? "Resume" : "Start")}
          </button>
        )}
      </div>
      <ul className="mt-5 space-y-1 text-left text-xs text-ink-soft">
        <li>• {tr("Squeeze as if stopping yourself passing wind. Keep breathing.")}</li>
        <li>• {tr("Don't tighten your stomach, legs or bottom.")}</li>
        <li>• {tr("Stop if you feel pain, and speak to a doctor.")}</li>
      </ul>
    </div>
  );
}

/* ───────────── Doctor check ───────────── */
const CHECKS = [
  { q: "Have erection or ejaculation problems lasted more than 3 months?", weight: 1 },
  { q: "Did the problem start suddenly?", weight: 1 },
  { q: "Do you have diabetes, high blood pressure or heart problems?", weight: 2 },
  { q: "Do you get chest pain or get short of breath easily?", weight: 3 },
  { q: "Is it causing you or your partner a lot of worry?", weight: 1 },
  { q: "Do you take regular medicines that started around the same time?", weight: 1 },
];

export function DoctorCheck() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(CHECKS.map(() => null));
  const complete = answers.every((a) => a !== null);
  const urgent = answers[3] === true;
  const score = answers.reduce((s, a, i) => s + (a ? CHECKS[i].weight : 0), 0);
  const t = useT();

  return (
    <div className="space-y-3">
      {CHECKS.map((c, i) => (
        <div key={c.q} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="text-sm font-medium">{t(c.q)}</p>
          <div className="mt-2 flex gap-2">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                aria-pressed={answers[i] === v}
                onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? v : x)))}
                className={`flex-1 rounded-full py-2 text-sm font-semibold ${
                  answers[i] === v ? "bg-forest text-white" : "ring-1 ring-line"
                }`}
              >
                {t(v ? "Yes" : "No")}
              </button>
            ))}
          </div>
        </div>
      ))}
      {complete && (
        <div
          role="status"
          className={`page-enter rounded-3xl p-5 ${urgent ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-forest-deep text-white"}`}
        >
          <p className="font-bold">
            {t(urgent ? "Please see a doctor soon" : score >= 2 ? "A check-up is a good idea" : "Keep an eye on it")}
          </p>
          <p className={`mt-1 text-sm ${urgent ? "" : "text-mint"}`}>
            {t(
              urgent
                ? "Chest pain or breathlessness should be checked by a doctor soon. If the pain is severe or sudden, go to a hospital straight away."
                : score >= 2
                  ? "Based on your answers, talking to a doctor could help find the cause and the right support. It's common and confidential."
                  : "Small changes in sleep, stress and exercise often help. If things don't improve in a few weeks, see a doctor.",
            )}
          </p>
          <p className={`mt-3 text-[0.6875rem] ${urgent ? "" : "text-mint/80"}`}>
            {t("This is a simple guide, not a diagnosis. Your answers aren't saved.")}
          </p>
        </div>
      )}
    </div>
  );
}
