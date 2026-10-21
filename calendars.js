// Calendar connectors: read busy time and write the study plan.
// Google and Outlook run entirely in the browser (OAuth popups); .ics files are parsed locally.

const DAY = 86400000;
const CAL_NAME = "FE Study Plan";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

async function api(url, token, { method = "GET", body, headers = {} } = {}) {
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || `Request failed (${r.status})`);
  return data;
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Google Calendar ---------- */
// freebusy: reads only busy times. app.created: lets the site manage the one calendar it creates.
const G_SCOPES = "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.app.created";
const G = "https://www.googleapis.com/calendar/v3";

export async function googleToken(clientId) {
  await loadScript("https://accounts.google.com/gsi/client");
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: G_SCOPES,
      callback: (r) => (r.error ? reject(new Error(r.error_description || r.error)) : resolve(r.access_token)),
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "The Google window was closed." : (e.message || e.type))),
    });
    client.requestAccessToken();
  });
}

export async function googleBusy(token, from, to) {
  const busy = [];
  for (let t = from; t < to; t += 60 * DAY) {
    const r = await api(`${G}/freeBusy`, token, {
      method: "POST",
      body: { timeMin: new Date(t).toISOString(), timeMax: new Date(Math.min(to, t + 60 * DAY)).toISOString(), items: [{ id: "primary" }] },
    });
    for (const b of r.calendars?.primary?.busy || []) busy.push({ s: Date.parse(b.start), e: Date.parse(b.end) });
  }
  return busy;
}

export async function googleWrite(token, events, oldCalendarId, onProgress) {
  if (oldCalendarId) await api(`${G}/calendars/${encodeURIComponent(oldCalendarId)}`, token, { method: "DELETE" }).catch(() => {});
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cal = await api(`${G}/calendars`, token, { method: "POST", body: { summary: CAL_NAME, timeZone: tz } });
  let n = 0;
  for (const ev of events) {
    const body = { summary: ev.title, description: ev.text, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] } };
    if (ev.allDay) Object.assign(body, { start: { date: ev.date }, end: { date: ev.endDate } });
    else Object.assign(body, { start: { dateTime: new Date(ev.s).toISOString() }, end: { dateTime: new Date(ev.e).toISOString() } });
    await api(`${G}/calendars/${encodeURIComponent(cal.id)}/events`, token, { method: "POST", body });
    onProgress?.(++n, events.length);
    await pause(120);
  }
  return cal.id;
}

/* ---------- Outlook / Microsoft 365 ---------- */
const MS_SCOPES = ["Calendars.ReadWrite"];
const GRAPH = "https://graph.microsoft.com/v1.0";
let msalApp;

export async function outlookToken(clientId) {
  await loadScript("https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js");
  if (!msalApp) {
    msalApp = new window.msal.PublicClientApplication({
      auth: { clientId, authority: "https://login.microsoftonline.com/common", redirectUri: location.origin + location.pathname },
      cache: { cacheLocation: "sessionStorage" },
    });
    if (msalApp.initialize) await msalApp.initialize();
  }
  const account = msalApp.getAllAccounts()[0];
  if (account) {
    try { return (await msalApp.acquireTokenSilent({ scopes: MS_SCOPES, account })).accessToken; } catch { /* fall through to popup */ }
  }
  const r = await msalApp.loginPopup({ scopes: MS_SCOPES, prompt: "select_account" });
  return r.accessToken;
}

