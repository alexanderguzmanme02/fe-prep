import { DATA } from "./data.js?v=2";
import { CONFIG } from "./settings.js";
import { DEMO, initStore, signUp, signIn, signOut, resetPassword, loadProfile, saveProfile } from "./store.js";
import { buildSchedule, finishedUnits, DEFAULT_AVAIL, WEEKDAYS, dayKey, parseDay, SESSION_VIDEOS } from "./scheduler.js?v=8";
import { PLAYBOOK, SESSION_TIPS, PLAYLIST_SOURCE, SOURCES } from "./community.js?v=1";
import * as cal from "./calendars.js?v=5";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = $("#app");
const DAY = 86400000;

let user = null;
let profile = null;
let view = "today";
let draftBusy = null; // busy times fetched on the setup screen, before the plan is saved

const todayKey = () => dayKey(new Date());
const addDays = (key, n) => { const d = parseDay(key); d.setDate(d.getDate() + n); return dayKey(d); };
const fmtDay = (key, opts = { weekday: "short", month: "short", day: "numeric" }) => parseDay(key).toLocaleDateString(undefined, opts);
const fmtTime = (t) => new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const unitById = (id) => DATA.units.find((u) => u.id === id);
const hours = (min) => Math.round(min / 6) / 10;
const KIND = { setup: "Setup", topic: "Study", block: "Long day", mock: "Practice exam", review: "Review", light: "Light", exam: "Exam" };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 5000);
}

async function save() {
  try { await saveProfile(user.uid, profile); } catch (e) { toast(`Couldn’t save: ${e.message}`); }
}

/* ---------- session content ---------- */
// Video card: thumbnail that turns into an embedded player when tapped
const vlink = (id) => {
  const v = DATA.videos[id];
  if (!v) return "";
  return `<div class="vid">
    <button type="button" class="thumb" data-yt="${esc(id)}" aria-label="Play ${esc(v.title)}">
      <img src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="" loading="lazy"><span class="play" aria-hidden="true">▶</span><span class="len">${esc(v.length)}</span>
    </button>
    <div class="vmeta"><b>${esc(v.title)}</b><small>${esc(v.channel)}</small>
      <a href="https://youtu.be/${esc(id)}" target="_blank" rel="noopener">Open on YouTube ↗</a></div>
  </div>`;
};

// Whole-topic playlist: plays in place, starting from its first video
const plist = (k) => {
  const t = DATA.topics[k];
  const id = t?.playlist?.split("list=")[1];
  if (!id) return "";
  return `<div class="vid pl">
    <button type="button" class="thumb plthumb" data-pl="${esc(id)}" data-title="${esc(t.name)} playlist" aria-label="Play the ${esc(t.name)} playlist">
      <span class="stackico" aria-hidden="true">≡</span><span class="play" aria-hidden="true">▶</span>
    </button>
    <div class="vmeta"><b>Full ${esc(t.name)} playlist</b><small>${esc(PLAYLIST_SOURCE)}</small>
      <a href="${esc(t.playlist)}" target="_blank" rel="noopener">Open on YouTube ↗</a></div>
  </div>`;
};

// "From people who passed" box inside a session
const tipsHtml = (kind) => {
  const tips = SESSION_TIPS[kind];
  return tips?.length ? `<aside class="tips"><b>From people who passed</b><ul>${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></aside>` : "";
};

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-yt], [data-pl]");
  if (!b) return;
  const id = b.dataset.yt;
  const f = document.createElement("iframe");
  f.className = "player";
  f.src = id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(b.dataset.pl)}&autoplay=1&rel=0`;
  f.title = id ? DATA.videos[id]?.title || "Video" : b.dataset.title;
  f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  f.allowFullscreen = true;
  b.closest(".vid").classList.add("playing");
  b.replaceWith(f);
});

const sessionVideos = (s) => s.videos || SESSION_VIDEOS[s.title] || [];

function unitHtml(it) {
  const u = unitById(it.unit);
  const t = DATA.topics[u.topic];
  const calc = u.calc.map((i) => t.calc[i]).filter(Boolean);
  return `<div class="unit">
    <h4>${esc(u.title)}${it.cont ? " <em>(continued)</em>" : ""} <span class="min">${it.min} min</span></h4>
    <ul>${u.focus.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    <p class="meta"><b>Handbook:</b> ${t.hb.slice(0, 2).map(([n, p]) => `${esc(n)} ${esc(p)}`).join(" · ")}${t.playlist ? ` · <a href="${esc(t.playlist)}" target="_blank" rel="noopener">Full topic playlist ↗</a>` : ""}</p>
    ${calc.length ? `<table class="calc"><tbody>${calc.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="key">${esc(b)}</td><td class="pg">p.${esc(c)}</td></tr>`).join("")}</tbody></table>` : ""}
    <div class="vids">${u.videos.map(vlink).join("")}</div>
  </div>`;
}

