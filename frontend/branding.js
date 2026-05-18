(function () {
  const BRAND_ICON = "ʕ´•ᴥ•`ʔ";
  const FAVICON_SELECTOR = "link[rel='icon'], link[rel='shortcut icon']";

  function getFaviconHref() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="16" fill="#2b5fb8"/>
        <rect x="2.5" y="2.5" width="59" height="59" rx="13.5" fill="none" stroke="rgba(255,255,255,0.18)"/>
        <text x="32" y="36" text-anchor="middle" dominant-baseline="middle"
          font-family="Segoe UI, Trebuchet MS, sans-serif" font-size="12.5"
          font-weight="700" letter-spacing="-1.1" fill="#ffffff">${BRAND_ICON}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  function applyBrandIcons() {
    document.querySelectorAll("[data-brand-icon]").forEach((node) => {
      node.textContent = BRAND_ICON;
    });
  }

  function applyFavicon() {
    const head = document.head;
    if (!head) {
      return;
    }

    let favicon = head.querySelector(FAVICON_SELECTOR);
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      head.appendChild(favicon);
    }

    favicon.setAttribute("type", "image/svg+xml");
    favicon.setAttribute("href", getFaviconHref());
  }

  function applyBranding() {
    applyBrandIcons();
    applyFavicon();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBranding, { once: true });
  } else {
    applyBranding();
  }
})();
