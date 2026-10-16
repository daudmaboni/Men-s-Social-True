"use client";

// Studio → Courses (Step 48): build the course men play on the Man tab.
// Edit modules and lessons, upload audio/video (one by one, or many at once matched by lesson number),
// save a draft, check it, publish. Men only ever see the published copy.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  EyeOff,
  FileUp,
  Headphones,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge, btn, Confirm, Drawer, Empty, ErrorBox, input, Loading, PageHeader, Panel, Segmented, ago, useLoad } from "@/components/admin/ui";
import { useToast } from "@/components/motion/Toast";
import type { Perm } from "@/lib/admin/perms";
import {
  discardCourseDraft,
  listStudioCourses,
  publishCourse,
  readDuration,
  saveCourseDraft,
  unpublishCourse,
  uploadLessonMedia,
  type CourseRow,
} from "@/lib/course/repo";
import { addLesson, addModule, checkCourse, type CourseIssue, fromLines, matchUpload, move, moveLesson, removeLesson, toLines, updateLesson, updateModule } from "@/lib/course/studio";
import { flatLessons, lessonMinutes, type Course, type CourseLesson, type LessonKind } from "@/lib/course/types";
import { clock } from "@/lib/course/progress";
import { WAZIMU_OUTLINE } from "@/lib/course/wazimu";

