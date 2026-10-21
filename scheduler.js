// Builds a day-by-day FE study schedule from the exam date, weekly availability and busy calendar time.
import { DATA } from "./data.js";

const MIN = 60000;
const DAY = 86400000;
const UNIT_MIN = 210;         // one content unit = one 3.5-h session of the original plan
const MOCK_MIN = 320;         // 110 questions in 5 h 20 min
const HALF_MOCK_MIN = 160;
const PRACTICE_SHARE = 0.26;  // last quarter of study time goes to practice exams and weak areas
const LONG_DAY_MIN = 300;     // days this long in the content phase get an exam-style timed block
const MIN_BLOCK = 30;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_AVAIL = {
  0: [], 1: [{ s: "18:00", e: "21:00" }], 2: [{ s: "18:00", e: "21:00" }], 3: [{ s: "18:00", e: "21:00" }],
  4: [{ s: "18:00", e: "21:00" }], 5: [{ s: "18:00", e: "21:00" }], 6: [{ s: "08:00", e: "14:00" }],
};

const SETUP = [
  { title: "Kickoff: exam rules + handbook tour", tasks: ["Read the NCEES FE Other Disciplines exam specification (14 areas, 110 questions).", "Download the free FE Reference Handbook from your MyNCEES account and practice Ctrl+F searches.", "Write a one-page chapter → page map of the handbook."] },
  { title: "Handbook scavenger hunt + calculator setup", tasks: ["Find 5 formulas per chapter and note the page of each.", "Timed drill: 15 lookups in 20 minutes.", "Set up your NCEES-approved calculator (TI-36X Pro: DEG, MathPrint, FLOAT) and learn the solvers."] },
  { title: "Diagnostic", tasks: ["Cold diagnostic: about 5 problems per topic, handbook only, 3 minutes each.", "Score each topic. This is your baseline."] },
];

const REVIEW = [
  "Weak area: Fluids deep redo", "Weak area: Statics + Dynamics", "Weak area: Strength + Materials",
  "Weak area: Thermo + Heat Transfer", "Weak area: Math + Stats (calculator speed)", "Weak area: Electrical + Instrumentation",
  "Weak area: Chemistry + Econ", "Conceptual day: Ethics, Safety, Materials", "Handbook speed race + 40 mixed problems",
];

