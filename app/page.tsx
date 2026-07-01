"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Task = {
  id: number;
  label: string;

  mode: "habit" | "progress";

  progressValue: number;

  note?: string;
};
type Goal = {
  id: number; title: string; description: string; target: number; current: number;
  unit: string; category: string; priority: string; dueDate: string; createdAt: string; tasks: Task[];
};
type History = Record<string, Record<string, boolean>>;
type StreakData = { count: number; lastDate: string | null };
type Streaks = Record<string, StreakData>;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Health", "Career", "Learning", "Finance", "Personal", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];

const CAT_COLOR: Record<string, string> = {
  Health: "#818cf8", Career: "#38bdf8", Learning: "#c084fc",
  Finance: "#34d399", Personal: "#fb7185", Other: "#94a3b8",
};
const PRIORITY_DOT: Record<string, string> = { High: "#f87171", Medium: "#fbbf24", Low: "#34d399" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["S","M","T","W","T","F","S"];

function todayKey() { return new Date().toISOString().slice(0, 10); }
function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// ─── SVG Primitives ───────────────────────────────────────────────────────────
function Ring({ pct, size = 56, stroke = 5, color = "#f59e0b", children }: {
  pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const offset = circ - Math.min(pct, 100) / 100 * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
      <path d="M1 4.5L4 7.5L10 1" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title?: string; children?: React.ReactNode; wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#0f172a",
        borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: wide ? 480 : 440,
        maxHeight: "90dvh", display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 40px rgba(0,0,0,0.5)",
        border: "1px solid #1e293b", borderBottom: "none",
      }} onClick={e => e.stopPropagation()}>
        {/* drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 6px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "#334155" }} />
        </div>
        {title && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "4px 24px 16px", borderBottom: "1px solid #1e293b" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9" }}>{title}</span>
            <button onClick={onClose} style={{ background: "#1e293b", border: "none", color: "#94a3b8",
              borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "20px 24px 32px", flex: 1,
          paddingBottom: "calc(32px + env(safe-area-inset-bottom,0px))" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Shared form styles ───────────────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: "100%", background: "#080c14", border: "1px solid #1e293b", borderRadius: 10,
  padding: "12px 14px", color: "#f1f5f9", fontSize: 15, outline: "none", marginBottom: 12,
  boxSizing: "border-box", WebkitAppearance: "none",
};
const sel: React.CSSProperties = { ...inp, appearance: "none" as const };
const lbl: React.CSSProperties = {
  fontSize: 11, color: "#64748b", display: "block",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5, fontWeight: 600,
};
const primaryBtn: React.CSSProperties = {
  background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 10,
  padding: "14px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer", flex: 1,
  WebkitTapHighlightColor: "transparent",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "#64748b", border: "1px solid #1e293b",
  borderRadius: 10, padding: "13px 20px", fontSize: 15, cursor: "pointer", flex: 1,
  WebkitTapHighlightColor: "transparent",
};

// ─── Goal Form ────────────────────────────────────────────────────────────────
interface GoalFormProps {
  gForm: { title: string; description: string; target: string; unit: string; category: string; priority: string; dueDate: string };
  setGForm: React.Dispatch<React.SetStateAction<GoalFormProps["gForm"]>>;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
}
function GoalForm({ gForm, setGForm, onSubmit, onCancel, submitLabel = "Create Goal" }: GoalFormProps) {
  return (
    <>
      <label style={lbl}>Goal title</label>
      <input style={inp} placeholder="e.g. Run a 5K" value={gForm.title}
        onChange={e => setGForm(f => ({ ...f, title: e.target.value }))} />

      <label style={lbl}>Why it matters</label>
      <textarea style={{ ...inp, resize: "none", height: 72 }} placeholder="Your motivation (optional)…"
        value={gForm.description} onChange={e => setGForm(f => ({ ...f, description: e.target.value }))} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Target</label>
          <input style={inp} type="number" inputMode="numeric" placeholder="100" value={gForm.target}
            onChange={e => setGForm(f => ({ ...f, target: e.target.value }))} />
        </div>
        <div>
          <label style={lbl}>Unit</label>
          <input style={inp} placeholder="km, pages…" value={gForm.unit}
            onChange={e => setGForm(f => ({ ...f, unit: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Category</label>
          <select style={sel} value={gForm.category} onChange={e => setGForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Priority</label>
          <select style={sel} value={gForm.priority} onChange={e => setGForm(f => ({ ...f, priority: e.target.value }))}>
            {PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <label style={lbl}>Due date</label>
      <input style={{ ...inp, colorScheme: "dark" } as React.CSSProperties}
        type="date" value={gForm.dueDate}
        onChange={e => setGForm(f => ({ ...f, dueDate: e.target.value }))} />

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button style={primaryBtn} onClick={onSubmit}>{submitLabel}</button>
        <button style={ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────
interface TaskFormProps {
  goalTitle: string; goalUnit: string;
  tForm: { label: string; mode: "habit" | "progress"; progressValue: string; note: string };
  setTForm: React.Dispatch<React.SetStateAction<TaskFormProps["tForm"]>>;
  onSubmit: () => void; onCancel: () => void;
  submitLabel?: string;
}
function TaskForm({ goalTitle, goalUnit, tForm, setTForm, onSubmit, onCancel, submitLabel = "Add Task" }: TaskFormProps) {
  return (
    <>
      <p style={{ fontSize: 13, color: "#475569", marginTop: 0, marginBottom: 16 }}>
        For: <strong style={{ color: "#94a3b8" }}>{goalTitle}</strong>
      </p>
      <label style={lbl}>Task name</label>
      <input style={inp} placeholder="e.g. Run 20 minutes" value={tForm.label}
        onChange={e => setTForm(f => ({ ...f, label: e.target.value }))}
        onKeyDown={e => e.key === "Enter" && onSubmit()} autoFocus />

      <label style={lbl}>Task type</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setTForm(f => ({ ...f, mode: "habit" }))}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
            border: `1px solid ${tForm.mode === "habit" ? "#f59e0b" : "#1e293b"}`,
            background: tForm.mode === "habit" ? "#f59e0b22" : "#080c14",
            color: tForm.mode === "habit" ? "#f59e0b" : "#64748b",
          }}>
          Habit
        </button>
        <button
          type="button"
          onClick={() => setTForm(f => ({ ...f, mode: "progress" }))}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", WebkitTapHighlightColor: "transparent",
            border: `1px solid ${tForm.mode === "progress" ? "#f59e0b" : "#1e293b"}`,
            background: tForm.mode === "progress" ? "#f59e0b22" : "#080c14",
            color: tForm.mode === "progress" ? "#f59e0b" : "#64748b",
          }}>
          Adds progress
        </button>
      </div>
      <p style={{ fontSize: 11, color: "#334155", marginTop: -6, marginBottom: 12 }}>
        {tForm.mode === "habit"
          ? "Just tracks a daily checkbox and streak."
          : "Completing this task also adds to the goal's progress total."}
      </p>

      {tForm.mode === "progress" && (
        <>
          <label style={lbl}>Progress per completion ({goalUnit || "pts"})</label>
          <input style={inp} type="number" inputMode="decimal" placeholder="1" value={tForm.progressValue}
            onChange={e => setTForm(f => ({ ...f, progressValue: e.target.value }))} />
        </>
      )}

      <label style={lbl}>Note (optional)</label>
      <input style={inp} placeholder="e.g. Outdoors only" value={tForm.note}
        onChange={e => setTForm(f => ({ ...f, note: e.target.value }))} />

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button style={primaryBtn} onClick={onSubmit}>{submitLabel}</button>
        <button style={ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color, width = 200, height = 28 }: {
  values: number[]; color: string; width?: number; height?: number;
}) {
  const max = Math.max(...values, 1);
  const n = values.length;
  const barW = Math.max(2, Math.floor((width - (n - 1) * 2) / n));
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {values.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * height));
        return <rect key={i} x={i * (barW + 2)} y={height - bh} width={barW} height={bh}
          fill={v > 0 ? color : "#1e293b"} rx={2} opacity={v > 0 ? 0.85 : 1} />;
      })}
    </svg>
  );
}

// ─── Progress stepper (replaces raw +/- ) ────────────────────────────────────
function Stepper({ value, max, unit, onChange }: {
  value: number; max: number; unit: string; onChange: (d: number) => void;
}) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  const clr = pct >= 100 ? "#34d399" : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#080c14",
      border: "1px solid #1e293b", borderRadius: 12, padding: "12px 16px" }}>
      <button onClick={() => onChange(-1)} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #1e293b",
        background: "#0f172a", color: "#94a3b8", fontSize: 20, cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: clr }}>{value} <span style={{ color: "#475569", fontWeight: 400 }}>/ {max} {unit}</span></div>
        <div style={{ height: 4, background: "#1e293b", borderRadius: 2, marginTop: 8 }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: clr, borderRadius: 2,
            transition: "width 500ms cubic-bezier(0.22,1,0.36,1)" }} />
        </div>
      </div>
      <button onClick={() => onChange(1)} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #1e293b",
        background: "#0f172a", color: "#94a3b8", fontSize: 20, cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function GoalSet() {
  const isMobile = useIsMobile();

  const [tab, setTab] = useState("today");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Streaks>({});
  const [history, setHistory] = useState<History>({});
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState<number | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editGoalId, setEditGoalId] = useState<number | null>(null);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [gForm, setGForm] = useState({
    title: "", description: "", target: "", unit: "",
    category: "Personal", priority: "Medium", dueDate: "",
  });
  const [tForm, setTForm] = useState<{ label: string; mode: "habit" | "progress"; progressValue: string; note: string }>({
    label: "",
    mode: "habit",
    progressValue: "1",
    note: "",
  });

  // ── Load from localStorage on mount ─────────────────────────────────────────
  useEffect(() => {
    try {
      const g = localStorage.getItem("gs-goals");
      const s = localStorage.getItem("gs-streaks");
      const h = localStorage.getItem("gs-history");
      const c = localStorage.getItem("gs-completed");

      if (g) setGoals(JSON.parse(g));
      if (s) setStreaks(JSON.parse(s));
      if (h) setHistory(JSON.parse(h));

      if (c) {
        const p = JSON.parse(c);
        if (p.date === todayKey()) setCompletedToday(p.tasks || {});
      }
    } catch (e) {
      console.log("load error", e);
    } finally {
      // Only start persisting AFTER the initial load has been applied,
      // so we never clobber saved data with the pre-load empty defaults.
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("gs-goals", JSON.stringify(goals));
    } catch {}
  }, [goals, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("gs-streaks", JSON.stringify(streaks));
    } catch {}
  }, [streaks, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("gs-history", JSON.stringify(history));
    } catch {}
  }, [history, hydrated]);

  // Persist today's checkmarks — this was previously never written at all,
  // so completed tasks reset every time the app reloaded.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("gs-completed", JSON.stringify({ date: todayKey(), tasks: completedToday }));
    } catch {}
  }, [completedToday, hydrated]);

  // Reset completedToday when the calendar day rolls over.
  // Previously this read back from localStorage, but since gs-completed was
  // never written, it reset the in-memory checklist to {} every 60 seconds.
  const lastDayRef = useRef(todayKey());
  useEffect(() => {
    const interval = setInterval(() => {
      const today = todayKey();
      if (lastDayRef.current !== today) {
        lastDayRef.current = today;
        setCompletedToday({});
      }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────────
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  // ── Goal CRUD ──────────────────────────────────────────────────────────────
  const emptyGForm = { title: "", description: "", target: "", unit: "", category: "Personal", priority: "Medium", dueDate: "" };

  function openNewGoal() {
    setGForm(emptyGForm);
    setEditGoalId(null);
    setShowGoalModal(true);
  }

  function openEditGoal(g: Goal) {
    setGForm({
      title: g.title, description: g.description, target: g.target ? String(g.target) : "",
      unit: g.unit, category: g.category, priority: g.priority, dueDate: g.dueDate,
    });
    setEditGoalId(g.id);
    setShowGoalModal(true);
  }

  function closeGoalModal() {
    setShowGoalModal(false);
    setEditGoalId(null);
  }

  function saveGoal() {
    if (!gForm.title.trim()) return;
    if (editGoalId !== null) {
      setGoals(prev => prev.map(g => g.id === editGoalId
        ? { ...g, ...gForm, target: Number(gForm.target) || 0 }
        : g));
      showToast("Goal updated ✓");
    } else {
      setGoals(prev => [{ id: Date.now(), ...gForm, target: Number(gForm.target) || 0,
        current: 0, tasks: [], createdAt: new Date().toISOString() }, ...prev]);
      showToast("Goal created ✓");
    }
    setGForm(emptyGForm);
    setEditGoalId(null);
    setShowGoalModal(false);
  }

  function deleteGoal(id: number) {
    const goal = goals.find(g => g.id === id);
    setGoals(prev => prev.filter(g => g.id !== id));
    setExpandedGoal(null);
    setConfirmDelete(null);

    // Clean up any streak/history/completed entries tied to this goal's tasks
    // so they don't linger as orphaned data.
    if (goal) {
      const taskKeys = goal.tasks.map(t => `${id}-${t.id}`);
      if (taskKeys.length) {
        setStreaks(prev => {
          const next = { ...prev };
          taskKeys.forEach(k => delete next[k]);
          return next;
        });
        setCompletedToday(prev => {
          const next = { ...prev };
          taskKeys.forEach(k => delete next[k]);
          return next;
        });
        setHistory(prev => {
          const next: History = {};
          for (const [day, entries] of Object.entries(prev)) {
            const filtered = { ...entries };
            taskKeys.forEach(k => delete filtered[k]);
            next[day] = filtered;
          }
          return next;
        });
      }
    }

    showToast("Goal deleted");
  }

  function updateGoalProgress(id: number, delta: number) {
    setGoals(prev => prev.map(g => g.id === id
      ? { ...g, current: Math.max(0, Math.min(g.target, g.current + delta)) } : g));
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  const emptyTForm: { label: string; mode: "habit" | "progress"; progressValue: string; note: string } =
    { label: "", mode: "habit", progressValue: "1", note: "" };

  function openNewTask(goalId: number) {
    setTForm(emptyTForm);
    setEditTaskId(null);
    setShowTaskModal(goalId);
  }

  function openEditTask(goalId: number, task: Task) {
    setTForm({
      label: task.label, mode: task.mode,
      progressValue: task.progressValue ? String(task.progressValue) : "1",
      note: task.note || "",
    });
    setEditTaskId(task.id);
    setShowTaskModal(goalId);
  }

  function closeTaskModal() {
    setShowTaskModal(null);
    setEditTaskId(null);
  }

  function saveTask(goalId: number) {
    if (!tForm.label.trim()) return;
    const progressValue = tForm.mode === "habit" ? 0 : Number(tForm.progressValue) || 1;
    if (editTaskId !== null) {
      setGoals(prev => prev.map(g => g.id === goalId
        ? { ...g, tasks: g.tasks.map(t => t.id === editTaskId
            ? { ...t, label: tForm.label, mode: tForm.mode, progressValue, note: tForm.note }
            : t) }
        : g));
      showToast("Task updated ✓");
    } else {
      const t: Task = { id: Date.now(), label: tForm.label, mode: tForm.mode, progressValue, note: tForm.note };
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: [...g.tasks, t] } : g));
      showToast("Task added ✓");
    }
    setTForm(emptyTForm);
    setEditTaskId(null);
    setShowTaskModal(null);
  }

  function deleteTask(goalId: number, taskId: number) {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g));
    const key = `${goalId}-${taskId}`;
    setStreaks(prev => { const next = { ...prev }; delete next[key]; return next; });
    setCompletedToday(prev => { const next = { ...prev }; delete next[key]; return next; });
    setHistory(prev => {
      const next: History = {};
      for (const [day, entries] of Object.entries(prev)) {
        const filtered = { ...entries };
        delete filtered[key];
        next[day] = filtered;
      }
      return next;
    });
  }

  // ── Toggle task ────────────────────────────────────────────────────────────
  function toggleTask(goalId: number, task: Task) {
    const key = `${goalId}-${task.id}`;
    const wasDone = !!completedToday[key];
    const today = todayKey();

    setCompletedToday(prev => ({ ...prev, [key]: !wasDone }));

    // Record completion in `history` too — this was never written before,
    // so the calendar tab and per-goal sparklines had no data to show.
    setHistory(prev => ({
      ...prev,
      [today]: { ...(prev[today] || {}), [key]: !wasDone },
    }));

    if (task.mode === "progress") {
      updateGoalProgress(
        goalId,
        wasDone
          ? -task.progressValue
          : task.progressValue
      );
    }
    if (!wasDone) {
      if (navigator.vibrate) navigator.vibrate(15);
      const ex = streaks[key] || { count: 0, lastDate: null };
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yKey = yest.toISOString().slice(0, 10);
      const newCount = ex.lastDate === yKey ? ex.count + 1 : 1;
      setStreaks(prev => ({ ...prev, [key]: { count: newCount, lastDate: today } }));
      if (newCount > 1) showToast(`🔥 ${newCount}-day streak!`); else showToast("Done ✓");
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const allTasks = goals.flatMap(g => g.tasks.map(t => ({ ...t, goalId: g.id, goalTitle: g.title, goalColor: CAT_COLOR[g.category] || "#f59e0b" })));
  const todayDoneCount = allTasks.filter(t => completedToday[`${t.goalId}-${t.id}`]).length;
  const todayTotal = allTasks.length;
  const todayPct = todayTotal === 0 ? 0 : Math.round(todayDoneCount / todayTotal * 100);
  const bestStreak = Object.values(streaks).reduce<number>((m, s) => Math.max(m, s?.count ?? 0), 0);

  // ── Calendar ───────────────────────────────────────────────────────────────
  function getDayCompletion(dk: string): number | null {
    const d = history[dk]; if (!d) return null;
    const keys = Object.keys(d); if (!keys.length) return null;
    return keys.filter(k => d[k]).length / keys.length;
  }
  function getDayColor(pct: number | null): string {
    if (pct === null) return "transparent";
    if (pct === 0) return "#1e293b";
    if (pct < 0.5) return "#92400e";
    if (pct < 1) return "#d97706";
    return "#34d399";
  }
  function getGoalSparkline(goal: Goal): number[] {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i));
      const dk = d.toISOString().slice(0, 10);
      const dd = history[dk] || {};
      return goal.tasks.reduce((acc, t) => acc + (dd[`${goal.id}-${t.id}`] ? t.progressValue : 0), 0);
    });
  }

  // ── Backup & Restore ───────────────────────────────────────────────────────
  function exportData() {
    try {
      const payload = { exportedAt: new Date().toISOString(), goals, streaks, history };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goalset-backup-${todayKey()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Backup downloaded ✓");
    } catch {
      showToast("Export failed");
    }
  }

  function triggerImport() {
    importInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || !Array.isArray(data.goals)) throw new Error("bad format");
        const ok = window.confirm(
          "This will replace your current goals, streaks, and history with the backup file. Continue?"
        );
        if (!ok) return;
        setGoals(data.goals || []);
        setStreaks(data.streaks || {});
        setHistory(data.history || {});
        showToast("Backup restored ✓");
      } catch {
        showToast("Couldn't read that file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const taskModalGoal = goals.find(g => g.id === showTaskModal);
  const BOTTOM_BAR = 64;

  // ─── NAV ITEMS ─────────────────────────────────────────────────────────────
  const NAV = [
    { id: "today", label: "Today", icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8"/>
        <path d="M12 7v5l3 3" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    )},
    { id: "goals", label: "Goals", icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" fill={active ? "#f59e0b" : "#475569"}/>
        <circle cx="12" cy="12" r="7" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="11" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8" strokeDasharray="3 2"/>
      </svg>
    )},
    { id: "calendar", label: "Progress", icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="17" rx="3" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8"/>
        <path d="M8 2v3M16 2v3M3 9h18" stroke={active ? "#f59e0b" : "#475569"} strokeWidth="1.8" strokeLinecap="round"/>
        <rect x="7" y="13" width="3" height="3" rx="1" fill={active ? "#f59e0b" : "#475569"}/>
        <rect x="14" y="13" width="3" height="3" rx="1" fill={active ? "#f59e0b" : "#475569"}/>
      </svg>
    )},
  ];

  // ────────────────────────────────────────────────────────────────────────────
  // TODAY TAB
  // ────────────────────────────────────────────────────────────────────────────
  function TodayTab() {
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const allDone = todayPct === 100 && todayTotal > 0;
    const ringColor = allDone ? "#34d399" : todayPct > 0 ? "#f59e0b" : "#334155";
    const byGoal = goals.filter(g => g.tasks.length > 0).map(g => ({
      ...g, tasks: g.tasks.map(t => ({ ...t, done: !!completedToday[`${g.id}-${t.id}`] })),
    }));
    const noTaskGoals = goals.filter(g => g.tasks.length === 0);

    return (
      <>
        {/* Hero summary */}
        <div style={{ background: "linear-gradient(135deg, #0c1523 0%, #0f1e33 100%)",
          border: "1px solid #1e293b", borderRadius: 18, padding: "22px 22px 20px",
          marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
          <Ring pct={todayPct} size={68} stroke={6} color={ringColor}>
            <span style={{ fontSize: 13, fontWeight: 800, color: ringColor }}>{todayPct}%</span>
          </Ring>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 3, letterSpacing: "0.05em" }}>{dateStr}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2 }}>
              {todayTotal === 0 ? "Nothing planned yet" : allDone ? "Perfect day 🎉" : `${todayDoneCount} of ${todayTotal} done`}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              {todayTotal === 0 ? "Add tasks to your goals to start tracking." : allDone ? "You've completed everything today." : "Keep going, you're making progress."}
            </div>
          </div>
        </div>

        {byGoal.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#334155" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 8 }}>No daily tasks yet</div>
            <div style={{ fontSize: 13, color: "#334155", marginBottom: 20 }}>Create a goal and add tasks to start your daily streak.</div>
            <button onClick={() => { setTab("goals"); openNewGoal(); }}
              style={{ ...primaryBtn, flex: "none", padding: "12px 24px", borderRadius: 10 }}>
              Create a Goal
            </button>
          </div>
        )}

        {byGoal.map(g => {
          const color = CAT_COLOR[g.category] || "#f59e0b";
          const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
          const goalDone = g.tasks.filter(t => t.done).length;
          return (
            <div key={g.id} style={{ marginBottom: 24 }}>
              {/* Goal header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", flex: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                <span style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                  {goalDone}/{g.tasks.length} · {pct}%
                </span>
              </div>
              {/* Task rows */}
              {g.tasks.map(t => {
                const key = `${g.id}-${t.id}`;
                const str = streaks[key];
                return (
                  <button key={t.id}
                    onClick={() => toggleTask(g.id, t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, width: "100%",
                      background: t.done ? "#0a1628" : "#0f172a",
                      border: `1px solid ${t.done ? "#162032" : "#1e293b"}`,
                      borderRadius: 13, padding: "14px 16px", marginBottom: 8,
                      cursor: "pointer", textAlign: "left",
                      opacity: t.done ? 0.6 : 1,
                      transition: "opacity 200ms, background 200ms",
                      WebkitTapHighlightColor: "transparent",
                    }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${t.done ? color : "#334155"}`,
                      background: t.done ? color : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 180ms",
                    }}>
                      {t.done && <CheckIcon />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 500,
                        color: t.done ? "#475569" : "#e2e8f0",
                        textDecoration: t.done ? "line-through" : "none" }}>{t.label}</div>
                      {t.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{t.note}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                      {str && str.count > 1 && (
                        <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>🔥{str.count}</span>
                      )}
                      {t.mode === "progress" && (
                        <span style={{ fontSize: 11, color: "#334155" }}>+{t.progressValue}{g.unit ? ` ${g.unit}` : ""}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}

        {noTaskGoals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 10 }}>Goals without tasks</div>
            {noTaskGoals.map(g => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, marginBottom: 8, opacity: 0.55 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLOR[g.category] || "#f59e0b" }} />
                <span style={{ flex: 1, fontSize: 14, color: "#64748b" }}>{g.title}</span>
                <button onClick={() => { setTab("goals"); setExpandedGoal(g.id); }}
                  style={{ background: "transparent", border: "1px solid #1e293b", color: "#64748b",
                    borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                  Add tasks →
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // GOALS TAB
  // ────────────────────────────────────────────────────────────────────────────
  function GoalsTab() {
    return (
      <>
        {goals.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#475569", marginBottom: 8 }}>No goals yet</div>
            <div style={{ fontSize: 13, color: "#334155", marginBottom: 24 }}>Goals you create will appear here with progress tracking.</div>
            <button onClick={openNewGoal}
              style={{ ...primaryBtn, flex: "none", padding: "12px 28px" }}>+ New Goal</button>
          </div>
        )}

        {goals.map(g => {
          const exp = expandedGoal === g.id;
          const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
          const color = CAT_COLOR[g.category] || "#f59e0b";
          const days = daysUntil(g.dueDate);
          const doneToday = g.tasks.filter(t => completedToday[`${g.id}-${t.id}`]).length;

          return (
            <div key={g.id} style={{ background: "#0f172a",
              border: `1px solid ${exp ? "#f59e0b33" : "#1e293b"}`,
              borderRadius: 16, marginBottom: 12, overflow: "hidden",
              transition: "border-color 200ms" }}>

              {/* Card header — always visible */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
                cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                onClick={() => setExpandedGoal(exp ? null : g.id)}>
                <Ring pct={pct} size={50} stroke={5} color={pct >= 100 ? "#34d399" : color}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: pct >= 100 ? "#34d399" : color }}>{pct}%</span>
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                      background: color + "22", color }}>{g.category}</span>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: PRIORITY_DOT[g.priority] }} />
                    {pct >= 100 && g.target > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                        background: "#34d39922", color: "#34d399" }}>✓ Complete</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>{g.current}/{g.target} {g.unit}</span>
                    {g.tasks.length > 0 && <span>· {doneToday}/{g.tasks.length} today</span>}
                    {days !== null && (
                      <span style={{ color: days < 0 ? "#f87171" : days <= 7 ? "#fbbf24" : "#475569" }}>
                        · {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                  style={{ transition: "transform 200ms", transform: exp ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                  <path d="M4 7l5 5 5-5" stroke="#475569" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>

              {/* Expanded content */}
              {exp && (
                <div style={{ borderTop: "1px solid #162032", padding: "16px 18px" }}>
                  {g.description && (
                    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>{g.description}</p>
                  )}

                  <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase",
                    letterSpacing: "0.07em", marginBottom: 10, fontWeight: 600 }}>Progress</div>
                  <div style={{ marginBottom: 20 }}>
                    <Stepper value={g.current} max={g.target} unit={g.unit} onChange={d => updateGoalProgress(g.id, d)} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase",
                      letterSpacing: "0.07em", fontWeight: 600 }}>Daily tasks</div>
                    {g.tasks.length > 0 && (
                      <span style={{ fontSize: 11, color: "#475569" }}>{doneToday}/{g.tasks.length} today</span>
                    )}
                  </div>

                  {g.tasks.length === 0 && (
                    <p style={{ fontSize: 13, color: "#334155", margin: "0 0 10px" }}>No tasks yet — tasks let you track daily progress.</p>
                  )}

                  {g.tasks.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", background: "#080c14", borderRadius: 10, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>{t.label}</div>
                        {t.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{t.note}</div>}
                      </div>
                      {t.mode === "progress" && (
                        <span style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>+{t.progressValue} {g.unit || "pts"}</span>
                      )}
                      <button onClick={() => openEditTask(g.id, t)}
                        style={{ background: "none", border: "none", color: "#334155", cursor: "pointer",
                          fontSize: 14, padding: "4px 6px", WebkitTapHighlightColor: "transparent" }}>✎</button>
                      <button onClick={() => deleteTask(g.id, t.id)}
                        style={{ background: "none", border: "none", color: "#334155", cursor: "pointer",
                          fontSize: 16, padding: "4px 8px", WebkitTapHighlightColor: "transparent" }}>✕</button>
                    </div>
                  ))}

                  <button onClick={() => openNewTask(g.id)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      width: "100%", background: "transparent", border: "1px dashed #1e293b", color: "#475569",
                      borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", marginTop: 4,
                      WebkitTapHighlightColor: "transparent" }}>
                    + Add daily task
                  </button>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #162032",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    {confirmDelete === g.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                        <span style={{ fontSize: 13, color: "#94a3b8", flex: 1 }}>Delete this goal?</span>
                        <button onClick={() => deleteGoal(g.id)}
                          style={{ background: "#f87171", color: "#fff", border: "none", borderRadius: 8,
                            padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                        <button onClick={() => setConfirmDelete(null)}
                          style={{ background: "transparent", color: "#64748b", border: "1px solid #1e293b",
                            borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => openEditGoal(g)}
                          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer",
                            fontSize: 13, padding: 0, fontWeight: 600 }}>✎ Edit goal</button>
                        <button onClick={() => setConfirmDelete(g.id)}
                          style={{ background: "none", border: "none", color: "#334155", cursor: "pointer",
                            fontSize: 13, padding: 0 }}>Delete goal…</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CALENDAR TAB
  // ────────────────────────────────────────────────────────────────────────────
  function CalendarTab() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const cells: { day: number; inMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
    const rem = 42 - cells.length;
    for (let d = 1; d <= rem; d++) cells.push({ day: d, inMonth: false });

    const todayStr = todayKey();
    const isCurrentMonth = calYear === new Date().getFullYear() && calMonth === new Date().getMonth();

    const monthDays = Array.from({ length: daysInMonth }, (_, i) =>
      getDayCompletion(dateKey(calYear, calMonth, i + 1))).filter((v): v is number => v !== null);
    const monthAvg = monthDays.length > 0 ? Math.round(monthDays.reduce((a, b) => a + b, 0) / monthDays.length * 100) : null;
    const perfectDays = monthDays.filter(v => v === 1).length;
    const activeStreaks = Object.entries(streaks).filter(([, s]) => {
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      return s.lastDate === todayKey() || s.lastDate === yest.toISOString().slice(0, 10);
    }).length;

    let selPanel: { tasks: { key: string; label: string; goalTitle: string; done: boolean; color: string }[]; done: number; pct: number | null; dateStr: string } | null = null;
    if (selectedDay) {
      const dd = history[selectedDay] || {};
      const tasks = goals.flatMap(g => g.tasks.map(t => ({
        key: `${g.id}-${t.id}`, label: t.label, goalTitle: g.title,
        done: !!dd[`${g.id}-${t.id}`], color: CAT_COLOR[g.category] || "#f59e0b",
      })));
      const done = tasks.filter(t => t.done).length;
      const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : null;
      const dateStr = new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US",
        { weekday: "long", month: "short", day: "numeric" });
      selPanel = { tasks, done, pct, dateStr };
    }

    return (
      <>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { n: bestStreak > 0 ? `${bestStreak}🔥` : "—", l: "Best Streak" },
            { n: activeStreaks > 0 ? activeStreaks : "—", l: "Active" },
            { n: monthAvg !== null ? `${monthAvg}%` : "—", l: `${MONTHS[calMonth]} Avg` },
          ].map(s => (
            <div key={s.l} style={{ background: "#0c1220", border: "1px solid #1e293b",
              borderRadius: 12, padding: "14px 12px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{s.n}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3,
                textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ background: "#0c1220", border: "1px solid #1e293b",
          borderRadius: 16, padding: "18px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <button onClick={() => {
              if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1);
              setSelectedDay(null);
            }} style={{ background: "#162032", border: "none", color: "#94a3b8", borderRadius: 8,
              width: 34, height: 34, cursor: "pointer", fontSize: 18, display: "flex",
              alignItems: "center", justifyContent: "center" }}>‹</button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{MONTH_FULL[calMonth]} {calYear}</div>
              {monthAvg !== null && (
                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{perfectDays} perfect · {monthAvg}% avg</div>
              )}
            </div>
            <button onClick={() => {
              if (isCurrentMonth) return;
              if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1);
              setSelectedDay(null);
            }} style={{ background: "#162032", border: "none", color: isCurrentMonth ? "#1e293b" : "#94a3b8",
              borderRadius: 8, width: 34, height: 34, cursor: isCurrentMonth ? "default" : "pointer",
              fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
            {DAYS.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#334155",
                fontWeight: 700, paddingBottom: 6, textTransform: "uppercase" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {cells.map((cell, i) => {
              const dk = cell.inMonth ? dateKey(calYear, calMonth, cell.day) : null;
              const pct = dk ? getDayCompletion(dk) : null;
              const isToday = dk === todayStr;
              const isSel = dk === selectedDay;
              const dotColor = getDayColor(pct);
              return (
                <div key={i} onClick={() => { if (cell.inMonth && dk) setSelectedDay(isSel ? null : dk); }}
                  style={{
                    aspectRatio: "1", borderRadius: 10, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    cursor: cell.inMonth ? "pointer" : "default",
                    background: isSel ? "#f59e0b15" : isToday ? "#1a2235" : "transparent",
                    border: isToday ? "1px solid #f59e0b55" : isSel ? "1px solid #f59e0b66" : "1px solid transparent",
                    opacity: cell.inMonth ? 1 : 0.15,
                    WebkitTapHighlightColor: "transparent",
                  }}>
                  <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 400,
                    color: isToday ? "#f59e0b" : pct === 1 ? "#34d399" : "#94a3b8" }}>{cell.day}</span>
                  <div style={{ width: 5, height: 5, borderRadius: "50%",
                    background: dotColor, marginTop: 3, visibility: cell.inMonth ? "visible" : "hidden" }} />
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12,
            borderTop: "1px solid #162032" }}>
            {[["#1e293b","0%"],["#92400e","<50%"],["#d97706","50–99%"],["#34d399","100%"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 10, color: "#475569" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected day panel */}
        {selectedDay && selPanel && (
          <div style={{ background: "#0c1220", border: "1px solid #1e293b", borderRadius: 16,
            padding: "18px", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{selPanel.dateStr}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              {selPanel.tasks.length === 0 ? "No tasks set up." : selPanel.pct === 100 ? "🎉 Perfect day!" :
                selPanel.pct === 0 ? "Nothing completed." : `${selPanel.done} of ${selPanel.tasks.length} tasks done`}
            </div>
            {selPanel.tasks.map(t => (
              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                background: t.done ? "#0d1f18" : "#0f172a",
                border: `1px solid ${t.done ? "#14532d33" : "#1e293b"}`,
                borderRadius: 10, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${t.done ? "#34d399" : "#334155"}`,
                  background: t.done ? "#34d399" : "transparent" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.done ? "#34d399" : "#64748b" }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>{t.goalTitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sparklines */}
        {goals.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 16, fontWeight: 600 }}>Last 30 days</div>
            {goals.map(g => {
              const vals = getGoalSparkline(g);
              const color = CAT_COLOR[g.category] || "#f59e0b";
              const total = vals.reduce((a, b) => a + b, 0);
              const activeDays = vals.filter(v => v > 0).length;
              return (
                <div key={g.id} style={{ background: "#0c1220", border: "1px solid #1e293b",
                  borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>{g.title}</span>
                    <span style={{ fontSize: 12, color, fontWeight: 700 }}>+{total} {g.unit || "pts"}</span>
                  </div>
                  <Sparkline values={vals} color={color} width={280} height={28} />
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>{activeDays} active days this period</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Backup & Restore */}
        <div style={{ background: "#0c1220", border: "1px solid #1e293b", borderRadius: 16,
          padding: "16px 18px", marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase",
            letterSpacing: "0.08em", marginBottom: 10, fontWeight: 600 }}>Backup &amp; Restore</div>
          <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px" }}>
            Your data only lives in this browser. Export a backup occasionally, or restore one on a new device.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={exportData} style={{ ...ghostBtn, padding: "10px 14px", fontSize: 13 }}>Export backup</button>
            <button onClick={triggerImport} style={{ ...ghostBtn, padding: "10px 14px", fontSize: 13 }}>Import backup</button>
          </div>
          <input type="file" accept="application/json" ref={importInputRef}
            onChange={handleImportFile} style={{ display: "none" }} />
        </div>
      </>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    const HEADER_H = 60;
    return (
      <div style={{ minHeight: "100dvh", background: "#080c14", color: "#e2e8f0",
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>

        {/* Fixed header */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          height: HEADER_H, background: "#080c14", borderBottom: "1px solid #1e293b",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px" }}>
          <div>
            <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>GoalSet</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>
              {tab === "today" ? "Today" : tab === "goals" ? "Goals" : "Progress"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {tab === "today" && todayTotal > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: todayPct === 100 ? "#34d399" : "#f59e0b" }}>{todayPct}%</div>
                <div style={{ fontSize: 10, color: "#475569" }}>{todayDoneCount}/{todayTotal}</div>
              </div>
            )}
            {tab === "goals" && (
              <button onClick={openNewGoal}
                style={{ background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 10,
                  padding: "9px 14px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  WebkitTapHighlightColor: "transparent" }}>+ New</button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{
          position: "fixed",
          top: HEADER_H,
          left: 0,
          right: 0,
          bottom: BOTTOM_BAR,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch" as never,
          padding: "16px 16px 16px",
        }}>
          {tab === "today" && <TodayTab />}
          {tab === "goals" && <GoalsTab />}
          {tab === "calendar" && <CalendarTab />}
        </div>

        {/* Fixed bottom nav — always visible */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          height: BOTTOM_BAR,
          background: "#0c1220",
          borderTop: "1px solid #1e293b",
          display: "flex",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {NAV.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => setTab(n.id)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 4, border: "none",
                  background: "transparent", cursor: "pointer",
                  WebkitTapHighlightColor: "transparent", padding: "8px 0" }}>
                {n.icon(active)}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400,
                  color: active ? "#f59e0b" : "#475569", letterSpacing: "0.02em" }}>{n.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modals */}
        <Modal open={showGoalModal} onClose={closeGoalModal} title={editGoalId !== null ? "Edit Goal" : "New Goal"}>
          <GoalForm gForm={gForm} setGForm={setGForm} onSubmit={saveGoal} onCancel={closeGoalModal}
            submitLabel={editGoalId !== null ? "Save Changes" : "Create Goal"} />
        </Modal>
        <Modal open={!!showTaskModal} onClose={closeTaskModal} title={editTaskId !== null ? "Edit Task" : "Add Daily Task"}>
          {showTaskModal && taskModalGoal && (
            <TaskForm goalTitle={taskModalGoal.title} goalUnit={taskModalGoal.unit}
              tForm={tForm} setTForm={setTForm}
              onSubmit={() => saveTask(showTaskModal)} onCancel={closeTaskModal}
              submitLabel={editTaskId !== null ? "Save Changes" : "Add Task"} />
          )}
        </Modal>

        {/* Toast */}
        {toast && (
          <div style={{ position: "fixed", bottom: BOTTOM_BAR + 12, left: "50%",
            transform: "translateX(-50%)", background: "#1e293b", color: "#f1f5f9",
            padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
            zIndex: 300, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", whiteSpace: "nowrap",
            pointerEvents: "none" }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c14", color: "#e2e8f0",
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width: 210, background: "#0a1020", borderRight: "1px solid #162032",
        padding: "28px 14px", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ paddingLeft: 8, marginBottom: 32 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.5px" }}>GoalSet</div>
          <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 1 }}>daily progress</div>
        </div>

        {NAV.map(n => {
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                padding: "10px 10px", borderRadius: 9, border: "none", cursor: "pointer",
                background: active ? "#162032" : "transparent",
                color: active ? "#f59e0b" : "#475569", marginBottom: 2,
                fontWeight: active ? 700 : 400, fontSize: 13,
                borderLeft: `2px solid ${active ? "#f59e0b" : "transparent"}` }}>
              {n.icon(active)}
              <span>{n.label}</span>
            </button>
          );
        })}

        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #162032" }}>
          <div style={{ fontSize: 10, color: "#334155", textTransform: "uppercase",
            letterSpacing: "0.07em", marginBottom: 12, paddingLeft: 4 }}>Goals</div>
          {goals.length === 0 && <div style={{ fontSize: 12, color: "#1e293b", paddingLeft: 4 }}>None yet</div>}
          {goals.map(g => {
            const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
            const color = CAT_COLOR[g.category] || "#f59e0b";
            return (
              <div key={g.id} style={{ marginBottom: 12, paddingLeft: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#475569", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{g.title}</span>
                  <span style={{ fontSize: 11, color, flexShrink: 0 }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "#1e293b", borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2,
                    transition: "width 600ms cubic-bezier(0.22,1,0.36,1)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: "36px 40px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#f1f5f9", margin: 0, letterSpacing: "-0.3px" }}>
            {tab === "today" ? "Today's Plan" : tab === "goals" ? "Your Goals" : "Progress"}
          </h1>
          <div style={{ display: "flex", gap: 10 }}>
            {tab === "today" && (
              <button onClick={() => setTab("goals")} style={{ ...ghostBtn, flex: "none", padding: "9px 16px", fontSize: 13 }}>
                Manage goals →
              </button>
            )}
            {tab === "goals" && (
              <button onClick={openNewGoal} style={{ ...primaryBtn, flex: "none", padding: "9px 16px", fontSize: 13 }}>
                + New Goal
              </button>
            )}
          </div>
        </div>
        <div style={{ maxWidth: 660 }}>
          {tab === "today" && <TodayTab />}
          {tab === "goals" && <GoalsTab />}
          {tab === "calendar" && <CalendarTab />}
        </div>
      </main>

      {/* Desktop modals — centered */}
      {showGoalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={closeGoalModal}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18,
            padding: "28px", width: 440, maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{editGoalId !== null ? "Edit Goal" : "New Goal"}</span>
              <button onClick={closeGoalModal}
                style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: "50%",
                  width: 30, height: 30, cursor: "pointer", fontSize: 16, display: "flex",
                  alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <GoalForm gForm={gForm} setGForm={setGForm} onSubmit={saveGoal} onCancel={closeGoalModal}
              submitLabel={editGoalId !== null ? "Save Changes" : "Create Goal"} />
          </div>
        </div>
      )}

      {showTaskModal && taskModalGoal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
          onClick={closeTaskModal}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18,
            padding: "28px", width: 400, maxHeight: "88vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{editTaskId !== null ? "Edit Task" : "Add Daily Task"}</span>
              <button onClick={closeTaskModal}
                style={{ background: "#1e293b", border: "none", color: "#94a3b8", borderRadius: "50%",
                  width: 30, height: 30, cursor: "pointer", fontSize: 16, display: "flex",
                  alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <TaskForm goalTitle={taskModalGoal.title} goalUnit={taskModalGoal.unit}
              tForm={tForm} setTForm={setTForm}
              onSubmit={() => saveTask(showTaskModal)} onCancel={closeTaskModal}
              submitLabel={editTaskId !== null ? "Save Changes" : "Add Task"} />
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#1e293b", color: "#f1f5f9", padding: "10px 22px", borderRadius: 9,
          fontSize: 13, fontWeight: 600, zIndex: 300, pointerEvents: "none",
          boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}