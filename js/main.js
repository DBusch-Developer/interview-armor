// Mobile nav: hooks into data attributes so the HTML can stay declarative
const navToggle = document.querySelector("[data-nav-toggle]");
const mainNav = document.querySelector("[data-main-nav]");

function closeMobileNav() {
  navToggle.setAttribute("aria-expanded", "false");
  mainNav.classList.remove("is-open");
}

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!isOpen));
    mainNav.classList.toggle("is-open", !isOpen);
  });

  // Tapping a link inside the drawer closes it on mobile
  mainNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      closeMobileNav();
    }
  });

  // Resizing past the mobile breakpoint resets the drawer state
  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      closeMobileNav();
    }
  });

  // Esc closes the drawer from anywhere on the page
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mainNav.classList.contains("is-open")) {
      closeMobileNav();
      navToggle.focus();
    }
  });
}

// Highlight the nav link that matches the current page
const currentPage = location.pathname.split("/").pop() || "index.html";
document.querySelectorAll("[data-page]").forEach((link) => {
  if (link.getAttribute("data-page") === currentPage) {
    link.classList.add("is-active");
  }
});

// ─── Dynamic sidebar stats ─────────────────────────────────
// Reads saved sessions out of localStorage and updates the four
// dojo-sidebar values (Today's Focus, Streak, Sessions, Accuracy).
// Lives in main.js so every page that has the sidebar gets it for free.

const SIDEBAR_STORAGE_KEY = "interviewArmorSavedAnswers";

function loadSavedEntriesForStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Convert a Date to a local YYYY-MM-DD key so two saves on the same
// calendar day collide regardless of time. en-CA gives ISO-style dates
// in local time, which is what we want for streak counting.
function localDayKey(date) {
  return date.toLocaleDateString("en-CA");
}

function computeSidebarStats() {
  const entries = loadSavedEntriesForStats();

  // ── Today's Focus: category of the most recently saved session ──
  let focus = "Pick a category";
  if (entries.length) {
    const sorted = entries.slice().sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      return tb - ta;
    });
    focus = sorted[0].category || "Pick a category";
  }

  // ── Streak: consecutive days with at least one save, counting back ──
  // If nothing today yet, start from yesterday so a 4pm visit doesn't
  // wipe a real streak.
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

  // ── Sessions this week (Monday-based) ──
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  const daysFromMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
  const sessionsThisWeek = entries.filter((entry) => {
    const t = Date.parse(entry.createdAt);
    return !Number.isNaN(t) && t >= startOfWeek.getTime();
  }).length;

  // ── Accuracy: average of overall-readiness % across scored saves ──
  // Same formula mock.js uses: ((clarity + structure + confidence) / 3) * 10.
  const scored = entries.filter((entry) => {
    const f = entry.feedback;
    if (!f) return false;
    return (Number(f.clarity) || 0) + (Number(f.structure) || 0) + (Number(f.confidence) || 0) > 0;
  });
  let accuracy = null;
  if (scored.length) {
    const sum = scored.reduce((acc, entry) => {
      const c = Number(entry.feedback.clarity) || 0;
      const s = Number(entry.feedback.structure) || 0;
      const cf = Number(entry.feedback.confidence) || 0;
      return acc + ((c + s + cf) / 3) * 10;
    }, 0);
    accuracy = Math.round(sum / scored.length);
  }

  return {
    focus,
    streak: streak === 1 ? "1 day" : `${streak} days`,
    sessions: sessionsThisWeek === 1 ? "1 this week" : `${sessionsThisWeek} this week`,
    accuracy: accuracy == null ? "—" : `${accuracy}%`
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

// Initial paint
refreshSidebarStats();

// Re-paint if another tab writes new sessions
window.addEventListener("storage", (event) => {
  if (event.key === SIDEBAR_STORAGE_KEY) refreshSidebarStats();
});

// Expose so mock.js (after save) and saved.js (after delete) can refresh
// the sidebar in the current tab without a full page reload.
window.refreshSidebarStats = refreshSidebarStats;