export default function CourseBuilder({ can }: { can: (p: Perm) => boolean }) {
  const { data: rows, error, loading, reload } = useLoad(listStudioCourses, []);
  const showToast = useToast();
  const [busy, setBusy] = useState(false);

  const start = async (c: Course) => {
    setBusy(true);
    try {
      await saveCourseDraft(c);
      showToast("Draft saved");
      reload();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const header = <PageHeader title="Courses" sub="Audio courses men play at the top of the Man tab. Lessons open one after another." />;
  if (error && !rows) return (<>{header}<ErrorBox error={error} onRetry={reload} /></>);
  if (loading && !rows) return (<>{header}<Loading /></>);

  // One course per id: the draft if there is one, otherwise the live copy
  const ids = [...new Set((rows ?? []).map((r) => r.course_id))];
  if (!ids.length) {
    return (
      <>
        {header}
        <Panel>
          <Empty title="No course yet" action={
            can("content.edit") ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button className={btn.primary} disabled={busy} onClick={() => start(WAZIMU_OUTLINE)}>
                  {busy && <Loader2 size={14} className="animate-spin" />} Start from the MTIE Wazimu Mkeo outline
                </button>
              </div>
            ) : null
          }>
            The outline has all 7 modules and {flatLessons(WAZIMU_OUTLINE).length} lessons ready. You then upload the audio and publish.
          </Empty>
        </Panel>
      </>
    );
  }
  const id = ids[0];
  const draft = rows!.find((r) => r.course_id === id && r.state === "draft") ?? null;
  const live = rows!.find((r) => r.course_id === id && r.state === "published") ?? null;
  return <Editor key={`${id}:${draft?.saved_at ?? ""}:${live?.published_at ?? ""}`} draft={draft} live={live} can={can} onSaved={reload} />;
}

/* ───────────── Editor ───────────── */

function Editor({ draft, live, can, onSaved }: { draft: CourseRow | null; live: CourseRow | null; can: (p: Perm) => boolean; onSaved: () => void }) {
  const showToast = useToast();
  const [course, setCourse] = useState<Course>(() => structuredClone((draft ?? live)!.data));
  const [dirty, setDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(Boolean(draft));
  const [busy, setBusy] = useState<null | "save" | "publish" | "discard" | "unpublish" | "batch">(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "publish" | "discard" | "unpublish">(null);
  const [note, setNote] = useState("");
  const [batch, setBatch] = useState<{ name: string; status: string; ok: boolean | null }[]>([]);
  const editable = can("content.edit");
  const lessons = useMemo(() => flatLessons(course), [course]);
  const issues = useMemo(() => checkCourse(course), [course]);
  const blocks = issues.filter((i) => i.level === "block");
  const visible = lessons.filter((l) => !l.hidden);
  const ready = visible.filter((l) => (l.kind === "reading" ? l.bodySw?.length || l.body?.length : l.mediaUrl)).length;
  const totalSeconds = visible.reduce((s, l) => s + (l.kind === "reading" ? 0 : l.seconds ?? 0), 0);

  const change = (next: Course) => {
    setCourse(next);
    setDirty(true);
  };

  // Don't lose unsaved work when the tab is closed
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(
    async (c: Course = course, quiet = false) => {
      setBusy((b) => b ?? "save");
      try {
        await saveCourseDraft(c);
        setDirty(false);
        setHasDraft(true);
        if (!quiet) showToast("Draft saved");
        return true;
      } catch (e) {
        showToast((e as Error).message);
        return false;
      } finally {
        setBusy((b) => (b === "save" ? null : b));
      }
    },
    [course, showToast],
  );

  const run = async (kind: "publish" | "discard" | "unpublish") => {
    setBusy(kind);
    try {
      if (kind === "publish") {
        if (dirty && !(await save(course, true))) return;
        await publishCourse(course.id, note.trim() || undefined);
        showToast("Published: men see it on the Man tab now");
      } else if (kind === "discard") {
        await discardCourseDraft(course.id);
        showToast("Changes discarded");
      } else {
        await unpublishCourse(course.id);
        showToast("Taken off the Man tab");
      }
      setConfirm(null);
      setDirty(false);
      onSaved();
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** Upload many files at once: each is matched to a lesson by the number at the start of its name. */
  const uploadMany = async (files: FileList) => {
    setBusy("batch");
    let next = course;
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const log: { name: string; status: string; ok: boolean | null }[] = list.map((f) => ({ name: f.name, status: "Waiting…", ok: null }));
    setBatch([...log]);
    for (let n = 0; n < list.length; n++) {
      const f = list[n];
      const lesson = matchUpload(f.name, flatLessons(next));
      if (!lesson) {
        log[n] = { name: f.name, status: "No lesson with this number. Start the file name with the lesson number, e.g. \"4.8.1 - …\".", ok: false };
        setBatch([...log]);
        continue;
      }
      const kind: "audio" | "video" = f.type.startsWith("video") || /\.(mp4|mov|webm)$/i.test(f.name) ? "video" : "audio";
      log[n] = { name: f.name, status: `Uploading to ${lesson.code}…`, ok: null };
      setBatch([...log]);
      try {
        const seconds = await readDuration(f);
        const url = await uploadLessonMedia(f, next.id, lesson.id, kind);
        next = updateLesson(next, lesson.id, (l) => ({ ...l, kind, mediaUrl: url, ...(seconds ? { seconds } : {}) }));
        log[n] = { name: f.name, status: `${lesson.code} · ${pickTitle(lesson)}${seconds ? ` · ${clock(seconds)}` : ""}`, ok: true };
      } catch (e) {
        log[n] = { name: f.name, status: (e as Error).message, ok: false };
      }
      setBatch([...log]);
    }
    setCourse(next);
    const okCount = log.filter((l) => l.ok).length;
    if (okCount) await save(next, true);
    showToast(`${okCount} of ${list.length} files uploaded`);
    setBusy(null);
  };

  const status = live && !hasDraft && !dirty ? <Badge tone="good">Live</Badge> : live ? <Badge tone="warn">Live · unpublished changes</Badge> : <Badge tone="info">Not published yet</Badge>;
  const editingLesson = editing ? lessons.find((l) => l.id === editing) ?? null : null;

  return (
    <>
      <PageHeader
        title="Courses"
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {status}
            {(draft ?? live) && <span>Saved {ago((draft ?? live)!.saved_at)}</span>}
            {dirty && <Badge tone="warn">Unsaved changes</Badge>}
          </span>
        }
        actions={
          editable ? (
            <>
              {hasDraft && (
                <button className={btn.ghost} disabled={!!busy} onClick={() => setConfirm("discard")}>
                  Discard changes
                </button>
              )}
              <button className={btn.ghost} disabled={!!busy || !dirty} onClick={() => save()}>
                {busy === "save" && <Loader2 size={14} className="animate-spin" />} Save draft
              </button>
              {can("content.publish") && (
                <button className={btn.primary} disabled={!!busy || blocks.length > 0 || (!hasDraft && !dirty)} onClick={() => setConfirm("publish")}>
                  Publish
                </button>
              )}
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-8">
          <Panel title="Course" sub="Shown at the top of the course page and on the Man tab card.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Title (English)">
                <input className={input} value={course.title} disabled={!editable} onChange={(e) => change({ ...course, title: e.target.value })} />
              </Field>
              <Field label="Title (Kiswahili)">
                <input className={input} value={course.titleSw ?? ""} disabled={!editable} onChange={(e) => change({ ...course, titleSw: e.target.value })} />
              </Field>
              <Field label="Summary (English)">
                <textarea rows={3} className={input} value={course.summary} disabled={!editable} onChange={(e) => change({ ...course, summary: e.target.value })} />
              </Field>
              <Field label="Summary (Kiswahili)">
                <textarea rows={3} className={input} value={course.summarySw ?? ""} disabled={!editable} onChange={(e) => change({ ...course, summarySw: e.target.value })} />
              </Field>
              <Field label="Ownership line (shown on every lesson)">
                <input className={input} value={course.credit} disabled={!editable} onChange={(e) => change({ ...course, credit: e.target.value })} />
              </Field>
              <Field label="Ownership line (Kiswahili)">
                <input className={input} value={course.creditSw ?? ""} disabled={!editable} onChange={(e) => change({ ...course, creditSw: e.target.value })} />
              </Field>
              <Field label="Listen this much to open the next lesson (%)">
                <input
                  type="number"
                  min={10}
                  max={100}
                  className={input}
                  value={course.passPercent}
                  disabled={!editable}
                  onChange={(e) => change({ ...course, passPercent: Math.min(100, Math.max(10, Number(e.target.value) || 70)) })}
                />
              </Field>
            </div>
          </Panel>

          {course.modules.map((m, mi) => (
            <Panel
              key={m.id}
              title={`Module ${mi + 1}`}
              sub={`${m.lessons.filter((l) => !l.hidden).length} lessons shown${m.lessons.some((l) => l.hidden) ? ` · ${m.lessons.filter((l) => l.hidden).length} hidden` : ""}`}
              actions={
                editable ? (
                  <div className="flex gap-1">
                    <button className={btn.small} aria-label="Move module up" disabled={mi === 0} onClick={() => change({ ...course, modules: move(course.modules, mi, -1) })}>
                      <ArrowUp size={13} />
                    </button>
                    <button className={btn.small} aria-label="Move module down" disabled={mi === course.modules.length - 1} onClick={() => change({ ...course, modules: move(course.modules, mi, 1) })}>
                      <ArrowDown size={13} />
                    </button>
                    {m.lessons.length === 0 && (
                      <button className={btn.small} aria-label="Delete module" onClick={() => change({ ...course, modules: course.modules.filter((_, i) => i !== mi) })}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ) : null
              }
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Name (English)">
                  <input className={input} value={m.title} disabled={!editable} onChange={(e) => change(updateModule(course, mi, (x) => ({ ...x, title: e.target.value })))} />
                </Field>
                <Field label="Name (Kiswahili)">
                  <input className={input} value={m.titleSw ?? ""} disabled={!editable} onChange={(e) => change(updateModule(course, mi, (x) => ({ ...x, titleSw: e.target.value })))} />
                </Field>
              </div>
              <ul className="mt-4 divide-y divide-line rounded-xl ring-1 ring-line">
                {m.lessons.map((l, li) => (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    editable={editable}
                    first={mi === 0 && li === 0}
                    last={mi === course.modules.length - 1 && li === m.lessons.length - 1}
                    onEdit={() => setEditing(l.id)}
                    onMove={(by) => change(moveLesson(course, l.id, by))}
                  />
                ))}
                {m.lessons.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-soft">No lessons in this module.</li>}
              </ul>
              {editable && (
                <button
                  className={`${btn.small} mt-3`}
                  onClick={() => {
                    const r = addLesson(course, mi);
                    change(r.course);
                    setEditing(r.lesson.id);
                  }}
                >
                  <Plus size={13} /> Add lesson
                </button>
              )}
            </Panel>
          ))}
          {editable && (
            <button className={btn.ghost} onClick={() => change(addModule(course))}>
              <Plus size={15} /> Add module
            </button>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-4">
          <Panel title="At a glance">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">Lessons shown</dt>
                <dd className="text-xl font-semibold tabular-nums">{visible.length}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Ready to play</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {ready}
                  <span className="text-sm text-ink-soft">/{visible.length}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Listening time</dt>
                <dd className="text-xl font-semibold tabular-nums">{Math.round(totalSeconds / 60)} min</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">Hidden</dt>
                <dd className="text-xl font-semibold tabular-nums">{lessons.length - visible.length}</dd>
              </div>
            </dl>
          </Panel>

          {editable && (
            <Panel title="Upload many files" sub="Choose all the audio files at once. Each file goes to the lesson whose number starts its name, e.g. “4.8.1 - Mikao mitamu.m4a”.">
              <BatchUpload disabled={!!busy} onFiles={uploadMany} />
              {busy === "batch" && (
                <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
                  <Loader2 size={13} className="animate-spin" /> Uploading… keep this page open.
                </p>
              )}
              {batch.length > 0 && (
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto text-xs">
                  {batch.map((b, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {b.ok === null ? <Loader2 size={13} className="mt-0.5 shrink-0 animate-spin text-ink-soft" /> : b.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-forest" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-700" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{b.name}</span>
                        <span className="text-ink-soft">{b.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          <Panel title="Before publishing" sub={blocks.length ? "Fix the red items to publish." : "Ready to publish."}>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-forest">
                <CheckCircle2 size={15} /> Everything looks good.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2.5 overflow-y-auto text-sm">
                {grouped(issues).map((g, n) => (
                  <li key={n} className="flex items-start gap-2">
                    <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${g.level === "block" ? "text-red-700" : "text-amber-600"}`} />
                    <span className="min-w-0">
                      {g.message}
                      {g.where.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {g.where.map((w) => (
                            <button key={w} className={btn.small} onClick={() => setEditing(lessons.find((l) => l.code === w)?.id ?? null)}>
                              {w}
                            </button>
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {live && can("content.publish") && (
            <Panel title="Live on the Man tab" sub={`Published ${ago(live.published_at)}${live.note ? ` · “${live.note}”` : ""}`}>
              <button className={btn.small} disabled={!!busy} onClick={() => setConfirm("unpublish")}>
                Take it off the Man tab
              </button>
            </Panel>
          )}
        </div>
      </div>

      <Drawer open={Boolean(editingLesson)} title={editingLesson ? `Lesson ${editingLesson.code}` : "Lesson"} onClose={() => setEditing(null)} wide>
        {editingLesson && (
          <LessonEditor
            courseId={course.id}
            lesson={editingLesson}
            editable={editable}
            onChange={(fn) => change(updateLesson(course, editingLesson.id, fn))}
            onDelete={() => {
              change(removeLesson(course, editingLesson.id));
              setEditing(null);
            }}
          />
        )}
      </Drawer>

      <Confirm
        open={confirm === "publish"}
        title="Publish the course?"
        confirmLabel="Publish"
        busy={busy === "publish"}
        onConfirm={() => run("publish")}
        onClose={() => setConfirm(null)}
      >
        <p>
          Men will see {visible.length} lessons at the top of the Man tab. Their progress is kept when you publish changes later.
          {issues.some((i) => i.level === "warn") && " There are warnings: check them first."}
        </p>
        <label className="mt-3 block text-xs">
          Note (optional)
          <input className={`${input} mt-1`} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Module 4 audio added" />
        </label>
      </Confirm>
      <Confirm open={confirm === "discard"} title="Discard unpublished changes?" confirmLabel="Discard" danger busy={busy === "discard"} onConfirm={() => run("discard")} onClose={() => setConfirm(null)}>
        {live ? "The course goes back to the live version." : "The draft is deleted. Uploaded files stay in storage."}
      </Confirm>
      <Confirm open={confirm === "unpublish"} title="Take the course off the Man tab?" confirmLabel="Take it off" danger busy={busy === "unpublish"} onConfirm={() => run("unpublish")} onClose={() => setConfirm(null)}>
        Men won&apos;t see the course card any more. Their progress is kept, and you can publish it again.
      </Confirm>
    </>
  );
}

const pickTitle = (l: CourseLesson) => l.titleSw || l.title;

/** Same problem on many lessons → one line with the lesson numbers. */
function grouped(issues: CourseIssue[]) {
  const out: { level: CourseIssue["level"]; message: string; where: string[] }[] = [];
  for (const i of issues) {
    const g = out.find((x) => x.level === i.level && x.message === i.message);
    if (g) {
      if (i.where) g.where.push(i.where);
    } else out.push({ level: i.level, message: i.message, where: i.where ? [i.where] : [] });
  }
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-ink-soft">
      {label}
      <div className="mt-1 text-ink">{children}</div>
    </label>
  );
}

function LessonRow({ lesson: l, editable, first, last, onEdit, onMove }: { lesson: CourseLesson; editable: boolean; first: boolean; last: boolean; onEdit: () => void; onMove: (by: -1 | 1) => void }) {
  const Icon = l.kind === "video" ? Video : l.kind === "reading" ? BookOpen : Headphones;
  const needs = l.kind === "reading" ? !(l.bodySw?.length || l.body?.length) : !l.mediaUrl;
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${l.hidden ? "bg-bg/60" : ""}`}>
      <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{l.code}</span>
      <Icon size={15} className="shrink-0 text-ink-soft" aria-label={l.kind} />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm font-semibold ${l.hidden ? "text-ink-soft" : ""}`}>{l.titleSw || l.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          {l.hidden ? (
            <Badge>
              <EyeOff size={10} /> Hidden
            </Badge>
          ) : needs ? (
            <Badge tone="bad">{l.kind === "reading" ? "Needs text" : `Needs ${l.kind}`}</Badge>
          ) : (
            <Badge tone="good">Ready</Badge>
          )}
          {l.kind !== "reading" && l.seconds ? <span className="text-[11px] text-ink-soft">{clock(l.seconds)}</span> : l.kind === "reading" && !needs ? <span className="text-[11px] text-ink-soft">{lessonMinutes(l)} min</span> : null}
          {(l.caution || l.cautionSw) && <Badge tone="warn">Caution box</Badge>}
        </span>
      </button>
      {editable && (
        <span className="flex shrink-0 gap-1">
          <button className={btn.small} aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp size={13} />
          </button>
          <button className={btn.small} aria-label="Move down" disabled={last} onClick={() => onMove(1)}>
            <ArrowDown size={13} />
          </button>
          <button className={btn.small} aria-label="Edit lesson" onClick={onEdit}>
            <Pencil size={13} />
          </button>
        </span>
      )}
    </li>
  );
}

function BatchUpload({ disabled, onFiles }: { disabled: boolean; onFiles: (f: FileList) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a,.mp3"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button className={`${btn.primary} w-full`} disabled={disabled} onClick={() => ref.current?.click()}>
        <FileUp size={15} /> Choose files
      </button>
    </>
  );
}

function LessonEditor({ courseId, lesson: l, editable, onChange, onDelete }: { courseId: string; lesson: CourseLesson; editable: boolean; onChange: (fn: (l: CourseLesson) => CourseLesson) => void; onDelete: () => void }) {
  const showToast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const set = <K extends keyof CourseLesson>(k: K, v: CourseLesson[K]) => onChange((x) => ({ ...x, [k]: v }));

  const upload = async (f: File) => {
    if (l.kind === "reading") return;
    setUploading(true);
    try {
      const seconds = await readDuration(f);
      const url = await uploadLessonMedia(f, courseId, l.id, l.kind);
      onChange((x) => ({ ...x, mediaUrl: url, ...(seconds ? { seconds } : {}) }));
      showToast("Uploaded. Save the draft to keep it.");
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <fieldset disabled={!editable} className="space-y-4">
      {l.staffNote && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {l.staffNote}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr]">
        <Field label="Number">
          <input className={input} value={l.code} onChange={(e) => set("code", e.target.value.replace(/[^\d.]/g, ""))} />
        </Field>
        <Field label="Type">
          <Segmented<LessonKind>
            label="Lesson type"
            value={l.kind}
            onChange={(v) => set("kind", v)}
            options={[
              { id: "audio", label: "Audio" },
              { id: "video", label: "Video" },
              { id: "reading", label: "Reading" },
            ]}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Title (Kiswahili)">
          <input className={input} value={l.titleSw ?? ""} onChange={(e) => set("titleSw", e.target.value)} />
        </Field>
        <Field label="Title (English)">
          <input className={input} value={l.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
      </div>

      {l.kind !== "reading" && (
        <div className="rounded-2xl bg-bg p-4 ring-1 ring-line">
          <p className="text-xs font-medium text-ink-soft">{l.kind === "audio" ? "Audio" : "Video"}</p>
          {l.mediaUrl ? (
            l.kind === "audio" ? (
              <audio src={l.mediaUrl} controls preload="none" className="mt-2 w-full" />
            ) : (
              <video src={l.mediaUrl} controls preload="none" playsInline className="mt-2 aspect-video w-full rounded-xl bg-black" />
            )
          ) : (
            <p className="mt-1 text-sm text-ink-soft">Nothing uploaded yet.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input ref={file} type="file" className="hidden" accept={l.kind === "audio" ? "audio/*,.m4a,.mp3" : "video/mp4,video/webm,video/quicktime"} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" className={btn.small} disabled={uploading} onClick={() => file.current?.click()}>
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {l.mediaUrl ? "Replace file" : "Upload file"}
            </button>
            {l.seconds ? <span className="text-xs text-ink-soft">Length {clock(l.seconds)}</span> : null}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">{l.kind === "audio" ? "M4A or MP3, up to 40 MB." : "MP4, up to 50 MB."} Replacing a file keeps men&apos;s progress.</p>
        </div>
      )}

      {l.kind === "reading" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Text (Kiswahili) · one paragraph per line, “## ” for a heading">
            <textarea rows={12} className={input} value={fromLines(l.bodySw)} onChange={(e) => set("bodySw", toLines(e.target.value))} />
          </Field>
          <Field label="Text (English, optional)">
            <textarea rows={12} className={input} value={fromLines(l.body)} onChange={(e) => set("body", toLines(e.target.value))} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Short description (Kiswahili, optional)">
          <textarea rows={2} className={input} value={l.summarySw ?? ""} onChange={(e) => set("summarySw", e.target.value)} />
        </Field>
        <Field label="Short description (English, optional)">
          <textarea rows={2} className={input} value={l.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
        </Field>
        <Field label="Key points (Kiswahili) · one per line">
          <textarea rows={4} className={input} value={fromLines(l.keyPointsSw)} onChange={(e) => set("keyPointsSw", toLines(e.target.value))} />
        </Field>
        <Field label="Key points (English) · one per line">
          <textarea rows={4} className={input} value={fromLines(l.keyPoints)} onChange={(e) => set("keyPoints", toLines(e.target.value))} />
        </Field>
        <Field label="Caution box (Kiswahili, optional)">
          <textarea rows={2} className={input} value={l.cautionSw ?? ""} onChange={(e) => set("cautionSw", e.target.value)} />
        </Field>
        <Field label="Caution box (English, optional)">
          <textarea rows={2} className={input} value={l.caution ?? ""} onChange={(e) => set("caution", e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Points for finishing it">
          <input type="number" min={0} max={100} className={input} value={l.points} onChange={(e) => set("points", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
        </Field>
        <label className="flex items-center gap-3 self-end rounded-xl bg-bg px-3 py-2.5 text-sm ring-1 ring-line">
          <input type="checkbox" checked={Boolean(l.hidden)} onChange={(e) => set("hidden", e.target.checked)} className="h-4 w-4 accent-[var(--forest)]" />
          Hide from men
        </label>
      </div>
      <Field label="Staff note (never shown to men)">
        <textarea rows={2} className={input} value={l.staffNote ?? ""} onChange={(e) => set("staffNote", e.target.value)} />
      </Field>

      <div className="flex justify-between border-t border-line pt-4">
        <button type="button" className={btn.small} onClick={() => setAskDelete(true)}>
          <Trash2 size={13} /> Delete lesson
        </button>
        <p className="self-center text-[11px] text-ink-soft">Changes are kept here; press Save draft to store them.</p>
      </div>
      <Confirm open={askDelete} title="Delete this lesson?" confirmLabel="Delete" danger onConfirm={onDelete} onClose={() => setAskDelete(false)}>
        Men who finished it keep their points. To keep it for later, use “Hide from men” instead.
      </Confirm>
    </fieldset>
  );
}
