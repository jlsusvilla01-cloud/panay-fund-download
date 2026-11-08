/* Loads the newest released version of the Panay Fund screens (published to the database),
   falling back to the copy bundled with this installer. */
(async () => {
  "use strict";
  const verCmp = (a, b) => { const x = String(a || "0").split(".").map(Number), y = String(b || "0").split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; return 0; };
  let html = window.PF_APP_HTML, ver = window.PF_APP_VERSION;
  try {
    const {data} = await window.PF_SB.from("docs").select("data").eq("path", "release/app").maybeSingle();
    if (data && data.data && data.data.html && verCmp(data.data.version, ver) > 0) { html = data.data.html; ver = data.data.version; }
  } catch (e) { /* offline: use the bundled copy */ }
  await window.PF_AUTH_READY;
  document.getElementById("pf-boot").hidden = true;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const scripts = [...tpl.content.querySelectorAll("script")];
  scripts.forEach(s => s.remove());
  tpl.content.querySelectorAll("title,meta").forEach(n => n.remove());
  document.body.appendChild(tpl.content);
  for (const s of scripts) {
    if (s.src && /cdnjs|jsdelivr|unpkg/.test(s.src)) continue; // bundled locally already
    await new Promise(res => {
      const n = document.createElement("script");
      if (s.src) { n.src = s.src; n.onload = n.onerror = res; } else { n.textContent = s.textContent; }
      document.body.appendChild(n);
      if (!s.src) res();
    });
  }
})();
