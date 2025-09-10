// public/widget.js
(function () {
  // get script tag that loaded this file (supports older browsers)
  const currentScript = document.currentScript || (function () {
    const s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  const apiBase = currentScript.getAttribute('data-api') || 'https://your-vercel-domain.vercel.app';
  const translateEndpoint = apiBase.replace(/\/$/, '') + '/api/translate';

  // add styles
  const cssHref = (currentScript.getAttribute('data-css') || apiBase + '/widget.css');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.appendChild(link);

  // Create widget
  const widget = document.createElement('div');
  widget.id = 'my-widget';
  widget.innerHTML = `
    <div>
      <select id="widget-language">
        <option value="en">English</option>
        <option value="fr">French</option>
        <option value="es">Spanish</option>
      </select>
      <button id="widget-translate">Translate Page</button>
    </div>
  `;
  document.body.appendChild(widget);

  // helper filters (material icons, code, svg, hidden)
  function shouldIgnore(node) {
    if (!node || !node.parentNode) return true;
    const parent = node.parentNode;
    if (!node.nodeValue || !node.nodeValue.trim()) return true;

    const tag = parent.tagName;
    if (!tag) return true;
    const ignoreTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'IFRAME', 'SVG', 'CANVAS'];
    if (ignoreTags.includes(tag)) return true;

    const cls = parent.className || '';
    const ignoredClasses = ['material-icons', 'iconify', 'svg-icon', 'admin-bar', 'editor-toolbar'];
    for (let c of ignoredClasses) if (cls && cls.includes(c)) return true;

    const style = window.getComputedStyle(parent);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return true;

    // short heuristic: URLs, emails, file paths — skip
    const txt = node.nodeValue.trim();
    if (/https?:\/\/|www\.|@|\/[^\s]+(\.[a-z]{2,})/.test(txt)) return true;

    return false;
  }

  function collectTextNodes(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let n;
    while (n = walker.nextNode()) {
      if (!shouldIgnore(n)) nodes.push(n);
    }
    return nodes;
  }

  // map node -> text index
  function buildBatch(nodes) {
    const texts = [];
    for (const n of nodes) {
      const t = n.nodeValue.trim();
      if (t) texts.push(t);
    }
    return texts;
  }

  async function translateAndApply(targetLang) {
    const nodes = collectTextNodes();
    const texts = buildBatch(nodes);
    if (!texts.length) return;

    let translated = [];
    try {
      const resp = await fetch(translateEndpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({texts, target: targetLang})
      });
      const json = await resp.json();
      translated = json.translated || json.translated || [];
    } catch (err) {
      console.error('translation error', err);
      return;
    }

    // apply translations back to nodes — be conservative with index mapping
    for (let i = 0, j = 0; i < nodes.length && j < translated.length; i++) {
      const node = nodes[i];
      const orig = node.nodeValue.trim();
      if (!orig) continue;
      node.nodeValue = node.nodeValue.replace(orig, translated[j]);
      j++;
    }
  }

  // hook UI
  const select = widget.querySelector('#widget-language');
  const button = widget.querySelector('#widget-translate');
  button.addEventListener('click', () => translateAndApply(select.value));

  // Optional: observe dynamic content and lazy-translate (debounce)
  const observer = new MutationObserver(muts => {
    // simple debounced auto-translate could be added here if wanted
  });
  observer.observe(document.body, {childList: true, subtree: true});
})();
