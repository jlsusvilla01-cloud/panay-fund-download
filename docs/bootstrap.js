/* Starts Panay Fund. Uses the newest startup code published to the database (release/core) when it is newer
   than the copy in this installer, so fixes reach everyone without reinstalling. */
(async () => {
  "use strict";
  const BUNDLED_CORE = "1.8.1";
  const verCmp = (a, b) => { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; return 0; };
  const inline = src => { const s = document.createElement("script"); s.textContent = src; document.body.appendChild(s); };
  const file = src => new Promise(res => { const s = document.createElement("script"); s.src = src; s.onload = s.onerror = res; document.body.appendChild(s); });
  let core = null;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(PF_CONFIG.url + "/rest/v1/docs?path=eq.release/core&select=data", {headers: {apikey: PF_CONFIG.anonKey, Authorization: "Bearer " + PF_CONFIG.anonKey}, signal: ctl.signal});
    const rows = await r.json();
    if (rows && rows[0] && rows[0].data && rows[0].data.shim && verCmp(rows[0].data.version, BUNDLED_CORE) > 0) core = rows[0].data;
  } catch (e) { /* offline: use the bundled startup code */ }
  if (core) { inline(core.shim); inline(core.loader); }
  else { await file("shim.js"); await file("loader.js"); }
})();