function sessionBody(s) {
  if (s.items?.length || s.kind === "topic" || s.kind === "block") {
    const units = (s.items || []).map(unitHtml).join("");
    const block = s.kind === "block" ? `<p class="note">Second half of the day: timed mixed problems from every topic so far, 3 minutes each, handbook only. Finish with your error log.</p>` : "";
    const routine = `<p class="note">Routine: 15 min handbook lookups → video, finding each formula in the handbook → problems (3 min each, decide by hand or calculator move first) → error log.</p>`;
    return (units || `<p>Finish unfinished problem sets and redo your error-log problems.</p>`) + block + routine + tipsHtml(s.kind);
  }
  const vids = sessionVideos(s);
  return `<ul>${(s.tasks || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>${tipsHtml(s.kind)}${vids.length ? `<div class="vids">${vids.map(vlink).join("")}</div>` : ""}`;
}

function sessionText(s) {
  const lines = [];
  if (s.items?.length) {
    for (const it of s.items) {
      const u = unitById(it.unit);
      const t = DATA.topics[u.topic];
      lines.push(`${u.title}${it.cont ? " (continued)" : ""} · ${it.min} min`, ...u.focus.map((f) => `- ${f}`));
      lines.push(`Handbook: ${t.hb[0][0]} ${t.hb[0][1]}`);
      for (const i of u.calc) if (t.calc[i]) lines.push(`Calculator: ${t.calc[i][0]}: ${t.calc[i][1]} (guidebook p.${t.calc[i][2]})`);
      for (const v of u.videos) if (DATA.videos[v]) lines.push(`Watch: ${DATA.videos[v].title} youtu.be/${v}`);
      lines.push("");
    }
    if (s.kind === "block") lines.push("Second half: timed mixed problems from every topic so far.");
  } else {
    lines.push(...(s.tasks || []).map((t) => `- ${t}`));
    for (const v of sessionVideos(s)) if (DATA.videos[v]) lines.push(`Watch: ${DATA.videos[v].title} youtu.be/${v}`);
  }
  const tips = SESSION_TIPS[s.kind] || [];
  if (tips.length) lines.push("", "From people who passed:", ...tips.map((t) => `- ${t}`));
  lines.push("", `Plan: ${location.origin}${location.pathname}`);
  return lines.join("\n");
}

function calendarEvents() {
  const from = todayKey();
  const out = [];
  for (const s of profile.sessions.filter((x) => x.date >= from)) {
    if (s.kind === "exam") out.push({ uid: s.id, allDay: true, date: s.date, endDate: addDays(s.date, 1), title: "FE EXAM", text: sessionText(s) });
    else s.blocks.forEach((b, i) => out.push({ uid: `${s.id}-${i}`, s: b.s, e: b.e, title: `FE: ${s.title}`, text: sessionText(s) }));
  }
  return out;
}

/* ---------- layout ---------- */
function shell(inner) {
  const tabs = [["today", "Today"], ["plan", "Plan"], ["topics", "Topics"], ["playbook", "Playbook"], ["setup", "Setup"]];
  app.innerHTML = `
    <header class="top"><div class="bar">
      <span class="brand">FE <b>Prep</b></span>
      ${profile?.sessions ? `<nav>${tabs.map(([k, l]) => `<button type="button" data-view="${k}" aria-current="${view === k}">${l}</button>`).join("")}</nav>` : ""}
      <span class="who">${esc(user.email)} <button type="button" id="signout" class="link">Sign out</button></span>
    </div></header>
    ${DEMO ? `<p class="demo">Demo mode: accounts aren’t connected yet, so this plan is saved in this browser only.</p>` : ""}
    <main class="wrap">${inner}</main>`;
  app.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { view = b.dataset.view; render(); }));
  $("#signout").addEventListener("click", async () => { await signOut(); if (DEMO) { user = null; render(); } });
}

