(() => {
  const config = window.HALLOWEEN_CONFIG || {};
  const hasSupabaseConfig = config.supabaseUrl?.startsWith("https://") && config.supabaseAnonKey && !config.supabaseAnonKey.includes("INCOLLA_QUI");
  const pinStorageKey = "notte-delle-maschere-admin-pin";
  const photoBucket = "costume-photos";

  const loginPanel = document.querySelector("#login-panel");
  const adminPanel = document.querySelector("#admin-panel");
  const pinInput = document.querySelector("#pin-input");
  const loginButton = document.querySelector("#login-button");
  const loginMessage = document.querySelector("#login-message");
  const logoutButton = document.querySelector("#logout-button");
  const statusPill = document.querySelector("#status-pill");
  const closeNowButton = document.querySelector("#close-now");
  const reopenButton = document.querySelector("#reopen");
  const closesAtInput = document.querySelector("#closes-at-input");
  const setTimerButton = document.querySelector("#set-timer");
  const clearTimerButton = document.querySelector("#clear-timer");
  const settingsMessage = document.querySelector("#settings-message");
  const contestantList = document.querySelector("#contestant-list");
  const entrantCount = document.querySelector("#entrant-count");

  if (!hasSupabaseConfig) {
    loginMessage.textContent = "Manca la configurazione di Supabase in config.js.";
    loginMessage.style.color = "#b63b21";
    loginButton.disabled = true;
    return;
  }

  const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  let pin = sessionStorage.getItem(pinStorageKey) || "";
  let contestants = [];
  let settings = { voting_closed: false, closes_at: null };
  let channel = null;

  function say(el, message, isError = false) {
    el.textContent = message;
    el.style.color = isError ? "#b63b21" : "var(--muted, #6a6c5f)";
  }

  function safePhotoUrl(url) {
    if (typeof url !== "string") return null;
    return url.startsWith(`${config.supabaseUrl}/storage/v1/object/public/${photoBucket}/`) ? url : null;
  }

  function localInputValue(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  async function callAdmin(fn, params = {}) {
    const { error } = await client.rpc(fn, { pin, ...params });
    if (error) throw error;
  }

  async function loadEverything() {
    const [c, s] = await Promise.all([
      client.from("contestants").select("id, name, costume, vote_count, photo_url").order("created_at"),
      client.from("contest_settings").select("voting_closed, closes_at").eq("id", true).single(),
    ]);
    if (c.error) throw c.error;
    if (s.error) throw s.error;
    contestants = c.data;
    settings = s.data;
    renderSettings();
    renderContestants();
  }

  function renderSettings() {
    const timeUp = settings.closes_at && Date.now() >= new Date(settings.closes_at).getTime();
    const closed = settings.voting_closed || timeUp;
    statusPill.textContent = closed ? "VOTO CHIUSO" : "VOTO APERTO";
    statusPill.classList.toggle("closed", closed);
    if (document.activeElement !== closesAtInput) {
      closesAtInput.value = localInputValue(settings.closes_at);
    }
  }

  function renderContestants() {
    entrantCount.textContent = `${contestants.length} iscritt${contestants.length === 1 ? "o" : "i"}`;
    contestantList.innerHTML = "";
    const sorted = [...contestants].sort((a, b) => b.vote_count - a.vote_count);
    for (const person of sorted) {
      const li = document.createElement("li");

      const url = safePhotoUrl(person.photo_url);
      const thumb = document.createElement(url ? "img" : "div");
      thumb.className = url ? "c-thumb" : "c-thumb empty";
      if (url) { thumb.src = url; thumb.alt = ""; thumb.loading = "lazy"; }
      else thumb.textContent = "✳";

      const info = document.createElement("div");
      info.className = "c-info";
      const name = document.createElement("b");
      name.textContent = person.name;
      const costume = document.createElement("span");
      costume.textContent = person.costume;
      info.append(name, costume);

      const count = document.createElement("div");
      count.className = "c-count";
      count.textContent = `${person.vote_count} voti`;

      const actions = document.createElement("div");
      actions.className = "c-actions";
      const zeroBtn = document.createElement("button");
      zeroBtn.type = "button"; zeroBtn.className = "zero"; zeroBtn.textContent = "Azzera voti";
      zeroBtn.onclick = () => resetVotes(person);
      const delBtn = document.createElement("button");
      delBtn.type = "button"; delBtn.className = "del"; delBtn.textContent = "Elimina";
      delBtn.onclick = () => removeContestant(person);
      actions.append(zeroBtn, delBtn);

      li.append(thumb, info, count, actions);
      contestantList.append(li);
    }
  }

  async function resetVotes(person) {
    if (!confirm(`Azzerare i voti di "${person.costume}"?`)) return;
    try {
      await callAdmin("admin_reset_vote", { contestant: person.id });
      await loadEverything();
    } catch (error) {
      alert("Non riesco ad azzerare i voti: " + (error.message || "riprova."));
    }
  }

  async function removeContestant(person) {
    if (!confirm(`Eliminare "${person.name} — ${person.costume}"? Non si può annullare.`)) return;
    try {
      await callAdmin("admin_delete_contestant", { contestant: person.id });
      await loadEverything();
    } catch (error) {
      alert("Non riesco a eliminare: " + (error.message || "riprova."));
    }
  }

  async function tryLogin(candidatePin) {
    pin = candidatePin;
    try {
      await client.rpc("admin_check", { pin });
    } catch (error) {
      say(loginMessage, "PIN errato.", true);
      pin = "";
      return;
    }
    sessionStorage.setItem(pinStorageKey, pin);
    loginPanel.hidden = true;
    adminPanel.hidden = false;
    await loadEverything();
    subscribeRealtime();
  }

  function subscribeRealtime() {
    if (channel) return;
    channel = client
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "contestants" }, loadEverything)
      .on("postgres_changes", { event: "*", schema: "public", table: "contest_settings" }, loadEverything)
      .subscribe();
  }

  loginButton.addEventListener("click", () => {
    const value = pinInput.value.trim();
    if (!value) return;
    say(loginMessage, "Verifica in corso...");
    tryLogin(value);
  });
  pinInput.addEventListener("keydown", (event) => { if (event.key === "Enter") loginButton.click(); });

  logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem(pinStorageKey);
    pin = "";
    if (channel) { client.removeChannel(channel); channel = null; }
    adminPanel.hidden = true;
    loginPanel.hidden = false;
    pinInput.value = "";
    pinInput.focus();
  });

  closeNowButton.addEventListener("click", async () => {
    try {
      await callAdmin("admin_set_closing", { closed: true, new_closes_at: settings.closes_at });
      say(settingsMessage, "Voto chiuso.");
      await loadEverything();
    } catch (error) { say(settingsMessage, "Errore: " + (error.message || "riprova."), true); }
  });

  reopenButton.addEventListener("click", async () => {
    try {
      await callAdmin("admin_set_closing", { closed: false, new_closes_at: settings.closes_at });
      say(settingsMessage, "Voto riaperto.");
      await loadEverything();
    } catch (error) { say(settingsMessage, "Errore: " + (error.message || "riprova."), true); }
  });

  setTimerButton.addEventListener("click", async () => {
    if (!closesAtInput.value) { say(settingsMessage, "Scegli prima data e ora.", true); return; }
    const iso = new Date(closesAtInput.value).toISOString();
    try {
      await callAdmin("admin_set_closing", { closed: settings.voting_closed, new_closes_at: iso });
      say(settingsMessage, "Orario di chiusura impostato.");
      await loadEverything();
    } catch (error) { say(settingsMessage, "Errore: " + (error.message || "riprova."), true); }
  });

  clearTimerButton.addEventListener("click", async () => {
    try {
      await callAdmin("admin_set_closing", { closed: settings.voting_closed, new_closes_at: null });
      closesAtInput.value = "";
      say(settingsMessage, "Orario rimosso.");
      await loadEverything();
    } catch (error) { say(settingsMessage, "Errore: " + (error.message || "riprova."), true); }
  });

  if (pin) tryLogin(pin);
})();
