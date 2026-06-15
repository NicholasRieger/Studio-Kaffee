const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");
const menuLines = document.querySelectorAll(".menu-line");
const mobileLinks = document.querySelectorAll(".mobile-link");

function toggleMenu() {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";

  menuButton.setAttribute("aria-expanded", String(!isOpen));

  mobileMenu.classList.toggle("pointer-events-none");
  mobileMenu.classList.toggle("opacity-0");
  mobileMenu.classList.toggle("translate-y-[-12px]");

  document.body.classList.toggle("overflow-hidden");

  menuLines[0].classList.toggle("translate-y-[7px]");
  menuLines[0].classList.toggle("rotate-45");

  menuLines[1].classList.toggle("opacity-0");

  menuLines[2].classList.toggle("-translate-y-[7px]");
  menuLines[2].classList.toggle("-rotate-45");
}

menuButton.addEventListener("click", toggleMenu);

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";

    if (isOpen) {
      toggleMenu();
    }
  });
});