/* ---------- sign in ---------- */
function renderAuth() {
  app.innerHTML = `<main class="auth">
    <h1>FE Other Disciplines <em>study planner</em></h1>
    <p class="lede">Enter your exam date and when you can study. You get a day-by-day plan with videos, handbook pages and calculator tips, built around your calendar.</p>
    ${DEMO ? `<p class="demo">Demo mode: no real accounts yet. Any email works and the plan stays in this browser.</p>` : ""}
    <form id="auth" class="card">
      <label for="email">Email</label><input id="email" type="email" autocomplete="email" required>
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" minlength="6" required>
      <div class="row"><button type="submit" class="primary" data-act="in">Sign in</button><button type="submit" data-act="up">Create account</button></div>
      <button type="button" id="forgot" class="link">Forgot password?</button>
      <p id="auth-msg" class="msg" role="status"></p>
    </form></main>`;
  let act = "in";
  app.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => { act = b.dataset.act; }));
  $("#auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#auth-msg");
    msg.textContent = act === "up" ? "Creating your account…" : "Signing in…";
    try {
      const u = await (act === "up" ? signUp : signIn)($("#email").value.trim(), $("#pw").value);
      if (DEMO) onUser(u);
    } catch (err) { msg.textContent = err.message; }
  });
  $("#forgot").addEventListener("click", async () => {
    const email = $("#email").value.trim();
    const msg = $("#auth-msg");
    if (!email) { msg.textContent = "Type your email above first."; return; }
    try { await resetPassword(email); msg.textContent = `Password reset email sent to ${email}.`; } catch (err) { msg.textContent = err.message; }
  });
}

