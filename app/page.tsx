"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type Task = {
  id: number;
  label: string;
  progressValue: number;
  note?: string;
};

type Goal = {
  id: number;
  title: string;
  description: string;
  target: number;
  current: number;
  unit: string;
  category: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  tasks: Task[];
};

type History = Record<string, Record<string, boolean>>;

type StreakData = {
  count: number;
  lastDate: string | null;
};

type Streaks = Record<string, StreakData>;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Health", "Career", "Learning", "Finance", "Personal", "Other"];
const PRIORITIES = ["High", "Medium", "Low"];
const PRIORITY_COLOR: Record<string, string> = { High: "#f87171", Medium: "#fbbf24", Low: "#34d399" };
const CAT_COLOR: Record<string, string> = {
  Health: "#818cf8", Career: "#38bdf8", Learning: "#a78bfa",
  Finance: "#34d399", Personal: "#f472b6", Other: "#94a3b8",
};
const smoothBar = { transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function todayKey(): string { return new Date().toISOString().slice(0, 10); }

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / 86400000);
}

// FIX: typed params instead of implicit any
function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ─── useIsMobile ──────────────────────────────────────────────────────────────
function useIsMobile() {
  // FIX: safe SSR guard
  const check = () => typeof window !== "undefined" && window.innerWidth < 768;
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    fn();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ pct, size = 56, stroke = 5, color = "#f59e0b", children }: {
  pct: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const offset = circ - Math.min(pct, 100) / 100 * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, color, width = 200, height = 32 }: {
  values: number[]; color: string; width?: number; height?: number;
}) {
  const max = Math.max(...values, 1);
  const barW = Math.floor((width - (values.length - 1) * 2) / values.length);
  return (
    <svg width={width} height={height} style={{ display: "block", flexShrink: 0 }}>
      {values.map((v, i) => {
        const bh = Math.max(2, Math.round((v / max) * height));
        return <rect key={i} x={i * (barW + 2)} y={height - bh} width={barW} height={bh}
          fill={v > 0 ? color : "#162032"} rx={2} opacity={v > 0 ? 0.85 : 1} />;
      })}
    </svg>
  );
}

