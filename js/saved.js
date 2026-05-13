// Saved sessions page — read entries written by mock.js's saveAnswer(),
// render them newest-first, and wire up search + category + readiness
// filters plus per-card delete and "Practice Again" actions.

const STORAGE_KEY = "interviewArmorSavedAnswers";

const elements = {
  controls: document.querySelector("#savedControls"),
  list: document.querySelector("#savedList"),
  empty: document.querySelector("#savedEmpty"),
  noResults: document.querySelector("#savedNoResults"),
  searchInput: document.querySelector("#savedSearchInput"),
  categoryFilters: document.querySelector("#savedCategoryFilters"),
  confidenceFilters: document.querySelector("#savedConfidenceFilters"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  countLabel: document.querySelector("#savedCount")
};

// Filter state — search is a free-text substring, the two filters
// are single-select with "All" as the default.
let activeSearch = "";
let activeCategory = "All";
let activeConfidence = "All";

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
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw;
  } catch {
    // Corrupt JSON — return empty rather than blowing up the page.
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function formatSavedDate(isoString) {
  if (!isoString) return "Unknown date";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// Belt color naming used on the mock page — keeps the visual language
// consistent between the readiness panel and the saved-card pills.
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

// ─── Filtering ───────────────────────────────────────────────

function applyFilters(entries) {
  const search = activeSearch.trim().toLowerCase();

  return entries.filter((entry) => {
    if (activeCategory !== "All" && entry.category !== activeCategory) {
      return false;
    }
    if (activeConfidence !== "All" && entry.confidence !== activeConfidence) {
      return false;
    }
    if (search) {
      const haystack = [
        entry.question,
        entry.category,
        entry.level,
        entry.transcript,
        entry.feedback?.strength,
        entry.feedback?.improve,
        entry.feedback?.strongerAnswer,
        entry.feedback?.confidenceTip
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

// ─── Category filter chips (data-driven) ────────────────────

// Only show category chips for categories the user has actually
// saved — avoids a wall of 20+ chips and keeps the UI focused on
// content that exists.
function renderCategoryChips(entries) {
  const categories = Array.from(
    new Set(entries.map((e) => e.category).filter(Boolean))
  ).sort();

  const allActive = activeCategory === "All";
  const chips = [
    `<button class="filter-btn ${allActive ? "is-active" : ""}" type="button" data-category="All">All</button>`
  ];
  for (const category of categories) {
    const isActive = activeCategory === category;
    chips.push(
      `<button class="filter-btn ${isActive ? "is-active" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    );
  }
  elements.categoryFilters.innerHTML = chips.join("");
}

// ─── Card rendering ─────────────────────────────────────────

function cardTemplate(entry) {
  const feedback = entry.feedback || {};
  const tags = [];
  if (entry.category) {
    tags.push(`<span class="tag">${escapeHtml(entry.category)}</span>`);
  }
  if (entry.level) {
    const cls = levelTagClass(entry.level);
    tags.push(`<span class="tag ${cls}">${escapeHtml(entry.level)}</span>`);
  }
  if (entry.type) {
    tags.push(`<span class="tag">${escapeHtml(entry.type)}</span>`);
  }

  const feedbackParts = [];
  if (feedback.strength) {
    feedbackParts.push(
      `<div class="feedback-item"><strong>Strength</strong><span>${escapeHtml(feedback.strength)}</span></div>`
    );
  }
  if (feedback.improve) {
    feedbackParts.push(
      `<div class="feedback-item"><strong>Improve</strong><span>${escapeHtml(feedback.improve)}</span></div>`
    );
  }
  if (feedback.strongerAnswer) {
    feedbackParts.push(
      `<div class="feedback-item"><strong>Stronger answer idea</strong><span>${escapeHtml(feedback.strongerAnswer)}</span></div>`
    );
  }
  if (feedback.confidenceTip) {
    feedbackParts.push(
      `<div class="feedback-item"><strong>Confidence tip</strong><span>${escapeHtml(feedback.confidenceTip)}</span></div>`
    );
  }

  // Practice Again deep-links into mock.js, which reads ?q= and
  // auto-loads the matching question.
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

      ${
        feedbackParts.length
          ? `<div class="saved-section">
              <p class="kicker">AI Feedback</p>
              <div class="feedback-grid">${feedbackParts.join("")}</div>
            </div>`
          : ""
      }

      <div class="btn-row saved-actions">
        <button class="btn btn-secondary btn-small" type="button" data-action="delete">Delete</button>
        <a class="btn btn-primary btn-small" href="${practiceHref}">Practice Again</a>
      </div>
    </article>
  `;
}

function renderList(entries, filtered) {
  // Decide which of the three states (cards / empty / no-results) is visible.
  if (entries.length === 0) {
    elements.controls.hidden = true;
    elements.empty.hidden = false;
    elements.noResults.hidden = true;
    elements.list.innerHTML = "";
    elements.countLabel.textContent = "";
    return;
  }

  elements.controls.hidden = false;
  elements.empty.hidden = true;

  if (filtered.length === 0) {
    elements.noResults.hidden = false;
    elements.list.innerHTML = "";
  } else {
    elements.noResults.hidden = true;
    elements.list.innerHTML = filtered.map(cardTemplate).join("");
  }

  const total = entries.length;
  const showing = filtered.length;
  elements.countLabel.textContent =
    showing === total
      ? `${total} saved ${total === 1 ? "session" : "sessions"}`
      : `${showing} of ${total} ${total === 1 ? "session" : "sessions"}`;
}

// ─── Main refresh loop ──────────────────────────────────────

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

// ─── Event wiring ───────────────────────────────────────────

elements.searchInput.addEventListener("input", (event) => {
  activeSearch = event.target.value;
  refresh();
});

elements.categoryFilters.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  refresh();
});

elements.confidenceFilters.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-confidence]");
  if (!btn) return;
  activeConfidence = btn.dataset.confidence;
  // Update active state immediately so the row reflects the chosen chip.
  elements.confidenceFilters
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("is-active", b === btn));
  refresh();
});

elements.clearFiltersBtn.addEventListener("click", () => {
  activeSearch = "";
  activeConfidence = "All";
  activeCategory = "All";
  elements.searchInput.value = "";
  elements.confidenceFilters
    .querySelectorAll(".filter-btn")
    .forEach((b) => b.classList.toggle("is-active", b.dataset.confidence === "All"));
  refresh();
});

// Delegated delete button — entries are mutated and the page re-rendered.
elements.list.addEventListener("click", (event) => {
  const btn = event.target.closest('[data-action="delete"]');
  if (!btn) return;
  const card = btn.closest(".saved-card");
  const id = card?.dataset.id;
  if (!id) return;

  if (!confirm("Delete this saved session? This cannot be undone.")) return;

  const next = loadEntries().filter((e) => e.id !== id);
  saveEntries(next);
  refresh();
});

refresh();
