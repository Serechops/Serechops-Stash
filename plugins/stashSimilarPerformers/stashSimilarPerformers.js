(() => {
  "use strict";

  const GRAPHQL = "/graphql";
  const PLUGIN_ID = "stashSimilarPerformers";

  /* ============================
     Constants
     ============================ */
  const PER_PAGE = 250;

  // Distance caps (diff >= cap => similarity 0 for that metric)
  const HEIGHT_MAX_DIFF = 12; // cm
  const BAND_MAX_DIFF = 6;    // inches
  const WAIST_MAX_DIFF = 6;   // inches
  const HIPS_MAX_DIFF = 8;    // inches
  const CUP_MAX_DIFF = 4;     // letter steps

  const SETTINGS_PANEL_WIDTH = 240;

  const RESCORE_DEBOUNCE_MS = 120;
  const AUTOSAVE_DEBOUNCE_MS = 700;

  const DEFAULT_WEIGHTS = {
    favoriteWeight: 120,
    ethnicityWeight: 80,
    hairColorWeight: 45,
    eyeColorWeight: 35,
    heightWeight: 30,
    bustBandWeight: 30,
    cupWeight: 25,
    waistWeight: 25,
    hipsWeight: 25,
    fakeTitsWeight: 30,

    // control
    performerResults: 12
  };

  const SETTINGS_KEYS = Object.keys(DEFAULT_WEIGHTS);

  /* ============================
     GraphQL helper
     ============================ */
  async function gql(query, variables = {}) {
    const res = await fetch(GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    if (json.errors) {
      console.error("[Similar Performers] GraphQL error:", json.errors);
      return null;
    }
    return json.data;
  }

  /* ============================
     Plugin settings (persisted)
     ============================ */
  const GET_SETTINGS = `
    query {
      configuration {
        plugins(include: ["${PLUGIN_ID}"])
      }
    }
  `;

  const SAVE_SETTINGS = `
    mutation ConfigurePlugin($plugin_id: ID!, $input: Map!) {
      configurePlugin(plugin_id: $plugin_id, input: $input)
    }
  `;

  async function loadSettings() {
    const data = await gql(GET_SETTINGS);
    const saved = data?.configuration?.plugins?.[PLUGIN_ID] ?? {};
    const merged = { ...DEFAULT_WEIGHTS };
    for (const k of SETTINGS_KEYS) {
      const v = Number(saved[k]);
      if (Number.isFinite(v)) merged[k] = v;
    }
    return merged;
  }

  async function saveSettings(input) {
    // Only persist keys we own
    const clean = {};
    for (const k of SETTINGS_KEYS) {
      if (k in input) clean[k] = input[k];
    }
    return gql(SAVE_SETTINGS, { plugin_id: PLUGIN_ID, input: clean });
  }

  /* ============================
     Queries
     ============================ */
  const GET_PERFORMER = `
    query ($id: ID!) {
      findPerformer(id: $id) {
        id
        name
        favorite
        ethnicity
        eye_color
        hair_color
        height_cm
        measurements
        fake_tits
      }
    }
  `;

  const FIND_PERFORMERS_PAGE = `
    query ($page: Int!, $perPage: Int!) {
      findPerformers(filter: { page: $page, per_page: $perPage }) {
        performers {
          id
          name
          image_path
          favorite
          ethnicity
          eye_color
          hair_color
          height_cm
          measurements
          fake_tits
        }
      }
    }
  `;

  /* ============================
     Helpers
     ============================ */
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = n => clamp(n, 0, 1);

  function debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  // similarity in [0..1], linear falloff to 0 at maxDiff
  const similarity = (diff, maxDiff) => {
    if (diff == null || !Number.isFinite(diff)) return 0;
    return clamp01(1 - diff / maxDiff);
  };

  function normalizeFakeTits(v) {
    if (v == null) return null;
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    if (s.includes("natural")) return false;
    if (s.includes("fake") || s.includes("implant") || s.includes("enhanc")) return true;
    return null;
  }

  function parseMeasurements(m) {
    if (!m) return null;
    // Examples: 34D-24-36, 32C, 36DD-26-38
    const match = String(m).match(/(\d+)\s*([A-Z]+)?(?:-(\d+))?(?:-(\d+))?/i);
    if (!match) return null;
    return {
      band: match[1] ? Number(match[1]) : null,
      cup: match[2] || null,
      waist: match[3] ? Number(match[3]) : null,
      hips: match[4] ? Number(match[4]) : null
    };
  }

  const cupIndex = c => (c ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(String(c).toUpperCase()) : null);

  /* ============================
     Distance-Based Scoring
     ============================ */
  function scorePerformer(p, base, s) {
    let score = 0;
    const reasons = [];

    const add = (label, sim, weight, varianceText = "") => {
      // Show non-redundant info: per-weight points + variance detail
      const pts = Math.round(sim * weight);
      if (pts === 0) return;
      score += pts;
      const pct = Math.round(sim * 100);
      reasons.push(`${label}: +${pts}/${weight} (${pct}%)${varianceText ? ` — ${varianceText}` : ""}`);
    };

    // Exact-match traits (either 0% or 100%)
    if (p.favorite) add("Favorite", 1, s.favoriteWeight);
    if (p.ethnicity && base.ethnicity && p.ethnicity === base.ethnicity) add("Ethnicity", 1, s.ethnicityWeight);
    if (p.hair_color && base.hair_color && p.hair_color === base.hair_color) add("Hair", 1, s.hairColorWeight);
    if (p.eye_color && base.eye_color && p.eye_color === base.eye_color) add("Eyes", 1, s.eyeColorWeight);

    // Height distance
    if (p.height_cm && base.height_cm) {
      const d = Math.abs(p.height_cm - base.height_cm);
      add("Height", similarity(d, HEIGHT_MAX_DIFF), s.heightWeight, `Δ ${d}cm`);
    }

    // Measurements distance
    const bm = parseMeasurements(base.measurements);
    const cm = parseMeasurements(p.measurements);

    if (bm && cm) {
      if (bm.band != null && cm.band != null) {
        const d = Math.abs(bm.band - cm.band);
        add("Bust band", similarity(d, BAND_MAX_DIFF), s.bustBandWeight, `Δ ${d}"`);
      }

      const bi = cupIndex(bm.cup);
      const ci = cupIndex(cm.cup);
      if (bi != null && ci != null && bi >= 0 && ci >= 0) {
        const d = Math.abs(bi - ci);
        add("Cup", similarity(d, CUP_MAX_DIFF), s.cupWeight, `Δ ${d}`);
      }

      if (bm.waist != null && cm.waist != null) {
        const d = Math.abs(bm.waist - cm.waist);
        add("Waist", similarity(d, WAIST_MAX_DIFF), s.waistWeight, `Δ ${d}"`);
      }

      if (bm.hips != null && cm.hips != null) {
        const d = Math.abs(bm.hips - cm.hips);
        add("Hips", similarity(d, HIPS_MAX_DIFF), s.hipsWeight, `Δ ${d}"`);
      }
    }

    // Enhancement exact-match
    const bf = normalizeFakeTits(base.fake_tits);
    const cf = normalizeFakeTits(p.fake_tits);
    if (bf != null && cf != null && bf === cf) add("Enhancement", 1, s.fakeTitsWeight);

    return { score, reasons };
  }

  /* ============================
     Card UI
     ============================ */
  function createCard(p, analysis, isTop) {
    const a = document.createElement("a");
    a.href = `/performers/${p.id}`;
    a.className = "similar-performer-card" + (isTop ? " top-match" : "");
    a.title = analysis.reasons.join("\n");

    a.innerHTML = `
      <div class="similar-performer-thumb">
        ${p.image_path ? `<img loading="lazy" src="${p.image_path}">` : ""}
        <div class="similar-performer-score">${analysis.score}</div>
      </div>
      <div class="similar-performer-meta">
        <div class="similar-performer-name">${p.name}${p.favorite ? " ⭐" : ""}</div>
      </div>
    `;
    return a;
  }

  /* ============================
     Settings Menu (Right-click)
     ============================ */
  function openSettingsMenu(anchor, settings, onRescore, onSaveNow) {
    if (document.querySelector(".similar-performers-settings")) return;

    const rect = anchor.getBoundingClientRect();
    const panel = document.createElement("div");
    panel.className = "similar-performers-settings";
    panel.style.cssText = `
      position: fixed;
      top: ${rect.bottom + 6}px;
      left: ${Math.max(8, rect.right - SETTINGS_PANEL_WIDTH)}px;
      width: ${SETTINGS_PANEL_WIDTH}px;
      max-height: 40vh;
      overflow-y: auto;
      background: #181818;
      border: 1px solid #333;
      padding: 8px;
      z-index: 9999;
      font-size: 11px;
      border-radius: 6px;
      box-shadow: 0 8px 22px rgba(0,0,0,0.45);
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong>Similarity Settings</strong>
        <span data-status style="opacity:0.6"></span>
      </div>
      ${SETTINGS_KEYS.map(k => `
        <div style="margin:8px 0">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <span style="opacity:0.95">${k}</span>
            <input type="number" data-num="${k}" value="${settings[k]}" style="width:68px">
          </div>
          <input
            type="range"
            data-key="${k}"
            min="${k === "performerResults" ? 1 : 0}"
            max="${k === "performerResults" ? 100 : 200}"
            value="${settings[k]}"
            style="width:100%"
          >
        </div>
      `).join("")}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button data-act="reset">↺</button>
        <button data-act="save">💾</button>
        <button data-act="close">✕</button>
      </div>
    `;

    const status = panel.querySelector("[data-status]");
    const setStatus = t => (status.textContent = t || "");

    const debRescore = debounce(() => onRescore(), RESCORE_DEBOUNCE_MS);
    const debSave = debounce(async () => {
      setStatus("saving…");
      await onSaveNow(false);
      setStatus("saved");
    }, AUTOSAVE_DEBOUNCE_MS);

    panel.addEventListener("input", e => {
      const k = e.target.dataset.key || e.target.dataset.num;
      if (!k) return;

      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;

      settings[k] = k === "performerResults" ? clamp(v, 1, 100) : v;

      panel
        .querySelectorAll(`[data-key="${k}"],[data-num="${k}"]`)
        .forEach(el => (el.value = settings[k]));

      setStatus("…");
      debRescore();
      debSave();
    });

    panel.addEventListener("click", async e => {
      const act = e.target.dataset.act;
      if (!act) return;

      if (act === "reset") {
        Object.assign(settings, DEFAULT_WEIGHTS);
        setStatus("saving…");
        await onSaveNow(true);
        setStatus("saved");
        onRescore();
        panel.remove();
        openSettingsMenu(anchor, settings, onRescore, onSaveNow);
      }

      if (act === "save") {
        setStatus("saving…");
        await onSaveNow(true);
        setStatus("saved");
      }

      if (act === "close") panel.remove();
    });

    document.body.appendChild(panel);
  }

  /* ============================
     Tab injection
     ============================ */
  function injectTab(settings, onOpenSettings) {
    const existing = document.querySelector('[data-rb-event-key="similar-performers-panel"]');
    if (existing) return document.querySelector(".similar-performers-grid");

    const tabs = document.querySelector(".performer-tabs .nav-tabs");
    const content = document.querySelector(".performer-tabs .tab-content");
    if (!tabs || !content) return null;

    const nav = document.createElement("a");
    nav.className = "nav-item nav-link";
    nav.dataset.rbEventKey = "similar-performers-panel";
    nav.href = "#";
    nav.style.cursor = "pointer";
    nav.textContent = "Similar Performers ⚙️";
    nav.title = "Right-click for settings";

    const panel = document.createElement("div");
    panel.className = "tab-pane fade";
    panel.dataset.rbEventKey = "similar-performers-panel";
    panel.innerHTML = `<div class="similar-performers-grid"></div>`;

    // Only handle OUR tab click (doesn't interfere with Stash's other tabs)
    nav.addEventListener("click", e => {
      e.preventDefault();
      tabs.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
      content.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active", "show"));
      nav.classList.add("active");
      panel.classList.add("active", "show");
    });

    nav.addEventListener("contextmenu", e => {
      e.preventDefault();
      onOpenSettings(nav);
    });

    tabs.appendChild(nav);
    content.appendChild(panel);

    return panel.querySelector(".similar-performers-grid");
  }

  /* ============================
     Main
     ============================ */
  let lastPerformerId = null;

  async function init() {
    const id = location.pathname.match(/\/performers\/(\d+)/)?.[1];
    if (!id) return;

    // prevent duplicate runs for same performer
    if (id === lastPerformerId) return;
    lastPerformerId = id;

    // clear any stray settings panels
    document.querySelectorAll(".similar-performers-settings").forEach(el => el.remove());

    const settings = await loadSettings();

    const base = (await gql(GET_PERFORMER, { id }))?.findPerformer;
    if (!base) return;

    const grid = injectTab(settings, (navEl) => {
      openSettingsMenu(
        navEl,
        settings,
        () => render(),               // rescore/rerender
        async () => saveSettings(settings) // autosave + manual save
      );
    });

    if (!grid) return;

    // fetch performers once per init
    const page1 = await gql(FIND_PERFORMERS_PAGE, { page: 1, perPage: PER_PAGE });
    const list = page1?.findPerformers?.performers || [];

    function render() {
      const limit = clamp(Number(settings.performerResults) || DEFAULT_WEIGHTS.performerResults, 1, 100);

      grid.innerHTML = "";
      list
        .filter(p => p.id !== base.id)
        .map(p => ({ p, a: scorePerformer(p, base, settings) }))
        .filter(x => x.a.score > 0)
        .sort((a, b) => b.a.score - a.a.score)
        .slice(0, limit)
        .forEach((e, i) => grid.appendChild(createCard(e.p, e.a, i === 0)));
    }

    render();
  }

  /* ============================
     SPA observer
     ============================ */
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastPerformerId = null;

      document
        .querySelectorAll('[data-rb-event-key="similar-performers-panel"],.similar-performers-settings')
        .forEach(el => el.remove());

      init();
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
