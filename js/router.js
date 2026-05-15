// ─────────────────────────────────────────────────────────────
// SPA router
// ─────────────────────────────────────────────────────────────
// Intercepts in-app nav clicks, fetches the target HTML, pulls
// out its .content-stack (the per-page content), and swaps it
// into the current document — no full reload.
//
// Each page exposes window.initXxx() / window.teardownXxx?(). The
// router calls teardown before swap and init after, so per-page
// state and listeners get cleaned up between visits.
//
// Direct loads of practice.html / mock.html / etc. still work —
// the router just calls the right init on first paint instead of
// fetching anything. This means the site stays viewable with JS
// off (graceful degradation) and bookmarks/refresh work too.

(function () {
  // Map of pathname -> { title, init }. Adding a new page is one
  // entry here plus a matching window.initXxx() function.
  const ROUTES = {
    "index.html":    { title: "Interview Armor: Dev Mode | Home",           init: null },
    "practice.html": { title: "Interview Armor: Dev Mode | Practice",       init: () => window.initPractice?.(), teardown: () => window.teardownPractice?.() },
    "mock.html":     { title: "Interview Armor: Dev Mode | Mock Interview", init: () => window.initMock?.(),     teardown: () => window.teardownMock?.() },
    "saved.html":    { title: "Interview Armor: Dev Mode | Saved",          init: () => window.initSaved?.(),    teardown: () => window.teardownSaved?.() },
    "about.html":    { title: "Interview Armor: Dev Mode | About",          init: null },
  };

  function currentPageKey() {
    // Strip query string before lookup — the same HTML file serves
    // every variant (e.g. mock.html?q=js-b01 still resolves to mock.html).
    const file = (location.pathname.split("/").pop() || "index.html").split("?")[0];
    return ROUTES[file] ? file : "index.html";
  }

  function setActiveNav(pageKey) {
    document.querySelectorAll("[data-page]").forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("data-page") === pageKey);
    });
  }

  // Track which page's teardown should run before the next swap.
  let activePageKey = currentPageKey();

  // ── Initial paint ─────────────────────────────────────────
  // The browser has already loaded the correct HTML; we just
  // need to wire up the page's init and mark the active nav link.
  setActiveNav(activePageKey);
  ROUTES[activePageKey]?.init?.();

  // ── Click interception ────────────────────────────────────
  document.addEventListener("click", (event) => {
    // Honor modifier keys (cmd-click to open in new tab still works)
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;

    const link = event.target.closest("a[data-page]");
    if (!link) return;

    const targetPage = link.getAttribute("data-page");
    if (!ROUTES[targetPage]) return;

    // The href can carry a query string (e.g. mock.html?q=js-b01); we use
    // it as the URL we push to history, while data-page tells us which HTML
    // file to fetch.
    const targetUrl = link.getAttribute("href") || targetPage;

    event.preventDefault();
    navigateTo(targetPage, { push: true, url: targetUrl });
  });

  // ── Back/forward ──────────────────────────────────────────
  window.addEventListener("popstate", () => {
    // Pull the current pathname + query so a back/forward through
    // mock.html?q=js-b01 still loads with the right ?q.
    const url = (location.pathname.split("/").pop() || "index.html") + location.search;
    navigateTo(currentPageKey(), { push: false, url });
  });

  // ── The actual swap ───────────────────────────────────────
  async function navigateTo(pageKey, { push, url }) {
    // `pageKey` is the HTML file we fetch (e.g. mock.html). `url` is the
    // full URL we push to history (e.g. mock.html?q=js-b01). When url is
    // omitted we just use pageKey.
    const targetUrl = url || pageKey;

    // Allow re-navigation to the same page if the query string differs —
    // e.g. clicking "Practice Again" from the saved page to mock.html?q=...
    // when already on mock.html. Otherwise just scroll up.
    if (pageKey === activePageKey && targetUrl === location.pathname.split("/").pop() + location.search) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const route = ROUTES[pageKey];
    if (!route) return;

    const currentStack = document.querySelector(".content-stack");
    if (!currentStack) {
      // No content-stack on the current page (e.g. an error page).
      // Just do a hard nav as a fallback.
      location.href = targetUrl;
      return;
    }

    // Visual cue while fetching. Kept tiny — the network is fast and
    // a full spinner would be more distracting than helpful.
    currentStack.classList.add("is-loading");

    let html;
    try {
      const response = await fetch(pageKey, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      html = await response.text();
    } catch (err) {
      console.error("SPA fetch failed, falling back to hard nav:", err);
      location.href = targetUrl;
      return;
    }

    // Parse the fetched HTML and pull out just the content-stack. We don't
    // swap <head> or scripts — every page ships the same script bundle,
    // so the init function is all we need to switch behavior.
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const newStack = parsed.querySelector(".content-stack");
    if (!newStack) {
      location.href = targetUrl;
      return;
    }

    // Tear down the outgoing page before its DOM disappears, so any
    // listeners or timers it owns can clean themselves up.
    ROUTES[activePageKey]?.teardown?.();

    // Swap in the new content. replaceWith preserves the parent
    // (.dojo-layout) so the sidebar stays put.
    currentStack.replaceWith(newStack);
    newStack.classList.remove("is-loading");

    // Update document state to match the new page. Push the FULL URL
    // (with any query string) so mock.html?q=xxx survives the swap.
    document.title = route.title;
    setActiveNav(pageKey);
    if (push) history.pushState({}, "", targetUrl);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

    activePageKey = pageKey;

    // Boot the new page's behavior.
    route.init?.();

    // Sidebar stats may have changed (e.g. coming back from Saved
    // after a delete). Cheap to recompute.
    window.refreshSidebarStats?.();
  }

  // Exposed in case other code wants to navigate programmatically. Accepts
  // either a bare page name ("mock.html") or a full URL ("mock.html?q=js-b01").
  window.navigateTo = (urlOrPage) => {
    const pageKey = urlOrPage.split("?")[0];
    navigateTo(pageKey, { push: true, url: urlOrPage });
  };
})();
