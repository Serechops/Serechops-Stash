(() => {
  "use strict";

  const GRAPHQL = "/graphql";

  /* ============================
     Configuration
     ============================ */
  const TARGET_SCENES = 10;
  const QUERY_LIMIT = 40;
  const PREVIEW_DELAY_MS = 350;

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
      console.error("[Similar Scenes] GraphQL error:", json.errors);
      return null;
    }
    return json.data;
  }

  /* ============================
     Queries
     ============================ */
  const GET_SCENE = `
    query ($id: ID!) {
      findScene(id: $id) {
        id
        title
        performers { id name favorite }
        tags { id name }
      }
    }
  `;

  const FIND_BY_PERFORMERS = `
    query ($ids: [ID!], $limit: Int!) {
      findScenes(
        scene_filter: { performers: { value: $ids, modifier: INCLUDES } }
        filter: { per_page: $limit }
      ) {
        scenes {
          id
          title
          performers { id name favorite }
          tags { id name }
          paths { screenshot preview }
          files { basename }
        }
      }
    }
  `;

  const FIND_BY_TAG = `
    query ($name: String!, $limit: Int!) {
      findScenes(
        scene_filter: {
          tags_filter: { name: { value: $name, modifier: INCLUDES } }
        }
        filter: { per_page: $limit }
      ) {
        scenes {
          id
          title
          performers { id name favorite }
          tags { id name }
          paths { screenshot preview }
          files { basename }
        }
      }
    }
  `;

  /* ============================
     Scoring + Explanation
     ============================ */
  function scoreAndExplain(scene, base) {
    const basePerformerIds = new Set(base.performers.map(p => p.id));
    const baseTagIds = new Set(base.tags.map(t => t.id));

    let score = 0;
    const reasons = [];

    scene.performers.forEach(p => {
      if (p.favorite) {
        score += 100;
        reasons.push(`⭐ Favorite performer: ${p.name}`);
      }
      if (basePerformerIds.has(p.id)) {
        score += 25;
        reasons.push(`👥 Shared performer: ${p.name}`);
      }
    });

    scene.tags.forEach(t => {
      if (baseTagIds.has(t.id)) {
        score += 10;
        reasons.push(`🏷️ Shared tag: ${t.name}`);
      }
    });

    return { score, reasons };
  }

  /* ============================
     UI helpers
     ============================ */
  function createCard(scene, analysis) {
    const a = document.createElement("a");
    a.href = `/scenes/${scene.id}`;
    a.className = "similar-scene-card";

    const title =
      scene.title || scene.files?.[0]?.basename || "Untitled";

    /* 🔹 Tooltip explainer */
    if (analysis.reasons.length) {
      a.title = analysis.reasons.join("\n");
    }

    a.innerHTML = `
      <div class="similar-scene-thumb">
        <img loading="lazy" src="${scene.paths?.screenshot ?? ""}">
        ${
          scene.paths?.preview
            ? `<video muted loop preload="none" src="${scene.paths.preview}"></video>`
            : ""
        }
      </div>

      <div class="similar-scene-meta">
        <div class="similar-scene-title">${title}</div>
      </div>

      <div class="similar-scene-score">★ ${analysis.score}</div>
    `;

    const video = a.querySelector("video");
    let hoverTimer;

    if (video) {
      a.addEventListener("mouseenter", () => {
        hoverTimer = setTimeout(() => {
          video.style.opacity = "1";
          video.play().catch(() => {});
        }, PREVIEW_DELAY_MS);
      });

      a.addEventListener("mouseleave", () => {
        clearTimeout(hoverTimer);
        video.pause();
        video.style.opacity = "0";
      });
    }

    return a;
  }

  /* ============================
     Tab injection
     ============================ */
  function injectTab() {
    let panel = document.querySelector(
      '.tab-pane[data-rb-event-key="similar-scenes-panel"]'
    );
    if (panel) {
      return panel.querySelector(".similar-scenes-column");
    }

    const tabsNav = document.querySelector(".scene-tabs .nav-tabs");
    const tabContent = document.querySelector(".scene-tabs .tab-content");
    if (!tabsNav || !tabContent) return null;

    const navLink = document.createElement("a");
    navLink.className = "nav-item nav-link";
    navLink.dataset.rbEventKey = "similar-scenes-panel";
    navLink.textContent = "Similar Scenes";
    tabsNav.appendChild(navLink);

    panel = document.createElement("div");
    panel.className = "tab-pane fade";
    panel.dataset.rbEventKey = "similar-scenes-panel";
    panel.innerHTML = `<div class="similar-scenes-column"></div>`;
    tabContent.appendChild(panel);

    navLink.addEventListener("click", () => {
      tabsNav.querySelectorAll(".nav-link").forEach(n =>
        n.classList.remove("active")
      );
      tabContent.querySelectorAll(".tab-pane").forEach(p =>
        p.classList.remove("active", "show")
      );
      navLink.classList.add("active");
      panel.classList.add("active", "show");
    });

    return panel.querySelector(".similar-scenes-column");
  }

  /* ============================
     Main logic
     ============================ */
  async function init() {
    const match = location.pathname.match(/\/scenes\/(\d+)/);
    if (!match) return;

    if (document.querySelector('[data-similar-scenes-loaded="true"]')) return;

    const baseData = await gql(GET_SCENE, { id: match[1] });
    if (!baseData?.findScene) return;

    const base = baseData.findScene;
    const performerIds = base.performers.map(p => p.id);
    const tagNames = base.tags.map(t => t.name);

    const scored = new Map();

    if (performerIds.length) {
      const byPerformers = await gql(FIND_BY_PERFORMERS, {
        ids: performerIds,
        limit: QUERY_LIMIT
      });

      byPerformers?.findScenes?.scenes?.forEach(s => {
        if (s.id !== base.id) {
          scored.set(s.id, { scene: s, analysis: scoreAndExplain(s, base) });
        }
      });
    }

    if (scored.size < TARGET_SCENES && tagNames.length) {
      for (const tag of tagNames.slice(0, 3)) {
        const byTag = await gql(FIND_BY_TAG, { name: tag, limit: QUERY_LIMIT });
        byTag?.findScenes?.scenes?.forEach(s => {
          if (!scored.has(s.id) && s.id !== base.id) {
            scored.set(s.id, { scene: s, analysis: scoreAndExplain(s, base) });
          }
        });
        if (scored.size >= TARGET_SCENES) break;
      }
    }

    const finalScenes = [...scored.values()]
      .sort((a, b) => b.analysis.score - a.analysis.score)
      .slice(0, TARGET_SCENES);

    const container = injectTab();
    if (!container) return;

    container.setAttribute("data-similar-scenes-loaded", "true");
    finalScenes.forEach(e =>
      container.appendChild(createCard(e.scene, e.analysis))
    );
  }

  /* ============================
     SPA handling
     ============================ */
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;

      document
        .querySelectorAll('[data-rb-event-key="similar-scenes-panel"]')
        .forEach(el => el.remove());

      document
        .querySelectorAll('[data-similar-scenes-loaded]')
        .forEach(el =>
          el.removeAttribute("data-similar-scenes-loaded")
        );

      if (location.pathname.includes("/scenes/")) {
        setTimeout(init, 300);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  init();
})();