/* ---------- setup ---------- */
function renderSetup() {
  const p = profile || {};
  const avail = p.avail || DEFAULT_AVAIL;
  const exam = p.examDate || "";
  const start = p.sessions ? todayKey() : (p.startDate || todayKey());
  // Busy times by calendar name, so work and personal calendars can be combined
  if (!draftBusy) draftBusy = { ...(p.busySets || (p.busy?.length ? { [p.busySource || "Calendar"]: p.busy } : {})) };
  const sets = draftBusy;
  const names = Object.keys(sets);
  const order = [1, 2, 3, 4, 5, 6, 0];
  shell(`
    <h1>${p.sessions ? "Update your plan" : "Build your plan"}</h1>
    <form id="setup" class="stack">
      <section class="card">
        <h2>1 · Dates</h2>
        <div class="grid2">
          <div><label for="exam">Exam date</label><input id="exam" type="date" required min="${addDays(todayKey(), 1)}" value="${esc(exam)}"></div>
          <div><label for="start">Start studying</label><input id="start" type="date" required value="${esc(start)}"></div>
        </div>
      </section>
      <section class="card">
        <h2>2 · When can you study?</h2>
        <p class="hint">Typical: 2–4 hours on weekdays and one long day on the weekend for timed practice. Add a second window if your day is split. One engineer 10 years out of school passed on 2–3 hours on weekdays.</p>
        <div class="tw"><table class="avail"><thead><tr><th>Day</th><th>From</th><th>To</th><th>From</th><th>To</th></tr></thead><tbody>
        ${order.map((d) => {
          const w = avail[d] || [];
          return `<tr><td><label class="chk"><input type="checkbox" id="on${d}" ${w.length ? "checked" : ""}> ${WEEKDAYS[d]}</label></td>
            <td><input type="time" id="s1-${d}" value="${esc(w[0]?.s || "18:00")}" aria-label="${WEEKDAYS[d]} start"></td>
            <td><input type="time" id="e1-${d}" value="${esc(w[0]?.e || "21:00")}" aria-label="${WEEKDAYS[d]} end"></td>
            <td><input type="time" id="s2-${d}" value="${esc(w[1]?.s || "")}" aria-label="${WEEKDAYS[d]} second start"></td>
            <td><input type="time" id="e2-${d}" value="${esc(w[1]?.e || "")}" aria-label="${WEEKDAYS[d]} second end"></td></tr>`;
        }).join("")}
        </tbody></table></div>
      </section>
      <section class="card">
        <h2>3 · Work around your calendar <span class="opt">optional</span></h2>
        <p class="hint">The planner reads only when you’re busy, never your event titles, and skips those times. Add as many calendars as you like, for example your work Outlook and your personal Gmail.</p>
        <div class="row wraps">
          <button type="button" id="g-busy" ${CONFIG.googleClientId ? "" : "disabled"}>${names.some((n) => n.startsWith("Google")) ? "Add another Google Calendar" : "Connect Google Calendar"}</button>
          <button type="button" id="o-busy" ${CONFIG.microsoftClientId ? "" : "disabled"}>${names.some((n) => n.startsWith("Outlook")) ? "Add another Outlook" : "Connect Outlook"}</button>
          <label class="button" for="ics">Upload .ics file</label><input id="ics" type="file" accept=".ics,text/calendar" multiple hidden>
        </div>
        ${!CONFIG.googleClientId || !CONFIG.microsoftClientId ? `<p class="hint">${!CONFIG.googleClientId ? "Google" : ""}${!CONFIG.googleClientId && !CONFIG.microsoftClientId ? " and " : ""}${!CONFIG.microsoftClientId ? "Outlook" : ""} connection isn’t switched on for this site yet. Export your calendar as an .ics file and upload it instead.</p>` : ""}
        ${names.length ? `<ul class="sources">${names.map((n) => `<li><span class="src">${esc(n)}</span><span class="cnt">${sets[n].length} busy blocks</span><button type="button" class="link" data-rm="${esc(n)}">Remove</button></li>`).join("")}</ul>` : ""}
        <p id="busy-msg" class="msg" role="status">${names.length ? `The plan avoids busy times from ${names.length === 1 ? "this calendar" : `all ${names.length} calendars`}.` : "No calendar loaded."}</p>
      </section>
      <button type="submit" class="primary big">${p.sessions ? "Rebuild my plan" : "Build my plan"}</button>
      ${p.sessions ? `<p class="hint">Rebuilding keeps the sessions you’ve checked off and reschedules everything else from today.</p>` : ""}
    </form>`);

  const range = () => {
    const s = parseDay($("#start").value || todayKey()).getTime();
    const e = parseDay($("#exam").value || addDays(todayKey(), 120)).getTime() + DAY;
    return [s, e];
  };
  // Keep what's typed in the form when the calendar list re-renders
  const keepForm = () => {
    const vals = [...app.querySelectorAll("#setup input:not([type=file])")].map((i) => [i.id, i.type === "checkbox" ? i.checked : i.value]);
    renderSetup();
    for (const [id, v] of vals) { const i = document.getElementById(id); if (i) i[typeof v === "boolean" ? "checked" : "value"] = v; }
  };
  const uniq = (base) => { let n = base; for (let i = 2; sets[n]; i++) n = `${base} ${i}`; return n; };
  const addBusy = (name, list) => { sets[name] = list; keepForm(); };
  const guard = () => { if (!$("#exam").value) { $("#busy-msg").textContent = "Set your exam date first, so I know how far ahead to read."; return false; } return true; };

  $("#g-busy").addEventListener("click", async () => {
    if (!guard()) return;
    $("#busy-msg").textContent = "Waiting for Google… choose the account to add.";
    try { const tok = await cal.googleToken(CONFIG.googleClientId); addBusy(uniq("Google Calendar"), await cal.googleBusy(tok, ...range())); }
    catch (e) { $("#busy-msg").textContent = `Google Calendar: ${e.message}`; }
  });
  $("#o-busy").addEventListener("click", async () => {
    if (!guard()) return;
    $("#busy-msg").textContent = "Waiting for Microsoft… choose the account to add.";
    try { const { token, user } = await cal.outlookToken(CONFIG.microsoftClientId, true); addBusy(`Outlook · ${user}`, await cal.outlookBusy(token, ...range())); }
    catch (e) { $("#busy-msg").textContent = `Outlook: ${e.message}`; }
  });
  $("#ics").addEventListener("change", async (e) => {
    if (!e.target.files.length || !guard()) return;
    for (const f of e.target.files) sets[uniq(f.name)] = cal.parseIcs(await f.text(), ...range());
    keepForm();
  });
  app.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { delete sets[b.dataset.rm]; keepForm(); }));

  $("#setup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const examDate = $("#exam").value;
    const startDate = $("#start").value;
    if (startDate >= examDate) { toast("The start date has to be before the exam date."); return; }
    const av = {};
    for (const d of order) {
      av[d] = [];
      if (!$(`#on${d}`).checked) continue;
      for (const n of [1, 2]) {
        const s = $(`#s${n}-${d}`).value;
        const en = $(`#e${n}-${d}`).value;
        if (s && en && en > s) av[d].push({ s, e: en });
      }
    }
    const { busySource, ...rest } = profile || {};
    profile = { ...rest, examDate, startDate, avail: av, busySets: sets, busy: Object.values(sets).flat(), done: profile?.done || {} };
    replan(startDate);
    draftBusy = null;
    await save();
    view = "today";
    render();
    toast("Plan ready.");
  });
}

