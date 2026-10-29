/** Заглушка рекламы для web: полноэкранный оверлей на durationMs. */
export function showAdOverlay(durationMs = 2000): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.setAttribute('role', 'dialog');
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;' +
      'justify-content:center;background:rgba(0,0,0,.9);color:#fff;font:600 20px sans-serif;';
    el.textContent = 'Реклама (заглушка)';
    document.body.appendChild(el);
    setTimeout(() => {
      el.remove();
      resolve();
    }, durationMs);
  });
}