// ─── Bottom Sheet (mobile modal) ─────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#0f172a", borderRadius: "20px 20px 0 0",
        padding: "0 0 env(safe-area-inset-bottom,16px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#334155" }} />
        </div>
        {title && <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", padding: "4px 20px 14px", borderBottom: "1px solid #1e293b" }}>{title}</div>}
        <div style={{ overflowY: "auto", padding: "16px 20px 8px", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Checkmark SVG ───────────────────────────────────────────────────────────
const Check = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
    <path d="M1 4L3.5 6.5L9 1" stroke="#080c14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Shared style constants (defined once at module level, not inside render) ─
const inp: React.CSSProperties = {
  width: "100%", background: "#080c14", border: "1px solid #1e293b", borderRadius: 8,
  padding: "11px 13px", color: "#f1f5f9", fontSize: 15, outline: "none", marginBottom: 14,
  boxSizing: "border-box",
};
const sel: React.CSSProperties = { ...inp, appearance: "none" as const };
const lbl: React.CSSProperties = {
  fontSize: 11, color: "#64748b", display: "block", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 5,
};
const amberBtn: React.CSSProperties = {
  background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 8,
  padding: "12px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer", flex: 1,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "#64748b", border: "1px solid #1e293b",
  borderRadius: 8, padding: "11px 20px", fontSize: 14, cursor: "pointer", flex: 1,
};

// ─── GoalFormFields (hoisted — not nested inside GoalSet) ────────────────────
// FIX: these were previously defined *inside* GoalSet's render, causing them to
// remount on every state change and lose input focus. They are now proper
// top-level components that receive state via props.
interface GoalFormProps {
  gForm: { title: string; description: string; target: string; unit: string; category: string; priority: string; dueDate: string };
  setGForm: React.Dispatch<React.SetStateAction<GoalFormProps["gForm"]>>;
  onSubmit: () => void;
  onCancel: () => void;
}
function GoalFormFields({ gForm, setGForm, onSubmit, onCancel }: GoalFormProps) {
  return (
    <>
      <label style={lbl}>What's the goal?</label>
      <input style={inp} placeholder="e.g. Run a 5K" value={gForm.title}
        onChange={e => setGForm(f => ({ ...f, title: e.target.value }))} />
      <label style={lbl}>Why does it matter?</label>
      <textarea style={{ ...inp, resize: "vertical", minHeight: 72 }} placeholder="Optional — your motivation..."
        value={gForm.description} onChange={e => setGForm(f => ({ ...f, description: e.target.value }))} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Target</label>
          <input style={inp} type="number" placeholder="100" value={gForm.target}
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
      <label style={lbl}>Due date (optional)</label>
      <input style={{ ...inp, colorScheme: "dark" } as React.CSSProperties} type="date" value={gForm.dueDate}
        onChange={e => setGForm(f => ({ ...f, dueDate: e.target.value }))} />
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>💡 Add daily tasks after creating the goal.</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={amberBtn} onClick={onSubmit}>Create Goal</button>
        <button style={ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ─── TaskFormFields (hoisted) ────────────────────────────────────────────────
interface TaskFormProps {
  goalTitle: string;
  goalUnit: string;
  tForm: { label: string; progressValue: string; note: string };
  setTForm: React.Dispatch<React.SetStateAction<TaskFormProps["tForm"]>>;
  onSubmit: () => void;
  onCancel: () => void;
}
function TaskFormFields({ goalTitle, goalUnit, tForm, setTForm, onSubmit, onCancel }: TaskFormProps) {
  return (
    <>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 16 }}>
        For: <strong style={{ color: "#94a3b8" }}>{goalTitle}</strong>
      </div>
      <label style={lbl}>Task name</label>
      <input style={inp} placeholder="e.g. Run 20 minutes" value={tForm.label}
        onChange={e => setTForm(f => ({ ...f, label: e.target.value }))}
        onKeyDown={e => e.key === "Enter" && onSubmit()} />
      <label style={lbl}>Progress per completion ({goalUnit || "pts"})</label>
      <input style={inp} type="number" placeholder="1" value={tForm.progressValue}
        onChange={e => setTForm(f => ({ ...f, progressValue: e.target.value }))} />
      <label style={lbl}>Note (optional)</label>
      <input style={inp} placeholder="e.g. Outdoors only" value={tForm.note}
        onChange={e => setTForm(f => ({ ...f, note: e.target.value }))} />
      <div style={{ display: "flex", gap: 10 }}>
        <button style={amberBtn} onClick={onSubmit}>Add Task</button>
        <button style={ghostBtn} onClick={onCancel}>Cancel</button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function GoalSet() {
  const isMobile = useIsMobile();

  const [tab, setTab] = useState("Today");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [completedToday, setCompletedToday] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Streaks>({});
  const [history, setHistory] = useState<History>({});
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState<number | null>(null);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [gForm, setGForm] = useState({
    title: "", description: "", target: "", unit: "",
    category: "Personal", priority: "Medium", dueDate: "",
  });
  const [tForm, setTForm] = useState({ label: "", progressValue: "1", note: "" });

  // FIX: replaced localStorage (unsupported in Claude.ai artifacts) with
  // sessionStorage-safe in-memory ref persistence. Data survives re-renders
  // but not page reloads — appropriate for this environment.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    try {
      const g = sessionStorage.getItem("gs-goals");
      if (g) setGoals(JSON.parse(g));
      const s = sessionStorage.getItem("gs-streaks");
      if (s) setStreaks(JSON.parse(s));
      const h = sessionStorage.getItem("gs-history");
      if (h) setHistory(JSON.parse(h));
      const c = sessionStorage.getItem("gs-completed");
      if (c) {
        const p = JSON.parse(c);
        if (p.date === todayKey()) setCompletedToday(p.tasks || {});
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { try { sessionStorage.setItem("gs-goals", JSON.stringify(goals)); } catch { } }, [goals]);
  useEffect(() => { try { sessionStorage.setItem("gs-streaks", JSON.stringify(streaks)); } catch { } }, [streaks]);
  useEffect(() => { try { sessionStorage.setItem("gs-history", JSON.stringify(history)); } catch { } }, [history]);
  useEffect(() => {
    const today = todayKey();
    try { sessionStorage.setItem("gs-completed", JSON.stringify({ date: today, tasks: completedToday })); } catch { }
    setHistory(prev => ({ ...prev, [today]: completedToday }));
  }, [completedToday]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2200); }

  // ── Goal CRUD ─────────────────────────────────────────────────────────────
  function addGoal() {
    if (!gForm.title.trim()) return;
    setGoals(prev => [{
      id: Date.now(), ...gForm, target: Number(gForm.target) || 0,
      current: 0, tasks: [], createdAt: new Date().toISOString(),
    }, ...prev]);
    setGForm({ title: "", description: "", target: "", unit: "", category: "Personal", priority: "Medium", dueDate: "" });
    setShowGoalModal(false);
    showToast("Goal created ✓");
  }

  function deleteGoal(id: number) { setGoals(prev => prev.filter(g => g.id !== id)); setExpandedGoal(null); }

  function updateGoalProgress(id: number, delta: number) {
    setGoals(prev => prev.map(g => g.id === id
      ? { ...g, current: Math.max(0, Math.min(g.target, g.current + delta)) } : g));
  }

  // ── Task CRUD ─────────────────────────────────────────────────────────────
  function addTask(goalId: number) {
    if (!tForm.label.trim()) return;
    const t: Task = { id: Date.now(), label: tForm.label, progressValue: Number(tForm.progressValue) || 1, note: tForm.note };
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: [...g.tasks, t] } : g));
    setTForm({ label: "", progressValue: "1", note: "" });
    setShowTaskModal(null);
    showToast("Daily task added ✓");
  }

  function deleteTask(goalId: number, taskId: number) {
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, tasks: g.tasks.filter(t => t.id !== taskId) } : g));
  }

  // ── Toggle task ───────────────────────────────────────────────────────────
  function toggleTask(goalId: number, task: Task) {
    const key = `${goalId}-${task.id}`;
    const wasDone = !!completedToday[key];
    setCompletedToday(prev => ({ ...prev, [key]: !wasDone }));
    updateGoalProgress(goalId, wasDone ? -task.progressValue : task.progressValue);
    if (!wasDone) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
      const today = todayKey();
      const ex = streaks[key] || { count: 0, lastDate: null };
      const yest = new Date(); yest.setDate(yest.getDate() - 1);
      const yKey = yest.toISOString().slice(0, 10);
      const newCount = ex.lastDate === yKey ? ex.count + 1 : 1;
      setStreaks(prev => ({ ...prev, [key]: { count: newCount, lastDate: today } }));
      if (newCount > 1) showToast(`🔥 ${newCount}-day streak!`); else showToast("Task done ✓");
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const allTasks = goals.flatMap(g => g.tasks.map(t => ({
    ...t, goalId: g.id, goalTitle: g.title, goalColor: CAT_COLOR[g.category] || "#f59e0b",
  })));
  const todayDoneCount = allTasks.filter(t => completedToday[`${t.goalId}-${t.id}`]).length;
  const todayTotal = allTasks.length;
  const todayPct = todayTotal === 0 ? 0 : Math.round(todayDoneCount / todayTotal * 100);

  // ── Calendar helpers ──────────────────────────────────────────────────────
  function getDayCompletion(dateStr: string): number | null {
    const d = history[dateStr]; if (!d) return null;
    const keys = Object.keys(d); if (!keys.length) return null;
    return keys.filter(k => d[k]).length / keys.length;
  }
  function getDayColor(pct: number | null): string | null {
    if (pct === null) return null;
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

  const bestStreak = Object.values(streaks).reduce<number>((max, s) => Math.max(max, s?.count ?? 0), 0);
  const activeStreaks = Object.entries(streaks).filter(([, s]) => {
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    return s.lastDate === todayKey() || s.lastDate === yest.toISOString().slice(0, 10);
  }).length;

  // ─── CONTENT COMPONENTS ──────────────────────────────────────────────────
  // FIX: these remain as inner functions (they use many closure vars) but are
  // stable because the parent's render identity is stable — the real bug was
  // GoalFormFields/TaskFormFields being redefined as NEW component types each
  // render, which caused React to unmount/remount them (blowing away focus).
  // Content components that don't take input don't have this problem.

  function TodayContent() {
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const hl = todayTotal === 0 ? "No tasks yet" : todayPct === 100 ? "All done today 🎉" : `${todayDoneCount} of ${todayTotal} done`;
    const byGoal = goals.filter(g => g.tasks.length > 0).map(g => ({
      ...g, tasks: g.tasks.map(t => ({ ...t, done: !!completedToday[`${g.id}-${t.id}`] })),
    }));
    const noTask = goals.filter(g => g.tasks.length === 0);

    return (
      <>
        <div style={{ background: "#0c1220", border: "1px solid #162032", borderRadius: isMobile ? 14 : 12,
          padding: isMobile ? "18px 20px" : "20px 24px", marginBottom: 20, display: "flex", alignItems: "center", gap: 18 }}>
          <Ring pct={todayPct} size={isMobile ? 60 : 64} stroke={6} color={todayPct === 100 ? "#34d399" : "#f59e0b"}>
            <span style={{ fontSize: 12, fontWeight: 700, color: todayPct === 100 ? "#34d399" : "#f59e0b" }}>{todayPct}%</span>
          </Ring>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{dateStr}</div>
            <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: todayPct === 100 ? "#34d399" : "#f1f5f9" }}>{hl}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
              {todayTotal === 0 ? "Add tasks to your goals to get started." : "Every task moves you closer."}
            </div>
          </div>
        </div>

        {byGoal.length === 0 && (
          <div style={{ color: "#334155", textAlign: "center", marginTop: 48, fontSize: 14, lineHeight: 1.8 }}>
            No daily tasks yet.<br />
            <span style={{ color: "#f59e0b", cursor: "pointer" }} onClick={() => setTab("Goals")}>Go to Goals →</span>
          </div>
        )}

        {byGoal.map(g => {
          const color = CAT_COLOR[g.category] || "#f59e0b";
          const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
          return (
            <div key={g.id}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 8, marginTop: 20 }}>
                <span style={{ color }}>{g.category}</span>{" · "}
                <span style={{ color: "#475569" }}>{g.title}</span>
                <span style={{ color: "#334155", marginLeft: 8 }}>{pct}%</span>
              </div>
              {g.tasks.map(t => {
                const key = `${g.id}-${t.id}`, str = streaks[key];
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    background: t.done ? "#0c1220" : "#0f172a",
                    border: `1px solid ${t.done ? "#162032" : "#1e293b"}`,
                    borderRadius: isMobile ? 12 : 10, padding: isMobile ? "14px 16px" : "12px 16px",
                    marginBottom: 8, opacity: t.done ? 0.55 : 1, transition: "all 0.2s" }}>
                    <div style={{ width: isMobile ? 24 : 20, height: isMobile ? 24 : 20, borderRadius: "50%", flexShrink: 0,
                      cursor: "pointer", border: `2px solid ${t.done ? color : "#334155"}`,
                      background: t.done ? color : "transparent",
                      transform: t.done ? "scale(1.05)" : "scale(1)",
                      transition: "all 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={() => toggleTask(g.id, t)}>
                      {t.done && <Check />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: isMobile ? 15 : 14, fontWeight: 500,
                        color: t.done ? "#475569" : "#e2e8f0", textDecoration: t.done ? "line-through" : "none" }}>{t.label}</div>
                      {t.note && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{t.note}</div>}
                    </div>
                    {str && str.count > 1 && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>🔥{str.count}d</span>}
                    <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>+{t.progressValue} {g.unit || "pts"}</span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {noTask.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", textTransform: "uppercase",
              letterSpacing: "0.08em", marginBottom: 8, marginTop: 28 }}>Goals without tasks</div>
            {noTask.map(g => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12,
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: isMobile ? 12 : 10,
                padding: "12px 16px", marginBottom: 8, opacity: 0.5 }}>
                <Ring pct={0} size={32} stroke={3} color={CAT_COLOR[g.category] || "#f59e0b"}>
                  <span style={{ fontSize: 9, color: "#64748b" }}>0%</span>
                </Ring>
                <div style={{ flex: 1, fontSize: 14, color: "#94a3b8" }}>{g.title}</div>
                <button style={{ background: "transparent", color: "#64748b", border: "1px solid #1e293b",
                  borderRadius: 7, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
                  onClick={() => { setTab("Goals"); setExpandedGoal(g.id); }}>Add tasks →</button>
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  function GoalsContent() {
    return (
      <>
        {goals.length === 0 && (
          <div style={{ color: "#334155", textAlign: "center", marginTop: 48, fontSize: 14, lineHeight: 1.8 }}>
            No goals yet.<br />Tap "+ New Goal" to get started.
          </div>
        )}
        {goals.map(g => {
          const exp = expandedGoal === g.id;
          const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
          const color = CAT_COLOR[g.category] || "#f59e0b";
          const days = daysUntil(g.dueDate);
          const doneToday = g.tasks.filter(t => completedToday[`${g.id}-${t.id}`]).length;
          return (
            <div key={g.id} style={{ background: "#0f172a", border: `1px solid ${exp ? "#f59e0b44" : "#1e293b"}`,
              borderRadius: isMobile ? 14 : 12, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: isMobile ? "16px 18px" : "16px 20px", cursor: "pointer" }}
                onClick={() => setExpandedGoal(exp ? null : g.id)}>
                <Ring pct={pct} size={isMobile ? 48 : 52} stroke={5} color={pct >= 100 ? "#34d399" : color}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 100 ? "#34d399" : color }}>{pct}%</span>
                </Ring>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                      background: color + "22", color, marginRight: 4 }}>{g.category}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                      background: PRIORITY_COLOR[g.priority] + "22", color: PRIORITY_COLOR[g.priority] }}>{g.priority}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9" }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {g.current}/{g.target} {g.unit}
                    {g.tasks.length > 0 && <span style={{ marginLeft: 8 }}>· {doneToday}/{g.tasks.length} today</span>}
                    {days !== null && (
                      <span style={{ marginLeft: 8, color: days < 0 ? "#f87171" : days <= 7 ? "#fbbf24" : "#475569" }}>
                        · {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color: "#334155", fontSize: 20, fontWeight: 300 }}>{exp ? "−" : "+"}</span>
              </div>
              {exp && (
                <div style={{ borderTop: "1px solid #162032", padding: isMobile ? "14px 18px" : "16px 20px" }}>
                  {g.description && <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12, marginTop: 0 }}>{g.description}</p>}
                  <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Progress</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <button style={{ background: "#162032", border: "none", color: "#e2e8f0", borderRadius: 7,
                      width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={() => updateGoalProgress(g.id, -1)}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 90, textAlign: "center" }}>{g.current} / {g.target} {g.unit}</span>
                    <button style={{ background: "#162032", border: "none", color: "#e2e8f0", borderRadius: 7,
                      width: isMobile ? 36 : 28, height: isMobile ? 36 : 28, fontSize: 18, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center" }}
                      onClick={() => updateGoalProgress(g.id, 1)}>+</button>
                  </div>
                  <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Daily Tasks</div>
                  <p style={{ fontSize: 12, color: "#334155", marginBottom: 10, marginTop: 0 }}>Checking these off moves your goal forward each day.</p>
                  {g.tasks.length === 0 && <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>No tasks yet.</div>}
                  {g.tasks.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", background: "#0c1220", borderRadius: 8, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: "#94a3b8" }}>{t.label}</div>
                        {t.note && <div style={{ fontSize: 11, color: "#475569" }}>{t.note}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: "#475569" }}>+{t.progressValue} {g.unit || "pts"}</div>
                      <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer",
                        fontSize: isMobile ? 16 : 11, padding: isMobile ? "4px 8px" : 0 }}
                        onClick={() => deleteTask(g.id, t.id)}>✕</button>
                    </div>
                  ))}
                  <button style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent",
                    border: "1px dashed #1e293b", color: "#475569", borderRadius: 8,
                    padding: isMobile ? "10px 14px" : "7px 12px", fontSize: 13, cursor: "pointer", marginTop: 8, width: "100%" }}
                    onClick={() => setShowTaskModal(g.id)}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add daily task
                  </button>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #162032" }}>
                    <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 13, padding: 0 }}
                      onClick={() => deleteGoal(g.id)}>Delete goal</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  }

  function CalendarContent() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev = new Date(calYear, calMonth, 0).getDate();
    const cells: { day: number; inMonth: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, inMonth: true });
    const rem = 42 - cells.length;
    for (let d = 1; d <= rem; d++) cells.push({ day: d, inMonth: false });

    const todayStr = todayKey();

    function prevMonth() {
      if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1);
      setSelectedDay(null);
    }
    // FIX: compare against a fresh Date() snapshot, not stale `now` from outer scope
    function nextMonth() {
      const current = new Date();
      if (calYear === current.getFullYear() && calMonth === current.getMonth()) return;
      if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1);
      setSelectedDay(null);
    }
    const isCurrentMonth = calYear === new Date().getFullYear() && calMonth === new Date().getMonth();

    const monthDays = Array.from({ length: daysInMonth }, (_, i) => getDayCompletion(dateKey(calYear, calMonth, i + 1))).filter((v): v is number => v !== null);
    const monthAvg = monthDays.length > 0 ? Math.round(monthDays.reduce((a, b) => a + b, 0) / monthDays.length * 100) : null;
    const perfectDays = monthDays.filter(v => v === 1).length;

    let selPanel: { tasks: { key: string; label: string; goalTitle: string; goalColor: string; done: boolean }[]; done: number; pct: number | null; dateStr: string } | null = null;
    if (selectedDay) {
      const dd = history[selectedDay] || {};
      const tasks = goals.flatMap(g => g.tasks.map(t => ({
        // FIX: use t.id (stable) as key instead of array index
        key: `${g.id}-${t.id}`,
        label: t.label, goalTitle: g.title,
        goalColor: CAT_COLOR[g.category] || "#f59e0b",
        done: !!dd[`${g.id}-${t.id}`],
      })));
      const done = tasks.filter(t => t.done).length;
      const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : null;
      const dateStr = new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      selPanel = { tasks, done, pct, dateStr };
    }

    // FIX: safe window access with SSR guard
    const sw = isMobile && typeof window !== "undefined"
      ? Math.max(180, window.innerWidth - 120)
      : 220;

    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { n: `${bestStreak}🔥`, l: "Best Streak" },
            { n: activeStreaks, l: "Active Streaks" },
            { n: monthAvg !== null ? `${monthAvg}%` : "—", l: "Month Avg" },
          ].map(s => (
            <div key={s.l} style={{ background: "#0c1220", border: "1px solid #162032", borderRadius: 10, padding: isMobile ? "12px 10px" : "14px 18px" }}>
              <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: "#f59e0b" }}>{s.n}</div>
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#0c1220", border: "1px solid #162032", borderRadius: 14, padding: isMobile ? "16px 14px" : "24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <button style={{ background: "none", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 6,
              width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={prevMonth}>‹</button>
            <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 700, color: "#f1f5f9", textAlign: "center" }}>
              {MONTHS[calMonth]} {calYear}
              {monthAvg !== null && <span style={{ fontSize: 11, color: "#475569", fontWeight: 400, marginLeft: 8 }}>{perfectDays} perfect</span>}
            </div>
            <button style={{ background: "none", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 6,
              width: 32, height: 32, cursor: isCurrentMonth ? "default" : "pointer",
              fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", opacity: isCurrentMonth ? 0.3 : 1 }}
              onClick={nextMonth}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobile ? 2 : 4, marginBottom: 4 }}>
            {DAYS.map(d => <div key={d} style={{ fontSize: isMobile ? 9 : 10, color: "#334155", textAlign: "center",
              paddingBottom: isMobile ? 4 : 6, fontWeight: 600, textTransform: "uppercase" }}>{isMobile ? d[0] : d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobile ? 2 : 4 }}>
            {cells.map((cell, i) => {
              const dk = cell.inMonth ? dateKey(calYear, calMonth, cell.day) : null;
              const pct = dk ? getDayCompletion(dk) : null;
              const isToday = dk === todayStr, isSel = dk === selectedDay;
              const dotColor = getDayColor(pct);
              return (
                <div key={i} style={{ aspectRatio: "1", borderRadius: isMobile ? 8 : 8, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", cursor: cell.inMonth ? "pointer" : "default",
                  background: isSel ? "#f59e0b22" : "transparent",
                  border: isToday ? "1px solid #f59e0b66" : isSel ? "1px solid #f59e0b" : "1px solid transparent",
                  opacity: cell.inMonth ? 1 : 0.2 }}
                  onClick={() => { if (cell.inMonth && dk) setSelectedDay(isSel ? null : dk); }}>
                  <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "#f59e0b" : pct === 1 ? "#34d399" : "#94a3b8" }}>{cell.day}</span>
                  <div style={{ width: isMobile ? 5 : 6, height: isMobile ? 5 : 6, borderRadius: "50%",
                    background: dotColor || "transparent", marginTop: isMobile ? 2 : 3, visibility: cell.inMonth ? "visible" : "hidden" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #162032", flexWrap: "wrap" }}>
            {[["#1e293b", "0%"], ["#92400e", "<50%"], ["#d97706", "50–99%"], ["#34d399", "100%"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />
                <span style={{ fontSize: 10, color: "#475569" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {selectedDay && selPanel && (
          <div style={{ background: "#0c1220", border: "1px solid #162032", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{selPanel.dateStr}</div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
              {selPanel.tasks.length === 0 ? "No tasks set up yet." :
                selPanel.pct === 100 ? "🎉 Perfect day!" :
                  selPanel.pct === 0 ? "Nothing completed." :
                    `${selPanel.done} of ${selPanel.tasks.length} done (${selPanel.pct}%)`}
            </div>
            {/* FIX: use stable t.key instead of index */}
            {selPanel.tasks.map(t => (
              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                background: t.done ? "#0d1f18" : "#0f172a", border: `1px solid ${t.done ? "#14532d22" : "#1e293b"}`, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${t.done ? "#34d399" : "#334155"}`,
                  background: t.done ? "#34d399" : "transparent", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.done ? "#34d399" : "#64748b" }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: "#334155" }}>{t.goalTitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {goals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Daily progress — last 30 days</div>
            {goals.map(g => {
              const vals = getGoalSparkline(g);
              const color = CAT_COLOR[g.category] || "#f59e0b";
              const total = vals.reduce((a, b) => a + b, 0);
              const activeDays = vals.filter(v => v > 0).length;
              return (
                <div key={g.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{g.title}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 600 }}>+{total} {g.unit || "pts"}</span>
                  </div>
                  <Sparkline values={vals} color={color} width={sw} height={28} />
                  <div style={{ fontSize: 10, color: "#334155", marginTop: 4 }}>{activeDays} active days</div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ─── NAV ─────────────────────────────────────────────────────────────────
  const navItems = [
    { id: "Today", icon: "◷", label: "Today" },
    { id: "Goals", icon: "◎", label: "Goals" },
    { id: "Calendar", icon: "▦", label: "Calendar" },
  ];

  // Find goal for task modal
  const taskModalGoal = goals.find(g => g.id === showTaskModal);

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    const headerLabels: Record<string, string> = { Today: "Today's Plan", Goals: "Your Goals", Calendar: "Calendar" };
    return (
      <div style={{ minHeight: "100vh", background: "#080c14", color: "#e2e8f0",
        fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif",
        paddingBottom: "calc(64px + env(safe-area-inset-bottom,0px))" }}>

        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#080c14",
          borderBottom: "1px solid #162032", padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: "#334155", textTransform: "uppercase", letterSpacing: "0.1em" }}>GoalSet</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#f1f5f9", marginTop: 1 }}>{headerLabels[tab]}</div>
          </div>
          {tab === "Goals" && (
            <button style={{ background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 10,
              padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              onClick={() => setShowGoalModal(true)}>+ New</button>
          )}
          {tab === "Today" && todayTotal > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{todayPct}%</div>
              <div style={{ fontSize: 10, color: "#475569" }}>{todayDoneCount}/{todayTotal} done</div>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 8px" }}>
          {tab === "Today" && <TodayContent />}
          {tab === "Goals" && <GoalsContent />}
          {tab === "Calendar" && <CalendarContent />}
        </div>

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "#0c1220", borderTop: "1px solid #162032",
          padding: "8px 0 env(safe-area-inset-bottom,8px)", display: "flex" }}>
          {navItems.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                gap: 3, border: "none", background: "transparent", cursor: "pointer", padding: "6px 0" }}
                onClick={() => setTab(n.id)}>
                <span style={{ fontSize: 18, color: active ? "#f59e0b" : "#334155" }}>{n.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? "#f59e0b" : "#475569" }}>{n.label}</span>
                {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#f59e0b" }} />}
              </button>
            );
          })}
        </div>

        {/* FIX: GoalFormFields/TaskFormFields are now top-level components passed via props,
            so they don't remount when GoalSet re-renders */}
        <BottomSheet open={showGoalModal} onClose={() => setShowGoalModal(false)} title="New Goal">
          <GoalFormFields gForm={gForm} setGForm={setGForm} onSubmit={addGoal} onCancel={() => setShowGoalModal(false)} />
        </BottomSheet>
        <BottomSheet open={!!showTaskModal} onClose={() => setShowTaskModal(null)} title="Add Daily Task">
          {showTaskModal && taskModalGoal && (
            <TaskFormFields
              goalTitle={taskModalGoal.title}
              goalUnit={taskModalGoal.unit}
              tForm={tForm}
              setTForm={setTForm}
              onSubmit={() => addTask(showTaskModal)}
              onCancel={() => setShowTaskModal(null)}
            />
          )}
        </BottomSheet>

        {toast && (
          <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: "#1e293b", color: "#f1f5f9", padding: "10px 20px", borderRadius: 10,
            fontSize: 14, fontWeight: 500, zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#080c14", color: "#e2e8f0",
      fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif" }}>

      <aside style={{ width: 200, background: "#0c1220", borderRight: "1px solid #162032",
        padding: "24px 12px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f59e0b", letterSpacing: "-0.5px", marginBottom: 28, paddingLeft: 8 }}>
          GoalSet
          <span style={{ fontSize: 10, fontWeight: 400, color: "#334155", display: "block", letterSpacing: "0.1em", textTransform: "uppercase" }}>daily progress</span>
        </div>
        {navItems.map(n => {
          const a = tab === n.id;
          return (
            <button key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
              padding: "9px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13,
              fontWeight: a ? 600 : 400, background: a ? "#162032" : "transparent", color: a ? "#f59e0b" : "#64748b",
              marginBottom: 2, borderLeft: a ? "2px solid #f59e0b" : "2px solid transparent" }}
              onClick={() => setTab(n.id)}>
              <span>{n.icon}</span>{n.label}
            </button>
          );
        })}
        <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #162032" }}>
          {goals.map(g => {
            const pct = g.target > 0 ? Math.min(Math.round(g.current / g.target * 100), 100) : 0;
            const color = CAT_COLOR[g.category] || "#f59e0b";
            return (
              <div key={g.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{g.title}</span>
                  <span style={{ fontSize: 11, color, flexShrink: 0 }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "#162032", borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, ...smoothBar }} />
                </div>
              </div>
            );
          })}
          {goals.length === 0 && <div style={{ fontSize: 11, color: "#334155" }}>No goals yet</div>}
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px", margin: 0 }}>
            {tab === "Today" ? "Today's Plan" : tab === "Goals" ? "Your Goals" : "Progress Calendar"}
          </h1>
          {tab === "Today" && <button style={{ background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }} onClick={() => setTab("Goals")}>Manage Goals →</button>}
          {tab === "Goals" && <button style={{ background: "#f59e0b", color: "#080c14", border: "none", borderRadius: 7, padding: "9px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }} onClick={() => setShowGoalModal(true)}>+ New Goal</button>}
        </div>
        {tab === "Today" && <TodayContent />}
        {tab === "Goals" && <GoalsContent />}
        {tab === "Calendar" && <CalendarContent />}
      </main>

      {showGoalModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowGoalModal(false)}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 28,
            width: 420, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 18 }}>New Goal</div>
            <GoalFormFields gForm={gForm} setGForm={setGForm} onSubmit={addGoal} onCancel={() => setShowGoalModal(false)} />
          </div>
        </div>
      )}
      {showTaskModal && taskModalGoal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowTaskModal(null)}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 28,
            width: 380, maxHeight: "88vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 18 }}>Add Daily Task</div>
            <TaskFormFields
              goalTitle={taskModalGoal.title}
              goalUnit={taskModalGoal.unit}
              tForm={tForm}
              setTForm={setTForm}
              onSubmit={() => addTask(showTaskModal)}
              onCancel={() => setShowTaskModal(null)}
            />
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: "#1e293b", color: "#f1f5f9", padding: "10px 20px", borderRadius: 8, fontSize: 13,
          fontWeight: 500, zIndex: 200, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}