// Rebuild from `from`, keeping everything before it and anything already checked off
function replan(from = todayKey()) {
  const done = profile.done || {};
  const old = profile.sessions || [];
  const keep = old.filter((s) => s.date < from || (done[s.id] && s.kind !== "exam"));
  const keepIds = new Set(keep.map((s) => s.id));
  const start = keep.some((s) => s.date === from) ? addDays(from, 1) : from;
  const r = buildSchedule({
    start, exam: profile.examDate, avail: profile.avail, busy: profile.busy || [],
    doneUnits: finishedUnits(old, done), includeSetup: !Object.keys(done).length,
  });
  profile.sessions = [...keep, ...r.sessions.filter((s) => !keepIds.has(s.id))].sort((a, b) => a.date.localeCompare(b.date));
  profile.totalMin = r.totalMin;
  profile.unitMin = Math.round(r.unitMin);
  if (profile.calendars && Object.values(profile.calendars).some(Boolean)) profile.calendarStale = true;
}

/* ---------- today ---------- */
function sessionCard(s, label) {
  const done = !!profile.done?.[s.id];
  const times = s.blocks.length ? s.blocks.map((b) => `${fmtTime(b.s)}–${fmtTime(b.e)}`).join(", ") : s.kind === "exam" ? "Your Pearson VUE appointment" : "";
  return `<article class="card session k-${s.kind}">
    <p class="eyebrow">${esc(label)} · ${esc(fmtDay(s.date, { weekday: "long", month: "long", day: "numeric" }))}${times ? ` · ${esc(times)}` : ""}</p>
    <h2>${esc(s.title)}</h2>
    ${sessionBody(s)}
    ${s.kind !== "exam" ? `<label class="chk big"><input type="checkbox" data-done="${esc(s.id)}" ${done ? "checked" : ""}> Done</label>` : ""}
  </article>`;
}

