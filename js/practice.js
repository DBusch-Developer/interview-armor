const grid = document.querySelector("#questionGrid");
const levelFilters = document.querySelector("#levelFilters");
const categoryFilters = document.querySelector("#categoryFilters");
const searchInput = document.querySelector("#searchInput");
const startRandomBtn = document.querySelector(".controls-bar a.btn-primary");

const STORAGE_KEY = "interviewArmorPracticeNotes";
const API_KEY_STORAGE = "interviewArmorGroqKey";

let selectedLevel = "All";
let selectedCategory = "All";
const saveTimers = {};

// ─── Filter state ──────────────────────────────────────────

function getQuestionsForFilters() {
  const search = searchInput.value.trim().toLowerCase();

  return INTERVIEW_QUESTIONS.filter((q) => {
    if (selectedLevel !== "All" && q.level !== selectedLevel) return false;
    if (selectedCategory !== "All" && q.category !== selectedCategory) return false;
    if (search) {
      const haystack = `${q.category} ${q.level} ${q.question} ${q.tip}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function getCategoriesForLevel(level) {
  if (level === "All") return INTERVIEW_CATEGORIES;
  const available = new Set();
  for (const q of INTERVIEW_QUESTIONS) {
    if (q.level === level) available.add(q.category);
  }
  return ["All", ...INTERVIEW_CATEGORIES.filter((c) => c !== "All" && available.has(c))];
}

// ─── localStorage notes ────────────────────────────────────

function getAllNotes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function debouncedSave(id, partial, statusEl) {
  clearTimeout(saveTimers[id]);
  if (statusEl) statusEl.textContent = "Saving...";
  saveTimers[id] = setTimeout(() => {
    saveNotesFor(id, partial);
    if (statusEl) statusEl.textContent = "Saved";
    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 1500);
  }, 400);
}

// ─── Groq AI ideas ─────────────────────────────────────────

function getGroqKey() {
  // Phase 1 sprint shortcut: key is saved in localStorage.
  // Phase 2: move Groq calls to a backend proxy so the key never lives in the browser.
  let key = localStorage.getItem(API_KEY_STORAGE);
  if (!key) {
    key = prompt("Paste your Groq API key. Phase 1 stores it in localStorage for this browser.");
    if (key) localStorage.setItem(API_KEY_STORAGE, key.trim());
  }
  return key;
}

async function getAIIdeas(id, question, level, contentEl, button) {
  const key = getGroqKey();
  if (!key) return;

  const userNotes = grid.querySelector(`[data-notes-for="${id}"]`)?.value.trim() || "";
  const userDraft = grid.querySelector(`[data-draft-for="${id}"]`)?.value.trim() || "";

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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a direct, encouraging interview coach. You give brief, actionable bullet points." },
          { role: "user", content: promptText }
        ],
        temperature: 0.6,
        max_completion_tokens: 400
      })
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

// ─── Rendering ─────────────────────────────────────────────

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

function renderLevelFilters() {
  levelFilters.innerHTML = INTERVIEW_LEVELS.map((level) => {
    const active = level === selectedLevel ? "is-active" : "";
    return `<button class="filter-btn ${active}" type="button" data-level="${level}">${level}</button>`;
  }).join("");

  levelFilters.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedLevel = btn.dataset.level;
      selectedCategory = "All";
      renderLevelFilters();
      renderCategoryFilters();
      renderQuestions();
    });
  });
}

function renderCategoryFilters() {
  const categories = getCategoriesForLevel(selectedLevel);

  categoryFilters.innerHTML = categories.map((cat) => {
    const active = cat === selectedCategory ? "is-active" : "";
    return `<button class="filter-btn ${active}" type="button" data-category="${cat}">${cat}</button>`;
  }).join("");

  categoryFilters.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.category;
      renderCategoryFilters();
      renderQuestions();
    });
  });
}

function renderCard(q) {
  const saved = getNotesFor(q.id);

  return `
    <article class="question-card">
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
        <a class="btn btn-primary btn-small" href="mock.html?q=${encodeURIComponent(q.id)}">Practice This</a>
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

function renderQuestions() {
  const questions = getQuestionsForFilters();

  if (!questions.length) {
    grid.innerHTML = `
      <div class="empty-state card pad" style="grid-column:1/-1;">
        <h3>No questions match those filters.</h3>
        <p class="muted">Try widening your search or picking "All".</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = questions.map(renderCard).join("");
}

// ─── Event delegation on the dynamic grid ──────────────────

grid.addEventListener("click", (event) => {
  const toggleBtn = event.target.closest("[data-toggle-workspace]");
  if (toggleBtn) {
    const id = toggleBtn.dataset.toggleWorkspace;
    const workspace = grid.querySelector(`[data-workspace="${id}"]`);
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
    const output = grid.querySelector(`[data-ai-output="${id}"]`);
    const contentEl = grid.querySelector(`[data-ai-content="${id}"]`);
    if (question && output && contentEl) {
      output.classList.remove("hidden");
      getAIIdeas(id, question.question, question.level, contentEl, aiBtn);
    }
    return;
  }
});

grid.addEventListener("input", (event) => {
  const target = event.target;

  if (target.matches("[data-notes-for]")) {
    const id = target.dataset.notesFor;
    const status = grid.querySelector(`[data-save-status="${id}"]`);
    debouncedSave(id, { notes: target.value }, status);
    return;
  }

  if (target.matches("[data-draft-for]")) {
    const id = target.dataset.draftFor;
    const status = grid.querySelector(`[data-save-status="${id}"]`);
    debouncedSave(id, { draft: target.value }, status);
    return;
  }
});

// ─── Start Random Mock respects current filters ────────────

if (startRandomBtn) {
  startRandomBtn.addEventListener("click", (event) => {
    const pool = getQuestionsForFilters();
    if (pool.length > 0) {
      event.preventDefault();
      const pick = pool[Math.floor(Math.random() * pool.length)];
      window.location.href = `mock.html?q=${encodeURIComponent(pick.id)}`;
    }
  });
}

searchInput.addEventListener("input", renderQuestions);

renderLevelFilters();
renderCategoryFilters();
renderQuestions();
