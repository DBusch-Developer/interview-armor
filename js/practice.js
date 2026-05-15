// ─────────────────────────────────────────────────────────────
// Practice page
// ─────────────────────────────────────────────────────────────
// Question bank with level + category filters, free-text search,
// per-question notes saved to localStorage, and on-demand AI
// suggestions from Groq.
//
// Exposes:
//   window.initPractice()     — boots the page (called by router)
//   window.teardownPractice() — clears in-flight timers
//
// All DOM lookups happen inside initPractice so this file is safe
// to load on any page; nothing runs until the router calls it.

(function () {
  // Per-page state. Scoped to this IIFE; init() resets it on
  // every visit so SPA navigation never carries stale values
  // between page mounts.
  const state = {
    grid: null,
    levelFilters: null,
    categoryFilters: null,
    searchInput: null,
    startRandomBtn: null,
    selectedLevel: "All",
    selectedCategory: "All",
    saveTimers: {},          // debounce timers keyed by question id
    isWired: false,          // guard against double-init
    listeners: [],           // for clean teardown
  };

  // ─── Filter helpers ─────────────────────────────────────────

  function getCategoriesForLevel(level) {
    if (level === "All") return INTERVIEW_CATEGORIES;
    const available = new Set();
    for (const q of INTERVIEW_QUESTIONS) {
      if (q.level === level) available.add(q.category);
    }
    return ["All", ...INTERVIEW_CATEGORIES.filter((c) => c !== "All" && available.has(c))];
  }

  // Decide if a single question matches the current filters +
  // search. Pulled out of getQuestionsForFilters so the visibility
  // pass can call it per-card without re-running the full filter.
  function matchesFilters(q, searchLower) {
    if (state.selectedLevel !== "All" && q.level !== state.selectedLevel) return false;
    if (state.selectedCategory !== "All" && q.category !== state.selectedCategory) return false;
    if (searchLower) {
      const haystack = `${q.category} ${q.level} ${q.question} ${q.tip}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  }

  // ─── localStorage notes ─────────────────────────────────────

  function getAllNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRACTICE_NOTES) || "{}");
    } catch {
      return {};
    }
  }

  function getNotesFor(id) {
    const all = getAllNotes();
    return all[id] || { notes: "", draft: "" };
  }

  function saveNotesFor(id, partial) {
    const all = getAllNotes();
    const current = all[id] || { notes: "", draft: "" };
    all[id] = { ...current, ...partial, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEYS.PRACTICE_NOTES, JSON.stringify(all));
  }

  function debouncedSave(id, partial, statusEl) {
    clearTimeout(state.saveTimers[id]);
    if (statusEl) statusEl.textContent = "Saving...";
    state.saveTimers[id] = setTimeout(() => {
      saveNotesFor(id, partial);
      if (statusEl) statusEl.textContent = "Saved";
      setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 1500);
    }, 400);
  }

  // ─── Groq AI ideas ──────────────────────────────────────────

  function getGroqKey() {
    // Prefer window.GROQ_API_KEY from config.js — single source of
    // truth across pages.
    if (window.GROQ_API_KEY) return window.GROQ_API_KEY;

    // Fallback: prompt and stash in localStorage for this browser.
    // Phase 2: move Groq calls behind a backend proxy.
    let key = localStorage.getItem(STORAGE_KEYS.GROQ_KEY);
    if (!key) {
      key = prompt("Paste your Groq API key. Phase 1 stores it in localStorage for this browser.");
      if (key) localStorage.setItem(STORAGE_KEYS.GROQ_KEY, key.trim());
    }
    return key;
  }

  async function getAIIdeas(id, question, level, contentEl, button) {
    const key = getGroqKey();
    if (!key) return;

    const userNotes = state.grid.querySelector(`[data-notes-for="${id}"]`)?.value.trim() || "";
    const userDraft = state.grid.querySelector(`[data-draft-for="${id}"]`)?.value.trim() || "";

    button.disabled = true;
    contentEl.textContent = "Thinking...";

    const userContext = (userNotes || userDraft)
      ? `Their notes so far: ${userNotes}\nTheir draft so far: ${userDraft}\n`
      : "They haven't written anything yet.\n";

    const promptText = `
You are an interview coach helping a ${level} developer prepare for this interview question.
Give 3 to 5 short bullets covering different angles, key points, or specific things to mention.
Each bullet should be 1 to 2 sentences. Be concrete. Don't restate the question.

Question: ${question}
${userContext}
Respond with ONLY the bullets, one per line, each starting with "- ".
`.trim();

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You are a direct, encouraging interview coach. You give brief, actionable bullet points." },
            { role: "user", content: promptText },
          ],
          temperature: 0.6,
          max_completion_tokens: 400,
        }),
      });

      if (!response.ok) throw new Error(await response.text());

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim() || "No ideas returned.";
      contentEl.textContent = content;
    } catch (error) {
      console.error(error);
      contentEl.textContent = "Couldn't reach the AI. Check your key, browser console, or try again.";
    } finally {
      button.disabled = false;
    }
  }

  // ─── Rendering ──────────────────────────────────────────────

  function levelTagClass(level) {
    if (level === "Beginner") return "tag-sage";
    if (level === "Intermediate") return "tag-bronze";
    if (level === "Advanced") return "tag-red";
    return "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Re-paint the level row. Active class is the only thing that
  // changes most of the time, but we re-render the row when the
  // available levels never change so the markup stays in sync
  // with state.
  function paintLevelButtons() {
    state.levelFilters.innerHTML = INTERVIEW_LEVELS.map((level) => {
      const active = level === state.selectedLevel ? "is-active" : "";
      return `<button class="filter-btn ${active}" type="button" data-level="${level}">${level}</button>`;
    }).join("");
  }

  // Category list depends on the selected level, so this gets
  // re-rendered whenever level changes. The click handler lives on
  // the parent (set once in wireFilters), so this is just markup.
  function paintCategoryButtons() {
    const categories = getCategoriesForLevel(state.selectedLevel);
    state.categoryFilters.innerHTML = categories.map((cat) => {
      const active = cat === state.selectedCategory ? "is-active" : "";
      return `<button class="filter-btn ${active}" type="button" data-category="${cat}">${cat}</button>`;
    }).join("");
  }

  function renderCard(q) {
    const saved = getNotesFor(q.id);

    // Data attributes carry the filter dimensions so the visibility
    // pass can match without searching the master question list.
    return `
      <article class="question-card"
               data-question-id="${q.id}"
               data-level="${q.level}"
               data-category="${escapeHtml(q.category)}"
               data-search="${escapeHtml(`${q.category} ${q.level} ${q.question} ${q.tip}`.toLowerCase())}">
        <div>
          <div class="tag-row">
            <span class="tag">${escapeHtml(q.category)}</span>
            <span class="tag ${levelTagClass(q.level)}">${q.level}</span>
          </div>
          <h3>${escapeHtml(q.question)}</h3>
          <p class="muted">${escapeHtml(q.tip)}</p>
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary btn-small" data-toggle-workspace="${q.id}">Open notes</button>
          <a class="btn btn-primary btn-small" href="mock.html?q=${encodeURIComponent(q.id)}" data-page="mock.html">Practice This</a>
        </div>

        <div class="hidden" data-workspace="${q.id}" style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border);">
          <label class="kicker" for="notes-${q.id}">Notes</label>
          <textarea class="textarea" id="notes-${q.id}" data-notes-for="${q.id}"
                    style="min-height:90px; margin-top:.35rem;"
                    placeholder="Key points, gotchas, things to remember...">${escapeHtml(saved.notes || "")}</textarea>

          <label class="kicker" for="draft-${q.id}" style="margin-top:.85rem; display:inline-block;">Draft answer</label>
          <textarea class="textarea" id="draft-${q.id}" data-draft-for="${q.id}"
                    style="min-height:130px; margin-top:.35rem;"
                    placeholder="Write the version you would actually say out loud...">${escapeHtml(saved.draft || "")}</textarea>

          <div class="btn-row" style="margin-top:.7rem; align-items:center;">
            <button class="btn btn-ghost btn-small" data-ai-ideas="${q.id}">Get AI ideas</button>
            <span class="muted" style="font-size:.82rem;" data-save-status="${q.id}"></span>
          </div>

          <div class="hidden" data-ai-output="${q.id}" style="margin-top:.9rem; padding-top:.9rem; border-top:1px dashed var(--border);">
            <p class="kicker">AI ideas</p>
            <p class="muted" data-ai-content="${q.id}" style="white-space:pre-wrap; margin-top:.3rem;"></p>
          </div>
        </div>
      </article>
    `;
  }

  // Render every card once at boot. After this, filter/search
  // changes only toggle a class — no innerHTML rewrites, no
  // re-creation of textareas (so unsaved focus and selection are
  // preserved across filter changes too).
  function renderAllCards() {
    state.grid.innerHTML = INTERVIEW_QUESTIONS.map(renderCard).join("");

    // Empty-state element lives alongside the cards. The pass below
    // toggles it based on how many cards are currently visible.
    const empty = document.createElement("div");
    empty.className = "empty-state card pad question-empty-state hidden";
    empty.style.gridColumn = "1/-1";
    empty.dataset.emptyState = "true";
    empty.innerHTML = `
      <h3>No questions match those filters.</h3>
      <p class="muted">Try widening your search or picking "All".</p>
    `;
    state.grid.appendChild(empty);
  }

  // The visibility pass: walk every card, toggle .is-hidden based
  // on current filters + search. No string concatenation, no DOM
  // creation, just classList toggles. O(n) but tiny n and very
  // fast — typing into the search box doesn't cause layout thrash.
  function applyVisibility() {
    const searchLower = state.searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    const cards = state.grid.querySelectorAll(".question-card");
    cards.forEach((card) => {
      const q = {
        level: card.dataset.level,
        category: card.dataset.category,
        // Use the precomputed haystack on the card so we skip the
        // string concat per keystroke.
        question: "", tip: "",
      };
      const cardHaystack = card.dataset.search || "";
      const passesLevel = state.selectedLevel === "All" || q.level === state.selectedLevel;
      const passesCategory = state.selectedCategory === "All" || q.category === state.selectedCategory;
      const passesSearch = !searchLower || cardHaystack.includes(searchLower);
      const visible = passesLevel && passesCategory && passesSearch;
      card.classList.toggle("is-hidden", !visible);
      if (visible) visibleCount++;
    });

    const empty = state.grid.querySelector("[data-empty-state]");
    if (empty) empty.classList.toggle("hidden", visibleCount > 0);
  }

  // Wire interaction. Called once per init() — uses event
  // delegation so we never re-attach listeners on filter changes.
  function wireInteraction() {
    if (state.isWired) return;
    state.isWired = true;

    // Level filter — delegated, set once.
    const onLevelClick = (event) => {
      const btn = event.target.closest("[data-level]");
      if (!btn) return;
      state.selectedLevel = btn.dataset.level;
      state.selectedCategory = "All";
      paintLevelButtons();
      paintCategoryButtons();
      applyVisibility();
    };
    state.levelFilters.addEventListener("click", onLevelClick);
    state.listeners.push([state.levelFilters, "click", onLevelClick]);

    // Category filter — delegated, set once.
    const onCategoryClick = (event) => {
      const btn = event.target.closest("[data-category]");
      if (!btn) return;
      state.selectedCategory = btn.dataset.category;
      paintCategoryButtons();
      applyVisibility();
    };
    state.categoryFilters.addEventListener("click", onCategoryClick);
    state.listeners.push([state.categoryFilters, "click", onCategoryClick]);

    // Search — only toggles visibility, never rebuilds DOM.
    const onSearch = () => applyVisibility();
    state.searchInput.addEventListener("input", onSearch);
    state.listeners.push([state.searchInput, "input", onSearch]);

    // Card-level clicks: open/close workspace, request AI ideas.
    const onGridClick = (event) => {
      const toggleBtn = event.target.closest("[data-toggle-workspace]");
      if (toggleBtn) {
        const id = toggleBtn.dataset.toggleWorkspace;
        const workspace = state.grid.querySelector(`[data-workspace="${id}"]`);
        if (workspace) {
          const opening = workspace.classList.contains("hidden");
          workspace.classList.toggle("hidden", !opening);
          toggleBtn.textContent = opening ? "Close notes" : "Open notes";
        }
        return;
      }

      const aiBtn = event.target.closest("[data-ai-ideas]");
      if (aiBtn) {
        const id = aiBtn.dataset.aiIdeas;
        const question = INTERVIEW_QUESTIONS.find((q) => q.id === id);
        const output = state.grid.querySelector(`[data-ai-output="${id}"]`);
        const contentEl = state.grid.querySelector(`[data-ai-content="${id}"]`);
        if (question && output && contentEl) {
          output.classList.remove("hidden");
          getAIIdeas(id, question.question, question.level, contentEl, aiBtn);
        }
      }
    };
    state.grid.addEventListener("click", onGridClick);
    state.listeners.push([state.grid, "click", onGridClick]);

    // Card-level input: notes + draft autosave.
    const onGridInput = (event) => {
      const target = event.target;
      if (target.matches("[data-notes-for]")) {
        const id = target.dataset.notesFor;
        const status = state.grid.querySelector(`[data-save-status="${id}"]`);
        debouncedSave(id, { notes: target.value }, status);
        return;
      }
      if (target.matches("[data-draft-for]")) {
        const id = target.dataset.draftFor;
        const status = state.grid.querySelector(`[data-save-status="${id}"]`);
        debouncedSave(id, { draft: target.value }, status);
      }
    };
    state.grid.addEventListener("input", onGridInput);
    state.listeners.push([state.grid, "input", onGridInput]);

    // "Start Random Mock" picks from the currently visible set. The link
    // already has data-page="mock.html", so the router will intercept the
    // click — we just need to update its href so the query string reflects
    // the random pick. We mutate href synchronously inside the bubble
    // phase, before the router's document-level handler runs.
    if (state.startRandomBtn) {
      const onRandom = (event) => {
        const visible = Array.from(
          state.grid.querySelectorAll(".question-card:not(.is-hidden)")
        );
        if (visible.length === 0) {
          event.preventDefault();
          return;
        }
        const pick = visible[Math.floor(Math.random() * visible.length)];
        state.startRandomBtn.setAttribute(
          "href",
          `mock.html?q=${encodeURIComponent(pick.dataset.questionId)}`
        );
        // Don't preventDefault — let the router pick up the (now-updated)
        // href via its delegated click handler.
      };
      state.startRandomBtn.addEventListener("click", onRandom);
      state.listeners.push([state.startRandomBtn, "click", onRandom]);
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────

  window.initPractice = function initPractice() {
    state.grid = document.querySelector("#questionGrid");
    state.levelFilters = document.querySelector("#levelFilters");
    state.categoryFilters = document.querySelector("#categoryFilters");
    state.searchInput = document.querySelector("#searchInput");
    state.startRandomBtn = document.querySelector(".controls-bar a.btn-primary");

    if (!state.grid || !state.levelFilters || !state.categoryFilters || !state.searchInput) {
      // Not on the practice page — bail quietly.
      return;
    }

    // Reset filter state on every mount so SPA nav starts fresh.
    state.selectedLevel = "All";
    state.selectedCategory = "All";
    state.isWired = false;
    state.listeners = [];

    paintLevelButtons();
    paintCategoryButtons();
    renderAllCards();
    applyVisibility();
    wireInteraction();
  };

  window.teardownPractice = function teardownPractice() {
    // Cancel any in-flight save timers — their target DOM is about
    // to disappear.
    Object.values(state.saveTimers).forEach(clearTimeout);
    state.saveTimers = {};

    // Listeners on grid/filters/search/random-btn die with the DOM,
    // but we still null out references so we don't accidentally
    // act on stale nodes.
    state.listeners = [];
    state.grid = null;
    state.levelFilters = null;
    state.categoryFilters = null;
    state.searchInput = null;
    state.startRandomBtn = null;
    state.isWired = false;
  };
})();
