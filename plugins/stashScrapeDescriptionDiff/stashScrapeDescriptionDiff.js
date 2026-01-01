(async function () {
  'use strict';

  if (window.stashModalDiffLoaded) return;
  window.stashModalDiffLoaded = true;

  /* ---------------- Styles ---------------- */
  const style = document.createElement('style');
  style.textContent = `
    .stash-diff-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.6);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stash-diff-modal {
      background: #1e1e1e;
      color: #ddd;
      width: 80%;
      max-width: 900px;
      max-height: 80vh;
      padding: 1rem;
      border-radius: .5rem;
      display: flex;
      flex-direction: column;
    }

    .stash-diff-content {
      white-space: pre-wrap;
      overflow-y: auto;
      font-family: inherit;
      line-height: 1.4;
      padding: .75rem;
      border: 1px solid #444;
      background: #2a2a2a;
    }

    diff-ins {
      background: rgba(var(--bs-success-rgb), .6);
    }

    diff-del {
      background: rgba(var(--bs-danger-rgb), .6);
      text-decoration: line-through;
    }

    .stash-diff-footer {
      text-align: right;
      margin-top: .75rem;
    }
  `;
  document.head.appendChild(style);

  /* ---------------- Load jsdiff ---------------- */
  const loadDiff = () =>
    new Promise(res => {
      if (window.JsDiff) return res();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsdiff/2.0.2/diff.min.js';
      s.onload = res;
      document.head.appendChild(s);
    });

  /* ---------------- Helpers ---------------- */
  const normalize = text =>
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(l => l.replace(/\s+$/g, ''))
      .join('\n');

  const escapeHTML = s =>
    s.replace(/[&<>"']/g, m =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])
    );

  const buildDiffHTML = (oldText, newText) => {
    const a = normalize(oldText);
    const b = normalize(newText);

    const diff = JsDiff.diffWordsWithSpace(a, b);
    if (!diff.some(p => p.added || p.removed)) return null;

    return diff.map(p => {
      if (p.added)   return `<diff-ins>${escapeHTML(p.value)}</diff-ins>`;
      if (p.removed) return `<diff-del>${escapeHTML(p.value)}</diff-del>`;
      return escapeHTML(p.value);
    }).join('');
  };

  /* ---------------- Modal ---------------- */
  const showModal = html => {
    const backdrop = document.createElement('div');
    backdrop.className = 'stash-diff-modal-backdrop';

    const modal = document.createElement('div');
    modal.className = 'stash-diff-modal';

    const title = document.createElement('h3');
    title.textContent = 'Scene Description Diff';
    title.style.marginTop = '0';

    const content = document.createElement('div');
    content.className = 'stash-diff-content';
    content.innerHTML = html;

    const footer = document.createElement('div');
    footer.className = 'stash-diff-footer';

    const close = document.createElement('button');
    close.className = 'btn btn-secondary';
    close.textContent = 'Close';
    close.onclick = () => backdrop.remove();

    footer.appendChild(close);
    modal.append(title, content, footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  };

  /* ---------------- Injection ---------------- */
  const inject = async dialog => {
    const existing = dialog.querySelector(
      'div[data-field="details"] textarea[readonly]'
    );
    const scraped = dialog.querySelector(
      'div[data-field="details"] textarea:not([readonly])'
    );

    if (!existing || !scraped || scraped.dataset.diffReady) return;

    await loadDiff();

    const diffHTML = buildDiffHTML(existing.value, scraped.value);
    if (!diffHTML) return;

    const badge = document.createElement('span');
    badge.className = 'tag-item badge badge-secondary';
    badge.textContent = 'View Diff';
    badge.style.cursor = 'pointer';
    badge.onclick = () => showModal(diffHTML);

    scraped.closest('.input-group').after(badge);
    scraped.dataset.diffReady = '1';
  };

  /* ---------------- Observer ---------------- */
  new MutationObserver(muts =>
    muts.forEach(m =>
      m.addedNodes.forEach(n => {
        if (!(n instanceof HTMLElement)) return;
        n.querySelectorAll?.('.dialog-container').forEach(inject);
      })
    )
  ).observe(document.body, { childList: true, subtree: true });

})();
