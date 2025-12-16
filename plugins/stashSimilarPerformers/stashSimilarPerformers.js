(() => {
  "use strict";

  const GRAPHQL = "/graphql";
  const PLUGIN_ID = "stashSimilarPerformers";

  /* ============================
     Constants
     ============================ */
  const PER_PAGE_DEFAULT = -1;

  const HEIGHT_MAX_DIFF = 12;
  const BAND_MAX_DIFF = 6;
  const WAIST_MAX_DIFF = 6;
  const HIPS_MAX_DIFF = 8;
  const CUP_MAX_DIFF = 4;

  const SETTINGS_PANEL_WIDTH = 260;
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

    performerResults: 12,
    pageLimit: -1
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
      console.error("[Similar Performers]", json.errors);
      return null;
    }
    return json.data;
  }

  /* ============================
     Plugin settings
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

  async function saveSettings(settings) {
    const clean = {};
    for (const k of SETTINGS_KEYS) clean[k] = settings[k];
    return gql(SAVE_SETTINGS, { plugin_id: PLUGIN_ID, input: clean });
  }

  /* ============================
     Queries
     ============================ */
  const GET_PERFORMER = `
    query ($id: ID!) {
      findPerformer(id: $id) {
        id name favorite ethnicity eye_color hair_color
        height_cm measurements fake_tits
      }
    }
  `;

  const FIND_PERFORMERS = `
    query ($perPage: Int!) {
      findPerformers(filter: { per_page: $perPage }) {
        performers {
          id name image_path favorite ethnicity eye_color hair_color
          height_cm measurements fake_tits
        }
      }
    }
  `;

  /* ============================
     Helpers
     ============================ */
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clamp01 = n => clamp(n, 0, 1);

  const similarity = (diff, max) =>
    diff == null ? 0 : clamp01(1 - diff / max);

  function normalizeFakeTits(v) {
    if (v == null) return null;
    const s = String(v).toLowerCase();
    if (s.includes("natural")) return false;
    if (s.includes("fake") || s.includes("implant")) return true;
    return null;
  }

  function parseMeasurements(m) {
    if (!m) return null;
    const match = String(m).match(/(\d+)\s*([A-Z]+)?(?:-(\d+))?(?:-(\d+))?/i);
    if (!match) return null;
    return {
      band: match[1] ? Number(match[1]) : null,
      cup: match[2] || null,
      waist: match[3] ? Number(match[3]) : null,
      hips: match[4] ? Number(match[4]) : null
    };
  }

  const cupIndex = c =>
    c ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(String(c).toUpperCase()) : null;

  /* ============================
     Distance-based scoring
     ============================ */
  function scorePerformer(p, base, s) {
    let score = 0;
    const reasons = [];

    const add = (label, sim, weight, variance = "") => {
      const pts = Math.round(sim * weight);
      if (!pts) return;
      score += pts;
      reasons.push(
        `${label}: +${pts}/${weight} (${Math.round(sim * 100)}%)${variance ? ` — ${variance}` : ""}`
      );
    };

    if (p.favorite) add("Favorite", 1, s.favoriteWeight);
    if (p.ethnicity === base.ethnicity) add("Ethnicity", 1, s.ethnicityWeight);
    if (p.hair_color === base.hair_color) add("Hair", 1, s.hairColorWeight);
    if (p.eye_color === base.eye_color) add("Eyes", 1, s.eyeColorWeight);

    if (p.height_cm && base.height_cm) {
      const d = Math.abs(p.height_cm - base.height_cm);
      add("Height", similarity(d, HEIGHT_MAX_DIFF), s.heightWeight, `Δ ${d}cm`);
    }

    const bm = parseMeasurements(base.measurements);
    const cm = parseMeasurements(p.measurements);

    if (bm && cm) {
      if (bm.band && cm.band) {
        const d = Math.abs(bm.band - cm.band);
        add("Bust", similarity(d, BAND_MAX_DIFF), s.bustBandWeight, `Δ ${d}"`);
      }

      const bi = cupIndex(bm.cup);
      const ci = cupIndex(cm.cup);
      if (bi != null && ci != null) {
        const d = Math.abs(bi - ci);
        add("Cup", similarity(d, CUP_MAX_DIFF), s.cupWeight, `Δ ${d}`);
      }

      if (bm.waist && cm.waist) {
        const d = Math.abs(bm.waist - cm.waist);
        add("Waist", similarity(d, WAIST_MAX_DIFF), s.waistWeight, `Δ ${d}"`);
      }

      if (bm.hips && cm.hips) {
        const d = Math.abs(bm.hips - cm.hips);
        add("Hips", similarity(d, HIPS_MAX_DIFF), s.hipsWeight, `Δ ${d}"`);
      }
    }

    const bf = normalizeFakeTits(base.fake_tits);
    const cf = normalizeFakeTits(p.fake_tits);
    if (bf != null && bf === cf) add("Enhancement", 1, s.fakeTitsWeight);

    return { score, reasons };
  }

  /* ============================
     Card UI
     ============================ */
  function createCard(p, a, isTop) {
    const el = document.createElement("a");
    el.href = `/performers/${p.id}`;
    el.className = "similar-performer-card" + (isTop ? " top-match" : "");
    el.title = a.reasons.join("\n");

    el.innerHTML = `
      <div class="similar-performer-thumb">
        ${p.image_path ? `<img loading="lazy" src="${p.image_path}">` : ""}
        <div class="similar-performer-score">${a.score}</div>
      </div>
      <div class="similar-performer-meta">
        <div class="similar-performer-name">${p.name}${p.favorite ? " ⭐" : ""}</div>
      </div>
    `;
    return el;
  }

  /* ============================
     Settings menu
     ============================ */
  function openSettingsMenu(anchor, settings, rerender) {
    if (document.querySelector(".similar-performers-settings")) return;

    const panel = document.createElement("div");
    panel.className = "similar-performers-settings";
    panel.style.cssText = `
      position: fixed;
      top: ${anchor.getBoundingClientRect().bottom + 6}px;
      left: ${Math.max(8, anchor.getBoundingClientRect().right - SETTINGS_PANEL_WIDTH)}px;
      width: ${SETTINGS_PANEL_WIDTH}px;
      background:#181818;border:1px solid #333;padding:8px;
      z-index:9999;border-radius:6px;font-size:11px
    `;

    panel.innerHTML = `
      <strong>Similarity Settings</strong>
      ${SETTINGS_KEYS.map(k => `
        <div style="margin:6px 0">
          <label style="display:flex;justify-content:space-between">
            <span>${k}</span>
            <input type="number" data-k="${k}" value="${settings[k]}" style="width:64px">
          </label>
        </div>
      `).join("")}
      <div style="text-align:right">
        <button data-close>Close</button>
      </div>
    `;

    panel.addEventListener("input", e => {
      const k = e.target.dataset.k;
      if (!k) return;
      settings[k] = Number(e.target.value);
      rerender();
      saveSettings(settings);
    });

    panel.querySelector("[data-close]").onclick = () => panel.remove();
    document.body.appendChild(panel);
  }

  /* ============================
     Init
     ============================ */
  let lastId = null;

  async function init() {
    const id = location.pathname.match(/\/performers\/(\d+)/)?.[1];
    if (!id || id === lastId) return;
    lastId = id;

    document
      .querySelectorAll('[data-rb-event-key="similar-performers-panel"]')
      .forEach(el => el.remove());

    const settings = await loadSettings();
    const base = (await gql(GET_PERFORMER, { id }))?.findPerformer;
    if (!base) return;

    const tabs = document.querySelector(".performer-tabs .nav-tabs");
    const content = document.querySelector(".performer-tabs .tab-content");

    const nav = document.createElement("a");
    nav.className = "nav-item nav-link";
    nav.textContent = "Similar Performers ⚙️";
    nav.dataset.rbEventKey = "similar-performers-panel";
    nav.oncontextmenu = e => {
      e.preventDefault();
      openSettingsMenu(nav, settings, render);
    };

    const panel = document.createElement("div");
    panel.className = "tab-pane fade";
    panel.dataset.rbEventKey = "similar-performers-panel";
    panel.innerHTML = `<div class="similar-performers-grid"></div>`;

    nav.onclick = e => {
      e.preventDefault();
      tabs.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
      content.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active","show"));
      nav.classList.add("active");
      panel.classList.add("active","show");
    };

    tabs.appendChild(nav);
    content.appendChild(panel);

    const grid = panel.querySelector(".similar-performers-grid");
    const data = await gql(FIND_PERFORMERS, { perPage: settings.pageLimit ?? -1 });
    const list = data?.findPerformers?.performers || [];

    function render() {
      grid.innerHTML = "";
      list
        .filter(p => p.id !== base.id)
        .map(p => ({ p, a: scorePerformer(p, base, settings) }))
        .filter(x => x.a.score > 0)
        .sort((a, b) => b.a.score - a.a.score)
        .slice(0, clamp(settings.performerResults, 1, 100))
        .forEach((e, i) => grid.appendChild(createCard(e.p, e.a, i === 0)));
    }

    render();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastId = null;
      init();
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