function renderToday() {
  const t = todayKey();
  const S = profile.sessions;
  const examIn = Math.round((parseDay(profile.examDate) - parseDay(t)) / DAY);
  const study = S.filter((s) => s.kind !== "exam");
  const doneN = study.filter((s) => profile.done?.[s.id]).length;
  const leftMin = study.filter((s) => s.date >= t && !profile.done?.[s.id]).reduce((m, s) => m + s.min, 0);
  const today = S.find((s) => s.date === t);
  const next = S.find((s) => s.date > t || (s.date === t && today && profile.done?.[today.id] && s !== today));
  const missed = S.filter((s) => s.date < t && s.kind !== "exam" && !profile.done?.[s.id]).length;
  const tight = (profile.totalMin || 0) < 80 * 60;
  shell(`
    <section class="hero">
      <div class="count"><b>${Math.max(0, examIn)}</b><span>${examIn === 1 ? "day" : "days"} to the exam · ${esc(fmtDay(profile.examDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}</span></div>
      <div class="stats">
        <div><b>${doneN}/${study.length}</b><span>sessions done</span></div>
        <div><b>${hours(leftMin)}</b><span>hours planned ahead</span></div>
        <div><b>${missed}</b><span>missed sessions</span></div>
      </div>
    </section>
    ${tight ? `<p class="warn">Only ${hours(profile.totalMin || 0)} study hours fit before the exam. Each topic gets about ${profile.unitMin} minutes. Add hours in Setup if you can.</p>` : ""}
    ${missed ? `<p class="warn">You have ${missed} unfinished past ${missed === 1 ? "session" : "sessions"}. <button type="button" id="replan" class="link">Re-plan from today</button> to fold them into the days ahead.</p>` : ""}
    ${profile.calendarStale ? `<p class="warn">Your plan changed. Update your calendar below so it matches.</p>` : ""}
    ${today ? sessionCard(today, "Today") : `<p class="card quiet">No session today. Rest up.</p>`}
    ${next ? sessionCard(next, "Next") : ""}
    <section class="card">
      <h2>Put the plan on your calendar</h2>
      <p class="hint">Creates a separate calendar called “FE Study Plan”, so it never mixes with your own events. Running it again replaces it with the latest plan.</p>
      <div class="row wraps">
        <button type="button" data-sync="google" ${CONFIG.googleClientId ? "" : "disabled"}>Google Calendar</button>
        <button type="button" data-sync="outlook" ${CONFIG.microsoftClientId ? "" : "disabled"}>Outlook</button>
        <button type="button" data-sync="ics">Download .ics (Apple, any app)</button>
      </div>
      <p id="sync-msg" class="msg" role="status"></p>
    </section>
    <div class="row"><button type="button" id="replan2">Re-plan from today</button><button type="button" data-view="setup" class="link">Change dates or hours</button></div>`);
  bindDone();
  $("#replan")?.addEventListener("click", doReplan);
  $("#replan2").addEventListener("click", doReplan);
  app.querySelectorAll("[data-sync]").forEach((b) => b.addEventListener("click", () => sync(b.dataset.sync)));
}

async function doReplan() {
  replan(todayKey());
  await save();
  render();
  toast("Re-planned from today.");
}

function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function sync(provider) {
  const msg = $("#sync-msg");
  const events = calendarEvents();
  if (provider === "ics") {
    download("fe-study-plan.ics", cal.buildIcs(events));
    msg.textContent = `Downloaded ${events.length} sessions. Open the file to add them to your calendar app.`;
    return;
  }
  try {
    msg.textContent = `Waiting for ${provider === "google" ? "Google" : "Microsoft"}…`;
    const token = provider === "google" ? await cal.googleToken(CONFIG.googleClientId) : (await cal.outlookToken(CONFIG.microsoftClientId)).token;
    const write = provider === "google" ? cal.googleWrite : cal.outlookWrite;
    const id = await write(token, events, profile.calendars?.[provider], (n, total) => { msg.textContent = `Adding ${n} of ${total}…`; });
    profile.calendars = { ...(profile.calendars || {}), [provider]: id };
    profile.calendarStale = false;
    await save();
    msg.textContent = `Done: ${events.length} sessions are in your “FE Study Plan” calendar.`;
  } catch (e) { msg.textContent = `Couldn’t update the calendar: ${e.message}`; }
}

function bindDone() {
  app.querySelectorAll("[data-done]").forEach((c) => c.addEventListener("change", async () => {
    profile.done = { ...(profile.done || {}) };
    if (c.checked) profile.done[c.dataset.done] = true; else delete profile.done[c.dataset.done];
    c.closest(".plan-row")?.classList.toggle("is-done", c.checked);
    await save();
  }));
}

