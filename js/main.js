// Derives the active page filename from the current URL
function getActivePage() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const file = parts[parts.length - 1] || 'index.html';
  return file === '' ? 'index.html' : file;
}

// Marks the matching nav link as active based on its href
function setActiveLink() {
  const active = getActivePage();
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href').replace('./', '');
    if (href === active) link.classList.add('is-active');
  });
}

// Opens or closes the mobile nav and syncs aria-expanded
function toggleNav(btn, nav) {
  const opening = !nav.classList.contains('is-open');
  nav.classList.toggle('is-open', opening);
  btn.setAttribute('aria-expanded', String(opening));
}

// Closes the mobile nav and resets aria-expanded
function closeNav(btn, nav) {
  nav.classList.remove('is-open');
  btn.setAttribute('aria-expanded', 'false');
}

// Wires up hamburger toggle, link-click close, and keyboard handlers
function initNav() {
  const btn = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => toggleNav(btn, nav));

  // Close drawer when a link is tapped on mobile
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => closeNav(btn, nav));
  });

  // Esc closes from anywhere on the page
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      closeNav(btn, nav);
      btn.focus();
    }
  });

  // Explicit Enter / Space handling on the toggle button
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleNav(btn, nav);
    }
  });
}

setActiveLink();
initNav();
