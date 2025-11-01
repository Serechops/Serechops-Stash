(function () {
  'use strict';

  const stash = window.stash || { setProgress: () => {} };
  console.log("🚀 BatchCreateAll ⚡ Ultra Speed Mode Initialized");

  const SHORT_DELAY = 10;
  let running = false;
  const createQueue = [];
  const tagQueue = [];

  const btnId = 'batch-create';
  const startLabel = 'Create All';
  const stopLabel = 'Stop';

  const btn = document.createElement("button");
  btn.id = btnId;
  btn.classList.add('btn', 'btn-primary', 'ml-3');
  btn.innerHTML = startLabel;
  btn.onclick = () => (running ? stop() : start());

  function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  function sortElementChildren(container) {
    const children = Array.from(container.children);
    children.sort((a, b) => a.textContent.localeCompare(b.textContent));
    children.forEach(child => container.appendChild(child));
  }

  function placeButton() {
    const el = getElementByXpath("//button[text()='Scrape All']");
    if (el && !document.getElementById(btnId)) {
      const container = el.parentElement;
      container.appendChild(btn);
      sortElementChildren(container);
      el.classList.add('ml-3');
    }
  }

  const observer = new MutationObserver(placeButton);
  observer.observe(document.body, { childList: true, subtree: true });

  function start() {
    if (!confirm("Run ultra-fast Create + Tag?")) return;
    running = true;
    btn.innerHTML = stopLabel;
    btn.classList.replace('btn-primary', 'btn-danger');
    stash.setProgress(0);
    buildQueues();
    processInParallel();
  }

  function stop() {
    running = false;
    btn.innerHTML = startLabel;
    btn.classList.replace('btn-danger', 'btn-primary');
    stash.setProgress(0);
    createQueue.length = 0;
    tagQueue.length = 0;
  }

  function buildQueues() {
    createQueue.length = 0;
    tagQueue.length = 0;

    document.querySelectorAll('.btn-group').forEach(group => {
      const placeholder = group.querySelector('.react-select__placeholder');
      if (!placeholder) return;

      const txt = placeholder.textContent.trim();
      if (txt === 'Select Performer' || txt === 'Select Studio') {
        const button = group.querySelector('button.btn.btn-secondary');
        if (button && button.textContent.trim() === 'Create' && !button.disabled) {
          createQueue.push(button);
        }
      }
    });

    document.querySelectorAll('.search-item button.minimal.ml-2.btn.btn-primary')
      .forEach(btn => tagQueue.push(btn));
  }

  async function processInParallel() {
    const total = createQueue.length + tagQueue.length;
    let processed = 0;

    const processCreate = async () => {
      while (running && createQueue.length) {
        const btn = createQueue.shift();
        if (!btn) break;
        btn.click();

        await delay(SHORT_DELAY); // let modal open
        const saveBtn = document.querySelector('.ModalFooter.modal-footer button.btn.btn-primary');
        if (saveBtn) saveBtn.click();
        processed++;
        stash.setProgress((processed / total) * 100);
        await delay(SHORT_DELAY);
      }
    };

    const processTags = async () => {
      while (running && tagQueue.length) {
        const tagBtn = tagQueue.shift();
        if (!tagBtn) break;
        tagBtn.click();
        processed++;
        stash.setProgress((processed / total) * 100);
        await delay(SHORT_DELAY);
      }
    };

    await Promise.all([processCreate(), processTags()]);
    stop();
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
})();