/* ---------- plan ---------- */
function renderPlan() {
  const t = todayKey();
  const weeks = new Map();
  for (const s of profile.sessions) {
    const d = parseDay(s.date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const k = dayKey(d);
    if (!weeks.has(k)) weeks.set(k, []);
    weeks.get(k).push(s);
  }
  shell(`<h1>Your plan</h1>
    <p class="hint">${profile.sessions.length - 1} sessions from ${esc(fmtDay(profile.sessions[0].date))} to the exam. Tap a day for details.</p>
    ${[...weeks].map(([wk, list]) => `<section class="week"><h3>Week of ${esc(fmtDay(wk, { month: "short", day: "numeric" }))}
      <span>${list.filter((s) => profile.done?.[s.id]).length}/${list.filter((s) => s.kind !== "exam").length}</span></h3>
      ${list.map((s) => `<div class="plan-row ${profile.done?.[s.id] ? "is-done" : ""} ${s.date === t ? "is-today" : ""}">
        ${s.kind !== "exam" ? `<input type="checkbox" data-done="${esc(s.id)}" ${profile.done?.[s.id] ? "checked" : ""} aria-label="Mark ${esc(s.date)} done">` : `<span></span>`}
        <details><summary><span class="when">${esc(fmtDay(s.date))}${s.blocks[0] ? ` · ${esc(fmtTime(s.blocks[0].s))}` : ""}</span>
          <span class="pill p-${s.kind}">${KIND[s.kind]}</span><span class="ttl">${esc(s.title)}</span></summary>
          <div class="body">${sessionBody(s)}</div></details></div>`).join("")}
    </section>`).join("")}`);
  bindDone();
}

/* ---------- topics ---------- */
function renderTopics() {
  const order = ["fluids", "statics", "dyn", "strength", "thermo", "heat", "math", "stats", "econ", "safety", "materials", "elec", "chem", "ethics", "instr"];
  shell(`<h1>Topic guides</h1>
    <p class="hint">Ordered by how many exam questions each carries. Handbook pages are the printed numbers of the FE Reference Handbook 10.6 (add 6 for the PDF page).</p>
    <p class="warn">Study tactics, books and exam-day tips from people who passed are in the <button type="button" data-view="playbook" class="link">Playbook</button>.</p>
    <div class="card"><h2>Calculator habits (TI-36X Pro)</h2><table class="calc"><tbody>${DATA.habits.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="key">${esc(b)}</td><td class="pg">p.${esc(c)}</td></tr>`).join("")}</tbody></table></div>
    ${order.map((k) => { const t = DATA.topics[k]; return `<details class="card topic"><summary><h2>${esc(t.name)}</h2><span class="q">${esc(t.q)} questions</span></summary>
      <h4>Know these cold</h4><ol>${t.master.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>
      <h4>Handbook</h4><table class="calc"><tbody>${t.hb.map(([n, p]) => `<tr><td>${esc(n)}</td><td class="pg">${esc(p)}</td></tr>`).join("")}</tbody></table>
      <h4>Calculator moves</h4><table class="calc"><tbody>${t.calc.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="key">${esc(b)}</td><td class="pg">p.${esc(c)}</td></tr>`).join("")}</tbody></table>
      <h4>Watch</h4><div class="vids">${plist(k)}${t.videos.map(vlink).join("")}</div>
      <h4>Traps</h4><ul>${t.traps.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></details>`; }).join("")}`);
}

/* ---------- playbook ---------- */
function renderPlaybook() {
  const lists = Object.keys(DATA.topics).filter((k) => DATA.topics[k].playlist);
  shell(`<h1>Playbook</h1>
    <p class="hint">How engineers who passed actually did it. ${esc(SOURCES)} The same tips show up inside your sessions.</p>
    ${PLAYBOOK.map((sec) => `<section class="card">
      <h2>${esc(sec.title)}</h2>${sec.why ? `<p class="hint">${esc(sec.why)}</p>` : ""}
      <dl class="tipl">${sec.items.map(([a, b]) => `<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
    </section>`).join("")}
    <section class="card">
      <h2>6 · Topic playlists</h2>
      <p class="hint">Whole-topic playlists recommended on r/FE_Exam. Tap one to play it here. Best channels, in the order people ranked them: Mark Mattson, Engineering Fundamentals, Gregory Michaelson, Genie Prep, DirectHub, Prepineer.</p>
      <div class="vids">${lists.map(plist).join("")}</div>
    </section>`);
}

/* ---------- boot ---------- */
function render() {
  if (!user) return renderAuth();
  if (!profile?.sessions || view === "setup") return renderSetup();
  if (view === "plan") return renderPlan();
  if (view === "topics") return renderTopics();
  if (view === "playbook") return renderPlaybook();
  return renderToday();
}

async function onUser(u) {
  user = u;
  profile = null;
  if (u) {
    app.innerHTML = `<p class="loading">Loading your plan…</p>`;
    try { profile = await loadProfile(u.uid); } catch (e) { toast(`Couldn’t load your plan: ${e.message}`); }
    view = profile?.sessions ? "today" : "setup";
  }
  render();
}

initStore(onUser).catch((e) => { app.innerHTML = `<p class="loading">The site couldn’t start: ${esc(e.message)}</p>`; });
