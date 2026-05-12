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
