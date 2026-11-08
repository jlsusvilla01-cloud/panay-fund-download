/* Panay Fund desktop: connects the app to its Supabase database and logins.
   It provides the same small API the app already uses (claude.use("db" | "user" | "downloads" | "assets")). */
(() => {
  "use strict";
  const sb = window.supabase.createClient(PF_CONFIG.url, PF_CONFIG.anonKey, {auth: {persistSession: true, autoRefreshToken: true, storageKey: "panayfund-auth"}});
  window.PF_SB = sb;
  let session = null, member = null;
  const authReady = new Promise(res => { window.__pfAuthed = res; });

  /* ---------------- login screen ---------------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  function view(name, msg, kind) {
    $("#pf-boot").hidden = true; $("#pf-auth").hidden = false;
    const m = msg ? `<div class="pa-msg ${kind || ""}">${esc(msg)}</div>` : "";
    const B = $("#pa-body");
    if (name === "signin") B.innerHTML = `<h1>Sign in</h1><p class="pa-sub">Use the email and password for your Panay Fund account.</p>${m}
      <div class="pa-f"><label for="pa-e">Email</label><input id="pa-e" type="email" autocomplete="username" autofocus></div>
      <div class="pa-f"><label for="pa-p">Password</label><input id="pa-p" type="password" autocomplete="current-password"></div>
      <button class="pa-btn" id="pa-go">Sign in</button>
      <div class="pa-row"><button class="pa-link" id="pa-new">Create an account</button><button class="pa-link" id="pa-forgot">Forgot password?</button></div>`;
    if (name === "signup") B.innerHTML = `<h1>Create an account</h1><p class="pa-sub">Use your real email. The owner approves new accounts before they can see any records.</p>${m}
      <div class="pa-f"><label for="pa-e">Email</label><input id="pa-e" type="email" autocomplete="username" autofocus></div>
      <div class="pa-f"><label for="pa-p">Password (at least 8 characters)</label><input id="pa-p" type="password" autocomplete="new-password"></div>
      <div class="pa-f"><label for="pa-c">Confirm password</label><input id="pa-c" type="password" autocomplete="new-password"></div>
      <button class="pa-btn" id="pa-go">Create account</button>
      <div class="pa-row"><button class="pa-link" id="pa-back">I already have an account</button></div>`;
    if (name === "forgot") B.innerHTML = `<h1>Forgot your password?</h1>${m}<p class="pa-sub">Ask the Panay Fund owner to reset it for you. The owner can ask Claude in the Panay Fund chat to set a temporary password, which you then change after signing in.</p>
      <button class="pa-btn" id="pa-back">Back to sign in</button>`;
    if (name === "checkmail") B.innerHTML = `<h1>Confirm your email</h1>${m}<p class="pa-sub">We sent a confirmation link to <b>${esc(msg2)}</b>. Open it, then come back here and sign in. Check your spam folder if it doesn't arrive in a few minutes.</p>
      <button class="pa-btn" id="pa-back">Go to sign in</button>`;
    const go = $("#pa-go"), back = $("#pa-back");
    if (back) back.onclick = () => view("signin");
    const nw = $("#pa-new"); if (nw) nw.onclick = () => view("signup");
    const fg = $("#pa-forgot"); if (fg) fg.onclick = () => view("forgot");
    if (go) {
      const submit = async () => {
        const email = $("#pa-e").value.trim(), pw = $("#pa-p").value;
        if (!email || !pw) return view(name, "Enter your email and password.", "bad");
        go.disabled = true; go.textContent = "Please wait…";
        if (name === "signin") {
          const {error} = await sb.auth.signInWithPassword({email, password: pw});
          if (error) { view("signin", /confirm/i.test(error.message) ? "Confirm your email first: open the link we emailed you." : "Wrong email or password.", "bad"); $("#pa-e").value = email; }
        } else {
          if (pw.length < 8) return view("signup", "Use at least 8 characters for the password.", "bad");
          if (pw !== $("#pa-c").value) return view("signup", "The two passwords don't match.", "bad");
          const {data, error} = await sb.auth.signUp({email, password: pw});
          if (error) return view("signup", error.message, "bad");
          if (data.session) return; // signed in straight away
          msg2 = email; view("checkmail", "Account created.", "ok");
        }
      };
      go.onclick = submit;
      B.querySelectorAll("input").forEach(i => i.onkeydown = e => { if (e.key === "Enter") submit(); });
    }
  }
  let msg2 = "";

  async function loadMember() {
    const {data} = await sb.from("members").select("*").eq("user_id", session.user.id).maybeSingle();
    member = data || {role: "pending", email: session.user.email};
  }
  sb.auth.onAuthStateChange(async (ev, s) => {
    if (s && !session) { session = s; await loadMember(); $("#pf-auth").hidden = true; window.__pfAuthed(); }
    else if (!s && session) { session = null; location.reload(); }
    else if (s) session = s;
  });
  sb.auth.getSession().then(({data}) => { if (!data.session) view("signin"); });
  window.pfSignOut = async () => { await sb.auth.signOut(); location.reload(); };

  /* ---------------- database (document store) ---------------- */
  const splitPath = p => { const parts = String(p).split("/"); return {coll: parts.slice(0, -1).join("/"), id: parts[parts.length - 1]}; };
  const snapDoc = (id, data) => ({id, exists: data !== undefined && data !== null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))), metadata: {fromCache: false, hasPendingWrites: false}});
  const err = (code, message) => ({code, message});
  const wrapErr = e => { const m = (e && e.message) || String(e); return /row-level security|permission|42501/i.test(m) ? err("invalid_argument", "Not allowed for your account.") : /fetch|network|Failed/i.test(m) ? err("unavailable", m) : err("unavailable", m); };
  let chanN = 0;
  function listen(filter, onChange) {
    const ch = sb.channel("pf-" + (++chanN)).on("postgres_changes", {event: "*", schema: "public", table: "docs", filter}, () => onChange()).subscribe();
    return () => sb.removeChannel(ch);
  }
  function docRef(path) {
    const {coll, id} = splitPath(path);
    const ref = {
      id, path,
      async get() { const {data, error} = await sb.from("docs").select("data").eq("path", path).maybeSingle(); if (error) throw wrapErr(error); return snapDoc(id, data ? data.data : null); },
      async set(d) { const {error} = await sb.from("docs").upsert({path, coll, id, data: d}); if (error) throw wrapErr(error); },
      async update(patch) {
        const cur = await ref.get(); if (!cur.exists) throw err("invalid_argument", "Document does not exist");
        const next = {...cur.data(), ...patch};
        const {error} = await sb.from("docs").update({data: next}).eq("path", path); if (error) throw wrapErr(error);
      },
      async delete() { const {error} = await sb.from("docs").delete().eq("path", path); if (error) throw wrapErr(error); },
      onSnapshot(next, onErr) {
        let alive = true;
        const pull = () => ref.get().then(s => alive && next(s), e => alive && onErr && onErr(e));
        pull(); const stop = listen("path=eq." + path, pull);
        return () => { alive = false; stop(); };
      },
      collection: sub => collRef(path + "/" + sub)
    };
    return ref;
  }
  function collRef(coll, opts = {}) {
    const q = {
      path: coll,
      where(f, op, v) { return collRef(coll, {...opts, where: [...(opts.where || []), [f, op, v]]}); },
      orderBy(f, dir) { return collRef(coll, {...opts, order: [f, dir || "asc"]}); },
      limit(n) { return collRef(coll, {...opts, limit: n}); },
      doc: id => docRef(coll + "/" + (id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)))),
      async add(d) { const r = q.doc(); await r.set(d); return r; },
      async get() {
        const {data, error} = await sb.from("docs").select("id,data").eq("coll", coll).limit(5000); if (error) throw wrapErr(error);
        let rows = (data || []).map(r => ({id: r.id, d: r.data}));
        const cmp = {"==": (a, b) => a === b, "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b, "!=": (a, b) => a !== b};
        for (const [f, op, v] of opts.where || []) rows = rows.filter(r => (cmp[op] || cmp["=="])((r.d || {})[f], v));
        if (opts.order) { const [f, dir] = opts.order, s = dir === "desc" ? -1 : 1; rows.sort((a, b) => ((a.d || {})[f] > (b.d || {})[f] ? 1 : (a.d || {})[f] < (b.d || {})[f] ? -1 : 0) * s); }
        if (opts.limit) rows = rows.slice(0, opts.limit);
        const docs = rows.map(r => snapDoc(r.id, r.d));
        return {docs, size: docs.length, empty: !docs.length, metadata: {fromCache: false, hasPendingWrites: false}, docChanges: () => []};
      },
      onSnapshot(next, onErr) {
        let alive = true, t = 0;
        const pull = () => q.get().then(s => alive && next(s), e => alive && onErr && onErr(e));
        const soon = () => { clearTimeout(t); t = setTimeout(pull, 250); };
        pull(); const stop = listen("coll=eq." + coll, soon);
        const poll = setInterval(pull, 60000); // safety net if realtime drops
        return () => { alive = false; stop(); clearInterval(poll); };
      }
    };
    return q;
  }
  const db = {doc: docRef, collection: c => collRef(c)};

  /* ---------------- user ---------------- */
  const user = {
    async id() { return session && session.user.id; },
    async me() { return {id: session.user.id, name: (member && member.label) || session.user.email, avatarUrl: ""}; },
    async isOwner() { return !!member && member.role === "owner"; },
    async canEdit() { return !!member && ["owner", "manager"].includes(member.role); },
    async can() { return true; },
    async profiles(ids) {
      const out = {}; if (!ids || !ids.length) return out;
      const {data} = await sb.from("members").select("user_id,email,label").in("user_id", ids.filter(x => /^[0-9a-f-]{36}$/.test(x)));
      (data || []).forEach(m => { out[m.user_id] = {id: m.user_id, name: m.label ? `${m.label} (${m.email})` : m.email}; });
      return out;
    },
    async search() { return []; }
  };

  /* ---------------- downloads & attachments ---------------- */
  const downloads = {
    async save({filename, data}) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return {status: "saved"};
    }
  };
  const assets = {
    async upload(file) {
      const name = (file.name || "file").replace(/[^\w.-]+/g, "_"), key = `${session.user.id}/${Date.now()}-${name}`;
      const {error} = await sb.storage.from("proofs").upload(key, file, {contentType: file.type || undefined});
      if (error) throw {code: "upload_failed", message: error.message};
      const {data} = await sb.storage.from("proofs").createSignedUrl(key, 60 * 60 * 24 * 365 * 5);
      return {id: key, url: data.signedUrl, sizeBytes: file.size, contentType: file.type};
    },
    async list() { return {assets: [], usage: {}}; },
    async delete(key) { await sb.storage.from("proofs").remove([key]); return {}; }
  };

  const caps = {db, user, downloads, assets};
  window.claude = {use: async name => { await authReady; return caps[name] || null; }};
  window.PF_AUTH_READY = authReady;
})();
