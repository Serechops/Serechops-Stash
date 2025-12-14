(() => {
  "use strict";

  const GRAPHQL = "/graphql";

  /* ============================
     Configuration
     ============================ */
  const TARGET_PERFORMERS = 12;
  const QUERY_LIMIT = 250;

  const AGE_WINDOW_YEARS = 5;
  const HEIGHT_WINDOW_CM = 7;
  const WEIGHT_WINDOW_KG = 6;

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
     Queries
     ============================ */
  const GET_PERFORMER = `
    query ($id: ID!) {
      findPerformer(id: $id) {
        id
        name
        favorite
        gender
        ethnicity
        country
        eye_color
        hair_color
        height_cm
        birthdate
        measurements
        fake_tits
        weight
      }
    }
  `;

  const FIND_PERFORMERS = `
    query ($limit: Int!) {
      findPerformers(filter: { per_page: $limit }) {
        performers {
          id
          name
          image_path
          favorite
          gender
          ethnicity
          country
          eye_color
          hair_color
          height_cm
          birthdate
          measurements
          fake_tits
          weight
        }
      }
    }
  `;

  /* ============================
     Helpers
     ============================ */
  function parseBirthdate(b) {
    if (!b) return null;
    const d = new Date(b);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function ageYearsFromBirthdate(b) {
    const d = parseBirthdate(b);
    if (!d) return null;
    return (Date.now() - d.getTime()) / (365.2425 * 864e5);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* ============================
     Weight normalization
     ============================ */
  function normalizeWeightKg(w) {
    if (w == null) return null;

    if (typeof w === "number") {
      // heuristic: numbers > 150 are almost certainly lbs in this dataset
      return w > 150 ? w * 0.453592 : w;
    }

    if (typeof w === "string") {
      const s = w.trim().toLowerCase();
      // Extract first number
      const num = Number((s.match(/(\d+(\.\d+)?)/) || [])[1]);
      if (!Number.isFinite(num)) return null;

      if (s.includes("lb")) return num * 0.453592;
      if (s.includes("kg")) return num;
      // heuristic fallback
      return num > 150 ? num * 0.453592 : num;
    }

    return null;
  }

  /* ============================
     fake_tits normalization
     ============================ */
  // Returns: true = enhanced/fake, false = natural, null = unknown
  function normalizeFakeTits(v) {
    if (v == null) return null;

    if (typeof v === "boolean") return v;

    if (typeof v === "number") {
      // 1/0 style
      if (v === 1) return true;
      if (v === 0) return false;
      return null;
    }

    if (typeof v === "string") {
      const s = v.trim().toLowerCase();

      // Common Stash enums/labels
      if (s === "fake" || s === "enhanced" || s === "implants" || s === "yes" || s === "true") return true;
      if (s === "natural" || s === "no" || s === "false") return false;

      // Some installs store as "FAKE_TITS_FAKE" / "FAKE_TITS_NATURAL" or similar
      if (s.includes("natural")) return false;
      if (s.includes("fake") || s.includes("enhanc") || s.includes("implant")) return true;

      return null;
    }

    return null;
  }

  function fakeTitsLabel(norm) {
    if (norm === true) return "Enhanced";
    if (norm === false) return "Natural";
    return "Unknown";
  }

  /* ============================
     Measurements parsing
     ============================ */
  function normalizeInches(val, isMetric) {
    return isMetric ? val / 2.54 : val;
  }

  function parseMeasurements(m) {
    if (!m || typeof m !== "string") return null;

    // Heuristic: if it contains "cm" OR first number looks like cm sizing (e.g. 85-60-90)
    const firstNum = Number((m.match(/(\d+)/) || [])[1]);
    const metric = m.toLowerCase().includes("cm") || (Number.isFinite(firstNum) && firstNum > 60);

    // Examples: 34D-24-36, 32C, 36DD-26-38, 85-60-90cm
    const match = m.match(/(\d+)\s*([A-Z]+)?(?:-(\d+))?(?:-(\d+))?/i);
    if (!match) return null;

    return {
      band: match[1] ? normalizeInches(Number(match[1]), metric) : null,
      cup: match[2] || null,
      waist: match[3] ? normalizeInches(Number(match[3]), metric) : null,
      hips: match[4] ? normalizeInches(Number(match[4]), metric) : null
    };
  }

  function cupIndex(cup) {
    if (!cup) return null;
    return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(cup.toUpperCase());
  }

  /* ============================
     Scoring
     ============================ */
  function scorePerformer(candidate, base) {
    let score = 0;
    const reasons = [];

    if (candidate.favorite) {
      score += 100;
      reasons.push("⭐ Favorite performer");
    }

    if (candidate.ethnicity && base.ethnicity && candidate.ethnicity === base.ethnicity) {
      score += 40;
      reasons.push("Same ethnicity");
    }

    if (candidate.hair_color && base.hair_color && candidate.hair_color === base.hair_color) {
      score += 30;
      reasons.push("Same hair color");
    }

    if (candidate.eye_color && base.eye_color && candidate.eye_color === base.eye_color) {
      score += 25;
      reasons.push("Same eye color");
    }

    if (candidate.country && base.country && candidate.country === base.country) {
      score += 20;
      reasons.push("Same country");
    }

    /* Height */
    if (typeof base.height_cm === "number" && typeof candidate.height_cm === "number") {
      const diff = Math.abs(candidate.height_cm - base.height_cm);
      if (diff <= HEIGHT_WINDOW_CM) {
        const pts = Math.round(22 * clamp(1 - diff / HEIGHT_WINDOW_CM, 0, 1));
        score += pts;
        reasons.push(`Height within ${diff} cm`);
      }
    }

    /* Age */
    const baseAge = ageYearsFromBirthdate(base.birthdate);
    const candAge = ageYearsFromBirthdate(candidate.birthdate);
    if (baseAge != null && candAge != null) {
      const diff = Math.abs(candAge - baseAge);
      if (diff <= AGE_WINDOW_YEARS) {
        const pts = Math.round(35 * clamp(1 - diff / AGE_WINDOW_YEARS, 0, 1));
        score += pts;
        reasons.push(`Age within ${diff.toFixed(1)} years`);
      }
    }

    /* Weight */
    const bw = normalizeWeightKg(base.weight);
    const cw = normalizeWeightKg(candidate.weight);
    if (bw != null && cw != null) {
      const diff = Math.abs(bw - cw);
      if (diff <= WEIGHT_WINDOW_KG) {
        const pts = Math.round(18 * clamp(1 - diff / WEIGHT_WINDOW_KG, 0, 1));
        score += pts;
        reasons.push(`Weight within ${diff.toFixed(1)} kg`);
      }
    }

    /* Measurements */
    const bm = parseMeasurements(base.measurements);
    const cm = parseMeasurements(candidate.measurements);

    if (bm && cm) {
      if (bm.band && cm.band) {
        const diff = Math.abs(bm.band - cm.band);
        if (diff <= 2) {
          score += 10;
          reasons.push(`Bust band within ${diff.toFixed(1)}"`);
        }
      }

      const bi = cupIndex(bm.cup);
      const ci = cupIndex(cm.cup);
      if (bi != null && ci != null) {
        const diff = Math.abs(bi - ci);
        if (diff === 0) {
          score += 10;
          reasons.push("Same cup size");
        } else if (diff === 1) {
          score += 5;
          reasons.push("Similar cup size");
        }
      }

      if (bm.waist && cm.waist) {
        const diff = Math.abs(bm.waist - cm.waist);
        if (diff <= 2) {
          score += 8;
          reasons.push(`Waist within ${diff.toFixed(1)}"`);
        }
      }

      if (bm.hips && cm.hips) {
        const diff = Math.abs(bm.hips - cm.hips);
        if (diff <= 3) {
          score += 8;
          reasons.push(`Hips within ${diff.toFixed(1)}"`);
        }
      }
    }

    /* Fake tits (fixed) */
    const bFT = normalizeFakeTits(base.fake_tits);
    const cFT = normalizeFakeTits(candidate.fake_tits);
    if (bFT != null && cFT != null && bFT === cFT) {
      score += 15;
      reasons.push(`Both ${fakeTitsLabel(bFT)}`);
    }

    return { score, reasons };
  }

  /* ============================
     UI helpers (tooltip only)
     ============================ */
  function createCard(p, analysis) {
    const a = document.createElement("a");
    a.href = `/performers/${p.id}`;
    a.className = "similar-performer-card";
    a.title = analysis.reasons.join("\n");

    a.innerHTML = `
      <div class="similar-performer-thumb">
        ${p.image_path ? `<img loading="lazy" src="${p.image_path}">` : ""}
        <div class="similar-performer-score">★ ${analysis.score}</div>
      </div>

      <div class="similar-performer-meta">
        <div class="similar-performer-name">
          ${p.name}${p.favorite ? " ⭐" : ""}
        </div>
      </div>
    `;

    return a;
  }

  /* ============================
     Tab + Main
     ============================ */
  function injectTab() {
    const existing = document.querySelector('[data-rb-event-key="similar-performers-panel"]');
    if (existing) return document.querySelector(".similar-performers-grid");

    const tabsNav = document.querySelector(".performer-tabs .nav-tabs");
    const tabContent = document.querySelector(".performer-tabs .tab-content");
    if (!tabsNav || !tabContent) return null;

    const nav = document.createElement("a");
    nav.className = "nav-item nav-link";
    nav.dataset.rbEventKey = "similar-performers-panel";
    nav.textContent = "Similar Performers";
    nav.href = "#";

    const panel = document.createElement("div");
    panel.className = "tab-pane fade";
    panel.dataset.rbEventKey = "similar-performers-panel";
    panel.innerHTML = `
      <div class="similar-performers-grid-wrapper">
        <div class="similar-performers-grid"></div>
      </div>
    `;

    nav.addEventListener("click", e => {
      e.preventDefault();
      tabsNav.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
      tabContent.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active", "show"));
      nav.classList.add("active");
      panel.classList.add("active", "show");
    });

    tabsNav.appendChild(nav);
    tabContent.appendChild(panel);

    return panel.querySelector(".similar-performers-grid");
  }

  async function init() {
    const match = location.pathname.match(/\/performers\/(\d+)/);
    if (!match) return;

    const grid = injectTab();
    if (!grid || grid.dataset.loaded) return;
    grid.dataset.loaded = "true";

    const baseData = await gql(GET_PERFORMER, { id: match[1] });
    const allData = await gql(FIND_PERFORMERS, { limit: QUERY_LIMIT });
    if (!baseData?.findPerformer || !allData?.findPerformers?.performers) return;

    const base = baseData.findPerformer;

    const seen = new Set(); // unique performers by id
    allData.findPerformers.performers
      .filter(p => p.id !== base.id && (!p.gender || !base.gender || p.gender === base.gender))
      .map(p => ({ performer: p, analysis: scorePerformer(p, base) }))
      .filter(e => e.analysis.score > 0)
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .some(e => {
        if (seen.has(e.performer.id)) return false;
        seen.add(e.performer.id);
        grid.appendChild(createCard(e.performer, e.analysis));
        return seen.size >= TARGET_PERFORMERS;
      });
  }

  /* ============================
     SPA observer
     ============================ */
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document
        .querySelectorAll('[data-rb-event-key="similar-performers-panel"]')
        .forEach(el => el.remove());
      init();
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
