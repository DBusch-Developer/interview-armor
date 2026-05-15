// ─────────────────────────────────────────────────────────────
// Saved page
// ─────────────────────────────────────────────────────────────
// Reads entries written by mock.js's saveAnswer(), renders them
// newest-first, and wires up search + category + readiness
// filters plus per-card delete and "Practice Again".
//
// Exposes:
//   window.initSaved()     — boots the page (called by router)
//   window.teardownSaved() — releases listeners

(function () {
  const state = {
    elements: null,
    activeSearch: "",
    activeCategory: "All",
    activeConfidence: "All",
    listeners: [],
  };

  // ─── Helpers ────────────────────────────────────────────────

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadEntries() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_ANSWERS) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      // Corrupt JSON — return empty rather than crashing the page.
      return [];
    }
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEYS.SAVED_ANSWERS, JSON.stringify(entries));
  }

  function formatSavedDate(isoString) {
    if (!isoString) return "Unknown date";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  }

  function confidencePillClass(value) {
    if (value === "Needs Work") return "confidence-pill confidence-pill-gray";
    if (value === "Almost Ready") return "confidence-pill confidence-pill-bronze";
    if (value === "Strong Answer") return "confidence-pill confidence-pill-sage";
    return "confidence-pill";
  }

  function levelTagClass(level) {
    if (level === "Beginner") return "tag-sage";
    if (level === "Intermediate") return "tag-bronze";
    if (level === "Advanced") return "tag-red";
    return "";
  }

  // ─── Filtering ──────────────────────────────────────────────

  function applyFilters(entries) {
    const search = state.activeSearch.trim().toLowerCase();
    return entries.filter((entry) => {
      if (state.activeCategory !== "All" && entry.category !== state.activeCategory) return false;
      if (state.activeConfidence !== "All" && entry.confidence !== state.activeConfidence) return false;
      if (search) {
        const haystack = [
          entry.question, entry.category, entry.level, entry.transcript,
          entry.feedback?.strength, entry.feedback?.improve,
          entry.feedback?.strongerAnswer, entry.feedback?.confidenceTip,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }

  // ─── Category chips ─────────────────────────────────────────

  function renderCategoryChips(entries) {
    const categories = Array.from(
      new Set(entries.map((e) => e.category).filter(Boolean))
    ).sort();

    const allActive = state.activeCategory === "All";
    const chips = [
      `<button class="filter-btn ${allActive ? "is-active" : ""}" type="button" data-category="All">All</button>`,
    ];
    for (const category of categories) {
      const isActive = state.activeCategory === category;
      chips.push(
        `<button class="filter-btn ${isActive ? "is-active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
      );
    }
    state.elements.categoryFilters.innerHTML = chips.join("");
  }

  // ─── Card rendering ─────────────────────────────────────────

  function cardTemplate(entry) {
    const feedback = entry.feedback || {};
    const tags = [];
    if (entry.category) tags.push(`<span class="tag">${escapeHtml(entry.category)}</span>`);
    if (entry.level)    tags.push(`<span class="tag ${levelTagClass(entry.level)}">${escapeHtml(entry.level)}</span>`);
    if (entry.type)     tags.push(`<span class="tag">${escapeHtml(entry.type)}</span>`);

    const feedbackParts = [];
    if (feedback.strength)        feedbackParts.push(`<div class="feedback-item"><strong>Strength</strong><span>${escapeHtml(feedback.strength)}</span></div>`);
    if (feedback.improve)         feedbackParts.push(`<div class="feedback-item"><strong>Improve</strong><span>${escapeHtml(feedback.improve)}</span></div>`);
    if (feedback.strongerAnswer)  feedbackParts.push(`<div class="feedback-item"><strong>Stronger answer idea</strong><span>${escapeHtml(feedback.strongerAnswer)}</span></div>`);
    if (feedback.confidenceTip)   feedbackParts.push(`<div class="feedback-item"><strong>Confidence tip</strong><span>${escapeHtml(feedback.confidenceTip)}</span></div>`);

    // data-page="mock.html" lets the router intercept the click for SPA nav.
    const practiceHref = entry.questionId
      ? `mock.html?q=${encodeURIComponent(entry.questionId)}`
      : "mock.html";

    return `
      <article class="card pad saved-card" data-id="${escapeHtml(entry.id)}">
        <div class="saved-card-header">
          <div class="tag-row">${tags.join("")}</div>
          <span class="${confidencePillClass(entry.confidence)}">${escapeHtml(entry.confidence || "—")}</span>
        </div>
        <p class="muted saved-date">Saved ${escapeHtml(formatSavedDate(entry.createdAt))}</p>

        <div class="saved-section">
          <p class="kicker">Question</p>
          <p class="saved-question">${escapeHtml(entry.question || "—")}</p>
        </div>
        <div class="saved-section">
          <p class="kicker">Transcript</p>
          <blockquote class="saved-transcript">${escapeHtml(entry.transcript || "—")}</blockquote>
        </div>

        ${feedbackParts.length ? `
          <div class="saved-section">
            <p class="kicker">AI Feedback</p>
            <div class="feedback-grid">${feedbackParts.join("")}</div>
          </div>` : ""}

        <div class="btn-row saved-actions">
          <button class="btn btn-secondary btn-small" type="button" data-action="delete">Delete</button>
          <a class="btn btn-primary btn-small" href="${practiceHref}" data-page="mock.html">Practice Again</a>
        </div>
      </article>
    `;
  }

  function renderList(entries, filtered) {
    if (entries.length === 0) {
      state.elements.controls.hidden = true;
      state.elements.empty.hidden = false;
      state.elements.noResults.hidden = true;
      state.elements.list.innerHTML = "";
      state.elements.countLabel.textContent = "";
      return;
    }

    state.elements.controls.hidden = false;
    state.elements.empty.hidden = true;

    if (filtered.length === 0) {
      state.elements.noResults.hidden = false;
      state.elements.list.innerHTML = "";
    } else {
      state.elements.noResults.hidden = true;
      state.elements.list.innerHTML = filtered.map(cardTemplate).join("");
    }

    const total = entries.length;
    const showing = filtered.length;
    state.elements.countLabel.textContent =
      showing === total
        ? `${total} saved ${total === 1 ? "session" : "sessions"}`
        : `${showing} of ${total} ${total === 1 ? "session" : "sessions"}`;
  }

  function refresh() {
    const entries = loadEntries().slice().sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    renderCategoryChips(entries);
    const filtered = applyFilters(entries);
    renderList(entries, filtered);
  }

  // ─── Lifecycle ──────────────────────────────────────────────

  function on(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    state.listeners.push([target, type, handler]);
  }

  window.initSaved = function initSaved() {
    state.elements = {
      controls: document.querySelector("#savedControls"),
      list: document.querySelector("#savedList"),
      empty: document.querySelector("#savedEmpty"),
      noResults: document.querySelector("#savedNoResults"),
      searchInput: document.querySelector("#savedSearchInput"),
      categoryFilters: document.querySelector("#savedCategoryFilters"),
      confidenceFilters: document.querySelector("#savedConfidenceFilters"),
      clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
      countLabel: document.querySelector("#savedCount"),
    };

    if (!state.elements.list) return; // not on saved page

    state.activeSearch = "";
    state.activeCategory = "All";
    state.activeConfidence = "All";
    state.listeners = [];

    on(state.elements.searchInput, "input", (event) => {
      state.activeSearch = event.target.value;
      refresh();
    });

    on(state.elements.categoryFilters, "click", (event) => {
      const btn = event.target.closest("[data-category]");
      if (!btn) return;
      state.activeCategory = btn.dataset.category;
      refresh();
    });

    on(state.elements.confidenceFilters, "click", (event) => {
      const btn = event.target.closest("[data-confidence]");
      if (!btn) return;
      state.activeConfidence = btn.dataset.confidence;
      state.elements.confidenceFilters
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.toggle("is-active", b === btn));
      refresh();
    });

    on(state.elements.clearFiltersBtn, "click", () => {
      state.activeSearch = "";
      state.activeConfidence = "All";
      state.activeCategory = "All";
      state.elements.searchInput.value = "";
      state.elements.confidenceFilters
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.toggle("is-active", b.dataset.confidence === "All"));
      refresh();
    });

    on(state.elements.list, "click", (event) => {
      const btn = event.target.closest('[data-action="delete"]');
      if (!btn) return;
      const card = btn.closest(".saved-card");
      const id = card?.dataset.id;
      if (!id) return;
      if (!confirm("Delete this saved session? This cannot be undone.")) return;
      const next = loadEntries().filter((e) => e.id !== id);
      saveEntries(next);
      refresh();
      window.refreshSidebarStats?.();
    });

    refresh();
  };

  window.teardownSaved = function teardownSaved() {
    state.listeners.forEach(([target, type, handler]) => target?.removeEventListener(type, handler));
    state.listeners = [];
    state.elements = null;
  };
})();
