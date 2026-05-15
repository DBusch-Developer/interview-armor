// ─────────────────────────────────────────────────────────────
// Main / shell
// ─────────────────────────────────────────────────────────────
// Runs on every page. Handles the mobile nav drawer, the active
// nav highlight, and the dojo-sidebar stat block (Today's Focus,
// Streak, Sessions, Accuracy). Sidebar refresh is also exposed
// on window so the SPA router can call it after navigation.

// ─── HTTPS guard ────────────────────────────────────────────
// If someone loads the deployed site over plain HTTP, redirect
// them to HTTPS immediately. The user's Groq key flows through
// fetch headers, and HTTP would let it be sniffed on the wire.
// Skipped for localhost so local dev (python3 -m http.server)
// still works.
(function enforceHttps() {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "";
  if (location.protocol === "http:" && !isLocal) {
    location.replace("https://" + location.host + location.pathname + location.search);
  }
})();

// ─── Mobile nav drawer ──────────────────────────────────────
const navToggle = document.querySelector("[data-nav-toggle]");
const mainNav = document.querySelector("[data-main-nav]");

function closeMobileNav() {
  if (!navToggle || !mainNav) return;
  navToggle.setAttribute("aria-expanded", "false");
  mainNav.classList.remove("is-open");
}

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    mainNav.classList.toggle("is-open", !isOpen);
  });

  // Tapping a link in the drawer closes it on mobile.
  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMobileNav();
  });

  // Resizing past the mobile breakpoint resets the drawer.
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) closeMobileNav();
  });

  // Esc closes the drawer from anywhere.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mainNav.classList.contains("is-open")) {
      closeMobileNav();
      navToggle.focus();
    }
  });
}

// ─── Sidebar stats ──────────────────────────────────────────
// Reads saved sessions out of localStorage and writes the four
// values into [data-sidebar-stats]. The sidebar lives in the
// shell, so it isn't swapped by the router — just re-read after
// any save/delete via window.refreshSidebarStats().

function loadSavedEntriesForStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SAVED_ANSWERS) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// en-CA returns ISO-style YYYY-MM-DD in local time, which is
// exactly what we want for "same calendar day" comparisons.
function localDayKey(date) {
  return date.toLocaleDateString("en-CA");
}

function computeSidebarStats() {
  const entries = loadSavedEntriesForStats();

  // Today's Focus: category of the most recently saved session.
  let focus = "Pick a category";
  if (entries.length) {
    const sorted = entries.slice().sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      return tb - ta;
    });
    focus = sorted[0].category || "Pick a category";
  }

  // Streak: consecutive days with at least one save, counting
  // back. If nothing saved today, start from yesterday so a 4pm
  // visit doesn't wipe a real streak.
  const daysWithSaves = new Set();
  for (const entry of entries) {
    const d = new Date(entry.createdAt);
    if (!Number.isNaN(d.getTime())) daysWithSaves.add(localDayKey(d));
  }
  let streak = 0;
  if (daysWithSaves.size) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cursor = new Date(today);
    if (!daysWithSaves.has(localDayKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (daysWithSaves.has(localDayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // Sessions this week (Monday-based).
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const daysFromMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
  const sessionsThisWeek = entries.filter((entry) => {
    const t = Date.parse(entry.createdAt);
    return !Number.isNaN(t) && t >= startOfWeek.getTime();
  }).length;

  // Accuracy: average of overall-readiness % across scored saves.
  // Same formula as mock.js: ((clarity + structure + confidence) / 3) * 10.
  const scored = entries.filter((entry) => {
    const f = entry.feedback;
    if (!f) return false;
    return (Number(f.clarity) || 0) + (Number(f.structure) || 0) + (Number(f.confidence) || 0) > 0;
  });
  let accuracy = null;
  if (scored.length) {
    const sum = scored.reduce((acc, entry) => {
      const c  = Number(entry.feedback.clarity)    || 0;
      const s  = Number(entry.feedback.structure)  || 0;
      const cf = Number(entry.feedback.confidence) || 0;
      return acc + ((c + s + cf) / 3) * 10;
    }, 0);
    accuracy = Math.round(sum / scored.length);
  }

  return {
    focus,
    streak:   streak === 1 ? "1 day" : `${streak} days`,
    sessions: sessionsThisWeek === 1 ? "1 this week" : `${sessionsThisWeek} this week`,
    accuracy: accuracy == null ? "—" : `${accuracy}%`,
  };
}

function refreshSidebarStats() {
  const root = document.querySelector("[data-sidebar-stats]");
  if (!root) return;
  const stats = computeSidebarStats();
  const setStat = (name, value) => {
    const el = root.querySelector(`[data-stat="${name}"] .side-stat-value`);
    if (el) el.textContent = value;
  };
  setStat("focus", stats.focus);
  setStat("streak", stats.streak);
  setStat("sessions", stats.sessions);
  setStat("accuracy", stats.accuracy);
}

// Initial paint.
refreshSidebarStats();

// Re-paint if another tab writes new sessions.
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.SAVED_ANSWERS) refreshSidebarStats();
});

// Exposed so mock.js (after save), saved.js (after delete), and
// the router (after any navigation) can refresh the sidebar in
// the current tab.
window.refreshSidebarStats = refreshSidebarStats;

// ─── Clear stored Groq key ──────────────────────────────────
// Document-level delegated listener so it works whether the
// About page was loaded directly or swapped in by the SPA
// router. Confirms before deletion to prevent stray clicks.
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-clear-key]");
  if (!button) return;

  const status = document.querySelector("[data-clear-key-status]");
  const hasKey = !!localStorage.getItem(STORAGE_KEYS.GROQ_KEY);

  if (!hasKey) {
    if (status) status.textContent = "No key stored in this browser.";
    return;
  }

  const confirmed = confirm(
    "Remove your Groq API key from this browser? You'll be prompted again the next time you transcribe or request feedback."
  );
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEYS.GROQ_KEY);
  if (status) status.textContent = "Key cleared.";
});
