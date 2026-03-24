(() => {
  const cfg = window.__scrollLockConfig || {};
  const storageKey = cfg.storageKey || `scroll-lock:${window.location.pathname}`;
  const formSelector = cfg.formSelector || 'form.scroll-form';
  const includeGet = Boolean(cfg.includeGet);
  const containerSelector = cfg.containerSelector || '.main-content';

  function getScrollContainer() {
    const el = document.querySelector(containerSelector);
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const canScroll = el.scrollHeight > el.clientHeight;
    const overflowY = style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
    return canScroll && isScrollable ? el : null;
  }

  function getWindowScrollY() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function saveScrollPosition() {
    const container = getScrollContainer();
    const payload = {
      windowY: getWindowScrollY(),
      containerY: container ? container.scrollTop : 0,
      ts: Date.now()
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch (_) {
      // no-op
    }
  }

  function restoreScrollPosition() {
    let payload;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      payload = JSON.parse(raw);
    } catch (_) {
      return;
    }

    const apply = () => {
      const y = Number(payload.windowY || 0);
      if (y > 0) window.scrollTo(0, y);

      const container = getScrollContainer();
      const cy = Number(payload.containerY || 0);
      if (container && cy > 0) container.scrollTop = cy;
    };

    apply();
    requestAnimationFrame(apply);
    setTimeout(apply, 80);
    setTimeout(() => {
      apply();
      try {
        sessionStorage.removeItem(storageKey);
      } catch (_) {
        // no-op
      }
    }, 250);
  }

  function wireForms() {
    const forms = document.querySelectorAll(formSelector);
    forms.forEach((form) => {
      form.addEventListener('submit', () => {
        const method = (form.getAttribute('method') || 'GET').toUpperCase();
        if (includeGet || method !== 'GET') saveScrollPosition();
      }, { capture: true });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireForms();
    restoreScrollPosition();
  });
})();