export async function outlookBusy(token, from, to) {
  const busy = [];
  let url = `${GRAPH}/me/calendarView?startDateTime=${new Date(from).toISOString()}&endDateTime=${new Date(to).toISOString()}&$select=start,end,showAs&$top=200`;
  while (url) {
    const r = await api(url, token, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    for (const e of r.value || []) {
      if (e.showAs === "free") continue;
      busy.push({ s: Date.parse(e.start.dateTime + "Z"), e: Date.parse(e.end.dateTime + "Z") });
    }
    url = r["@odata.nextLink"];
  }
  return busy;
}

export async function outlookWrite(token, events, oldCalendarId, onProgress) {
  if (oldCalendarId) await api(`${GRAPH}/me/calendars/${oldCalendarId}`, token, { method: "DELETE" }).catch(() => {});
  let cal;
  try {
    cal = await api(`${GRAPH}/me/calendars`, token, { method: "POST", body: { name: CAL_NAME } });
  } catch {
    cal = await api(`${GRAPH}/me/calendars`, token, { method: "POST", body: { name: `${CAL_NAME} ${new Date().toISOString().slice(0, 10)}` } });
  }
  let n = 0;
  for (const ev of events) {
    const body = { subject: ev.title, body: { contentType: "text", content: ev.text }, isReminderOn: true, reminderMinutesBeforeStart: 15 };
    if (ev.allDay) Object.assign(body, { isAllDay: true, start: { dateTime: `${ev.date}T00:00:00`, timeZone: "UTC" }, end: { dateTime: `${ev.endDate}T00:00:00`, timeZone: "UTC" } });
    else Object.assign(body, { start: { dateTime: new Date(ev.s).toISOString().slice(0, 19), timeZone: "UTC" }, end: { dateTime: new Date(ev.e).toISOString().slice(0, 19), timeZone: "UTC" } });
    await api(`${GRAPH}/me/calendars/${cal.id}/events`, token, { method: "POST", body });
    onProgress?.(++n, events.length);
    await pause(120);
  }
  return cal.id;
}

/* ---------- .ics files ---------- */
const ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function icsTime(f) {
  if (!f) return null;
  const v = f.v.trim();
  if (/VALUE=DATE(?!-)/.test(f.p) || /^\d{8}$/.test(v)) {
    return { t: new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8)).getTime(), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const a = m.slice(1, 7).map(Number);
  // Times with a TZID are read as local time, which is right for calendars in your own time zone
  const t = m[7] ? Date.UTC(a[0], a[1] - 1, a[2], a[3], a[4], a[5]) : new Date(a[0], a[1] - 1, a[2], a[3], a[4], a[5]).getTime();
  return { t, allDay: false };
}

function expand(ev, from, to, out) {
  if (ev.STATUS?.v === "CANCELLED" || ev.TRANSP?.v === "TRANSPARENT") return;
  const st = icsTime(ev.DTSTART);
  if (!st) return;
  const en = icsTime(ev.DTEND);
  const dur = en ? en.t - st.t : st.allDay ? DAY : 0;
  if (dur <= 0) return;
  const add = (t) => { if (t + dur > from && t < to) out.push({ s: t, e: t + dur }); };
  if (!ev.RRULE) return add(st.t);

  const rule = Object.fromEntries(ev.RRULE.v.split(";").map((kv) => kv.split("=")));
  const interval = +(rule.INTERVAL || 1);
  const until = rule.UNTIL ? icsTime({ v: rule.UNTIL, p: "" })?.t ?? to : to;
  const count = rule.COUNT ? +rule.COUNT : Infinity;
  const byday = rule.BYDAY ? rule.BYDAY.split(",").map((d) => ICS_DAYS[d.slice(-2)]) : null;
  const first = new Date(st.t);
  let n = 0;
  for (let i = 0; i < 6000 && n < count; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    const t = d.getTime();
    if (t > until || t >= to) break;
    let hit = false;
    if (rule.FREQ === "DAILY") hit = i % interval === 0;
    else if (rule.FREQ === "WEEKLY") {
      const week = Math.floor((i + first.getDay()) / 7);
      hit = week % interval === 0 && (byday ? byday.includes(d.getDay()) : d.getDay() === first.getDay());
    } else hit = i === 0;
    if (hit) { n++; add(t); }
  }
}

export function parseIcs(text, from, to) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const busy = [];
  let ev = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT") { if (ev) expand(ev, from, to, busy); ev = null; }
    else if (ev) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(";");
      ev[name] = { v: line.slice(i + 1), p: params.join(";") };
    }
  }
  return busy;
}

const icsEsc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsUtc = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function fold(line) {
  const parts = [];
  while (line.length > 74) { parts.push(line.slice(0, 74)); line = " " + line.slice(74); }
  parts.push(line);
  return parts.join("\r\n");
}

export function buildIcs(events) {
  const now = icsUtc(Date.now());
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FE Prep//Study Plan//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${CAL_NAME}`];
  for (const ev of events) {
    out.push("BEGIN:VEVENT", `UID:${ev.uid}@fe-prep`, `DTSTAMP:${now}`);
    if (ev.allDay) out.push(`DTSTART;VALUE=DATE:${ev.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${ev.endDate.replace(/-/g, "")}`);
    else out.push(`DTSTART:${icsUtc(ev.s)}`, `DTEND:${icsUtc(ev.e)}`);
    out.push(fold(`SUMMARY:${icsEsc(ev.title)}`), fold(`DESCRIPTION:${icsEsc(ev.text)}`), "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Study session", "END:VALARM", "END:VEVENT");
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}