export function dayKey(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function at(day, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// Free time on one day: the day's availability windows minus busy blocks
export function freeBlocks(day, avail, busy) {
  let pieces = (avail[day.getDay()] || [])
    .filter((w) => w.s && w.e && w.e > w.s)
    .map((w) => [at(day, w.s), at(day, w.e)]);
  for (const b of busy) {
    pieces = pieces.flatMap(([s, e]) => (b.e <= s || b.s >= e)
      ? [[s, e]]
      : [[s, Math.min(e, b.s)], [Math.max(s, b.e), e]].filter(([a, c]) => c > a));
  }
  return pieces.filter(([s, e]) => (e - s) / MIN >= MIN_BLOCK).map(([s, e]) => ({ s, e }));
}

const minutesOf = (blocks) => blocks.reduce((t, b) => t + (b.e - b.s) / MIN, 0);

// Keep only the first `min` minutes of a day's blocks
function trim(blocks, min) {
  const out = [];
  for (const b of blocks) {
    if (min <= 0) break;
    const take = Math.min(min, (b.e - b.s) / MIN);
    out.push({ s: b.s, e: b.s + Math.round(take) * MIN });
    min -= take;
  }
  return out;
}

/**
 * start, exam: "YYYY-MM-DD". avail: {weekday: [{s:"HH:MM", e:"HH:MM"}]}. busy: [{s, e}] epoch ms.
 * doneUnits: unit ids already finished. includeSetup: false on a re-plan after studying has started.
 */
export function buildSchedule({ start, exam, avail, busy = [], doneUnits = new Set(), includeSetup = true }) {
  const examDay = parseDay(exam);
  const days = [];
  for (let d = parseDay(start); d < examDay; d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    const t0 = day.getTime();
    const blocks = freeBlocks(day, avail, busy.filter((b) => b.e > t0 && b.s < t0 + DAY));
    const min = minutesOf(blocks);
    if (min > 0) days.push({ key: dayKey(day), blocks, min });
  }

  const sessions = [];
  const taper = days.length > 6 ? days.splice(days.length - 2) : [];
  const total = days.reduce((t, d) => t + d.min, 0);
  const queue = DATA.units.filter((u) => !doneUnits.has(u.id));
  const setupMin = includeSetup ? Math.min(600, Math.max(180, total * 0.04)) : 0;
  const practiceMin = queue.length ? total * PRACTICE_SHARE : total;

  // Phase of each day by where it falls in the cumulative study time
  let cum = 0;
  let setupDays = 0;
  for (const d of days) {
    const setup = cum < setupMin && setupDays < SETUP.length;
    if (setup) setupDays++;
    d.phase = setup ? "setup" : cum < total - practiceMin ? "content" : "practice";
    cum += d.min;
  }

  // Content: scale the remaining units to fit the content days
  const contentDays = days.filter((d) => d.phase === "content");
  const contentMin = contentDays.reduce((t, d) => t + (d.min >= LONG_DAY_MIN ? d.min * 0.4 : d.min), 0);
  const unitMin = queue.length ? contentMin / queue.length : UNIT_MIN;
  let qi = 0;
  let left = unitMin;

  let setupIdx = 0;
  for (const d of days.filter((x) => x.phase !== "practice")) {
    if (d.phase === "setup") {
      const s = SETUP[Math.min(setupIdx++, SETUP.length - 1)];
      sessions.push({ id: d.key, date: d.key, kind: "setup", title: s.title, tasks: s.tasks, blocks: d.blocks, min: d.min });
      continue;
    }
    const long = d.min >= LONG_DAY_MIN;
    let budget = long ? d.min * 0.4 : d.min;
    const items = [];
    while (budget > 1 && qi < queue.length) {
      const take = Math.min(budget, left);
      const u = queue[qi];
      const cont = left < unitMin - 1;
      left -= take;
      budget -= take;
      const last = left <= 1;
      items.push({ unit: u.id, min: Math.round(take), cont, last });
      if (last) { qi++; left = unitMin; }
    }
    const first = items.length ? DATA.units.find((u) => u.id === items[0].unit) : null;
    const title = !items.length ? "Catch-up + mixed review"
      : items.length === 1 ? first.title + (items[0].cont ? " (continued)" : "")
      : items.map((i) => DATA.units.find((u) => u.id === i.unit).title.split(":")[0]).join(" + ");
    sessions.push({
      id: d.key, date: d.key, kind: long ? "block" : "topic", title: long ? `Exam-style day: ${title}` : title,
      items, blocks: d.blocks, min: d.min,
    });
  }

  // Practice: full mocks on the longest days, a review after each, weak areas in between
  const practice = days.filter((d) => d.phase === "practice");
  const fits = practice.filter((d) => d.min >= MOCK_MIN);
  const halfFits = practice.filter((d) => d.min >= HALF_MOCK_MIN);
  const pool = fits.length >= 2 ? fits : halfFits;
  const want = Math.min(4, pool.length, Math.max(1, Math.round(practice.length / 5)));
  const mockKeys = new Set();
  for (let i = 0; i < want; i++) mockKeys.add(pool[Math.floor((i + 0.5) * pool.length / want)].key);
  let mockNo = 0;
  let reviewNext = false;
  let ri = 0;
  for (const d of practice) {
    if (mockKeys.has(d.key)) {
      mockNo++;
      const full = d.min >= MOCK_MIN;
      sessions.push({
        id: d.key, date: d.key, kind: "mock", blocks: d.blocks, min: d.min,
        title: full ? `Full practice exam #${mockNo}` : `Half practice exam #${mockNo} (55 questions)`,
        tasks: [full ? "110 questions in 5 h 20 min, with a 25-minute break around question 55." : "55 questions in 2 h 40 min.",
          "Handbook PDF and approved calculator only. No phone.",
          mockNo === 2 ? "Use the official NCEES FE Other Disciplines practice exam for this one." : "Use problems you haven’t seen, in the official topic proportions.",
          "Score each topic. Review tomorrow."],
      });
      reviewNext = true;
    } else if (reviewNext) {
      sessions.push({ id: d.key, date: d.key, kind: "review", title: `Review practice exam #${mockNo}`, blocks: d.blocks, min: d.min,
        tasks: ["Rework every miss and every guess.", "Write the handbook page you should have used.", "Rank your weakest topics by (questions on the exam × % missed)."] });
      reviewNext = false;
    } else {
      sessions.push({ id: d.key, date: d.key, kind: "review", title: REVIEW[ri++ % REVIEW.length], blocks: d.blocks, min: d.min,
        tasks: ["Redo the error-log problems for this area.", "25–30 new timed problems, 3 minutes each.", "Handbook lookup race: 10 items."] });
    }
  }

  taper.forEach((d, i) => {
    const last = i === taper.length - 1;
    const min = last ? 60 : 90;
    sessions.push({
      id: d.key, date: d.key, kind: "light", blocks: trim(d.blocks, min), min: Math.min(min, d.min),
      title: last ? "Rest + exam-eve checklist" : "Light review",
      tasks: last ? ["Pack ID and approved calculator.", "Confirm the Pearson VUE time and route; arrive 30 minutes early.", "Light dinner, 8 hours of sleep."]
        : ["Flip through your handbook map and error log. No new material."],
    });
  });

  sessions.push({ id: exam, date: exam, kind: "exam", title: "FE Other Disciplines exam", blocks: [], min: 0,
    tasks: ["First pass: answer what you know in 3 minutes or less, flag the rest.", "Second pass: flagged questions. Never leave a blank.", "Take the scheduled break."] });

  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return { sessions, totalMin: total + taper.reduce((t, d) => t + Math.min(90, d.min), 0), unitMin, remainingUnits: queue.length };
}

// Units finished in sessions marked done (a unit counts once its last part is done)
export function finishedUnits(sessions, done) {
  const out = new Set();
  for (const s of sessions) if (done[s.id]) for (const it of s.items || []) if (it.last) out.add(it.unit);
  return out;
}
