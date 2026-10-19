// Economic Calendar dashboard — vanilla JS, no build step.
// Data: data/events.json, produced by scripts/update_data.py from the
// Economic Calendar Data (Investing.com) Apify Actor:
// https://apify.com/pintostudio/economic-calendar-data-investing-com
(() => {
  const params = new URLSearchParams(location.search);
  const NOW = params.get("now") ? new Date(params.get("now")) : new Date(); // ?now= for demos/screenshots
  const TZ = params.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const FLAGS = {"united states":"🇺🇸","euro zone":"🇪🇺","united kingdom":"🇬🇧","japan":"🇯🇵","germany":"🇩🇪","france":"🇫🇷",
    "canada":"🇨🇦","australia":"🇦🇺","new zealand":"🇳🇿","switzerland":"🇨🇭","china":"🇨🇳","italy":"🇮🇹","spain":"🇪🇸","india":"🇮🇳"};
  const COUNTDOWNS = [
    {label: "Next FOMC decision", country: "united states", re: /Fed Interest Rate Decision/i},
    {label: "Next US CPI", country: "united states", re: /^CPI \((YoY|MoM)\)/i},
    {label: "Next Nonfarm Payrolls", country: "united states", re: /Nonfarm Payrolls/i},
    {label: "Next ECB decision", country: "euro zone", re: /ECB Interest Rate Decision|Deposit Facility Rate/i},
    {label: "Next BoE decision", country: "united kingdom", re: /BoE Interest Rate Decision/i},
  ];
  const state = {imp: new Set(["high", "medium", "holiday"]), countries: new Set(), q: "", range: "week", events: []};
  const $ = (s) => document.querySelector(s);
  const fmt = (d, o) => new Intl.DateTimeFormat("en-GB", {timeZone: TZ, ...o}).format(d);
  const dayKey = (d) => fmt(d, {year: "numeric", month: "2-digit", day: "2-digit"}).split("/").reverse().join("-");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

  function num(v) {
    if (!v) return null;
    let s = String(v).replace(/,/g, "").replace("%", "").trim(), m = 1;
    const u = s.slice(-1);
    if ("KMBT".includes(u)) { m = {K: 1e3, M: 1e6, B: 1e9, T: 1e12}[u]; s = s.slice(0, -1); }
    const n = parseFloat(s);
    return isNaN(n) ? null : n * m;
  }
  function surprise(e) {
    const a = num(e.actual), f = num(e.forecast);
    if (a === null || f === null) return "";
    return Math.abs(a - f) < 1e-9 ? "inline" : a > f ? "beat" : "miss";
  }
  function impKey(e) { return e.importance || (e.all_day ? "holiday" : "low"); }
  function eventDate(e) { return e.datetime_utc ? new Date(e.datetime_utc) : new Date(e.date + "T00:00:00Z"); }

  function weekBounds(offset) {
    const d = new Date(NOW); const wd = (d.getUTCDay() + 6) % 7; // Monday=0
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd + 7 * offset));
    return [start, new Date(start.getTime() + 7 * 864e5)];
  }

  function filtered() {
    let [a, b] = [null, null];
    if (state.range === "today") { a = new Date(dayKey(NOW) + "T00:00:00Z"); b = new Date(a.getTime() + 864e5); }
    if (state.range === "week") [a, b] = weekBounds(0);
    if (state.range === "next") [a, b] = weekBounds(1);
    const q = state.q.toLowerCase();
    return state.events.filter((e) => {
      const d = eventDate(e);
      if (a && (d < a || d >= b)) return false;
      if (!state.imp.has(impKey(e))) return false;
      if (state.countries.size && !state.countries.has(e.country)) return false;
      if (q && !(`${e.event} ${e.country} ${e.currency || ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function renderCountdowns() {
    const html = COUNTDOWNS.map((c) => {
      const ev = state.events.filter((e) => e.country === c.country && c.re.test(e.event) && e.datetime_utc);
      const next = ev.find((e) => eventDate(e) > NOW);
      if (!next) {
        const last = ev[ev.length - 1];
        return `<div class="cd past"><div class="lbl">${esc(c.label)}</div><div class="t">Not in loaded range</div>
          <div class="w">${last ? "Last: " + esc(fmt(eventDate(last), {day: "numeric", month: "short"})) + " · " + esc(last.actual || "") : ""}</div></div>`;
      }
      const ms = eventDate(next) - NOW, d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
      return `<div class="cd" data-when="${next.datetime_utc}"><div class="lbl">${esc(c.label)}</div>
        <div class="t">${d ? d + "d " : ""}${h}h ${String(m).padStart(2, "0")}m</div>
        <div class="w">${FLAGS[next.country] || ""} ${esc(next.event)} · ${esc(fmt(eventDate(next), {weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}))}
        ${next.forecast ? " · f " + esc(next.forecast) : next.previous ? " · prev " + esc(next.previous) : ""}</div></div>`;
    }).join("");
    $("#countdowns").innerHTML = html;
  }

  function renderDays() {
    const evs = filtered();
    const nextIdx = evs.findIndex((e) => e.datetime_utc && eventDate(e) > NOW);
    const groups = new Map();
    evs.forEach((e, i) => {
      const k = e.datetime_utc ? dayKey(eventDate(e)) : e.date;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push([e, i]);
    });
    if (!groups.size) { $("#days").innerHTML = `<div class="day"><div class="empty">No events match your filters.</div></div>`; return; }
    const today = dayKey(NOW);
    $("#days").innerHTML = [...groups].map(([k, rows]) => {
      const d = new Date(k + "T12:00:00Z");
      const body = rows.map(([e, i]) => {
        const s = surprise(e), past = e.datetime_utc && eventDate(e) <= NOW;
        const t = e.datetime_utc ? fmt(eventDate(e), {hour: "2-digit", minute: "2-digit"}) : "All day";
        return `<tr class="${past ? "past" : ""} ${i === nextIdx ? "next" : ""}">
          <td class="time">${t}</td>
          <td class="cur">${FLAGS[e.country] || "🌐"} ${esc(e.currency || "")}</td>
          <td class="imp"><span class="dot ${impKey(e)}"></span>${e.importance === "high" ? '<span class="dot high"></span><span class="dot high"></span>' : e.importance === "medium" ? '<span class="dot medium"></span>' : ""}</td>
          <td>${esc(e.event)}${i === nextIdx ? '<span class="badge">NEXT</span>' : ""}</td>
          <td class="num ${s}">${esc(e.actual || "")}</td>
          <td class="num">${esc(e.forecast || "")}</td>
          <td class="num prev">${esc(e.previous || "")}</td></tr>`;
      }).join("");
      return `<section class="day ${k === today ? "today" : ""}">
        <div class="dh"><span>${esc(fmt(d, {weekday: "long", day: "numeric", month: "long"}))}${k === today ? " · Today" : ""}</span><span class="n">${rows.length} events</span></div>
        <table><thead><tr><th class="l">Time</th><th class="l">Cur.</th><th class="l">Imp.</th><th class="l">Event</th><th>Actual</th><th>Forecast</th><th class="prev">Previous</th></tr></thead>
        <tbody>${body}</tbody></table></section>`;
    }).join("");
  }

  function renderCountryChips() {
    const counts = {};
    state.events.forEach((e) => (counts[e.country] = (counts[e.country] || 0) + 1));
    const list = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 12);
    $("#countries").innerHTML = list.map((c) => `<button class="chip" data-c="${esc(c)}">${FLAGS[c] || "🌐"} ${esc(c.replace(/\b\w/g, (x) => x.toUpperCase()))}</button>`).join("");
    $("#countries").onclick = (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      const c = b.dataset.c; state.countries.has(c) ? state.countries.delete(c) : state.countries.add(c);
      b.classList.toggle("on"); renderDays();
    };
  }

  function exportCsv() {
    const cols = ["datetime_utc", "date", "country", "currency", "importance", "event", "actual", "forecast", "previous"];
    const rows = [cols.join(",")].concat(filtered().map((e) => cols.map((c) => `"${String(e[c] ?? "").replace(/"/g, '""')}"`).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.join("\n")], {type: "text/csv"}));
    a.download = `economic-calendar-${state.range}.csv`; a.click();
  }

  function bind() {
    $("#impact").onclick = (ev) => {
      const b = ev.target.closest("button"); if (!b) return;
      const k = b.dataset.imp; state.imp.has(k) ? state.imp.delete(k) : state.imp.add(k);
      b.classList.toggle("on"); renderDays();
    };
    $("#q").oninput = (e) => { state.q = e.target.value; renderDays(); };
    $("#range").onchange = (e) => { state.range = e.target.value; renderDays(); };
    $("#csv").onclick = exportCsv;
    $("#tzname").textContent = TZ;
  }

  async function init() {
    bind();
    try {
      const res = await fetch("data/events.json", {cache: "no-store"});
      const data = await res.json();
      state.events = data.events.sort((a, b) => eventDate(a) - eventDate(b));
      $("#meta").textContent = `${data.count} events · updated ${fmt(new Date(data.generated_at), {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})} · ${TZ}`;
      renderCountryChips(); renderCountdowns(); renderDays();
      if (!params.get("now")) setInterval(() => { renderCountdowns(); }, 30000);
    } catch (err) {
      $("#days").innerHTML = `<div class="day"><div class="empty">Could not load data/events.json (${esc(err.message)}). Run <code>python scripts/update_data.py</code>.</div></div>`;
    }
  }
  init();
})();
