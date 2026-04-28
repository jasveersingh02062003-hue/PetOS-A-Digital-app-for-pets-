/**
 * Keyboard-only "Skip to main content" link.
 * Visually hidden until focused (Tab as first action on the page).
 * Targets the element with id="main-content" rendered by AppShell.
 */
export const SkipToContent = () => (
  <a href="#main-content" className="skip-link">
    Skip to main content
  </a>
);