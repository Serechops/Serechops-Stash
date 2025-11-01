(function () {
  'use strict';

  const {
    stash,
    getElementByXpath,
    getElementsByXpath,
    getClosestAncestor,
    sortElementChildren,
    createElementFromHTML,
  } = window.stash7dJx1qP;

  let settings = null;
  const removedFingerprints = [];
  let running = false;
  let sceneId = null;
  let buttons = [];
  let maxCount = 0;

  const batchSize = 5; // Adjust concurrency here

  async function loadSettings() {
    if (!settings) {
      settings = await stash.getPluginConfig('stashBatchSave');
      if (!settings || settings.enableFingerprints === undefined) {
        settings = { enableFingerprints: false };
        await stash.updatePluginConfig('stashBatchSave', settings);
      }
    }
  }

  function isEnableFingerprints() {
    return settings?.enableFingerprints === true;
  }

  async function updateFingerprintQueue() {
    if (isEnableFingerprints()) return;

    const tagger = await localforage.getItem('tagger');
    if (Array.isArray(tagger?.fingerprintQueue?.[tagger?.selectedEndpoint])) {
      tagger.fingerprintQueue[tagger.selectedEndpoint] =
        tagger.fingerprintQueue[tagger.selectedEndpoint].filter(o => !removedFingerprints.includes(o));
    }
    await localforage.setItem('tagger', tagger);

    const el = getElementByXpath("//span[contains(text(), 'Submit') and contains(text(), 'Fingerprint')]");
    if (el) {
      const fpCount = tagger.fingerprintQueue[tagger.selectedEndpoint].length;
      el.innerText = `Submit ${fpCount} Fingerprint${fpCount !== 1 ? 's' : ''}`;
      if (removedFingerprints.length) {
        el.innerText += ` (${removedFingerprints.length} Batch Saved)`;
      }
    }
  }

  function debounceAsync(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(async () => {
          try {
            resolve(await func.apply(this, args));
          } catch (err) {
            reject(err);
          }
        }, delay);
      });
    };
  }

  const debouncedUpdateFingerprintQueue = debounceAsync(updateFingerprintQueue, 100);

  async function processSceneUpdate(evt) {
    if (!running || !evt.detail.data?.sceneUpdate?.id) return;
    removedFingerprints.push(evt.detail.data.sceneUpdate.id);
    requestAnimationFrame(runParallel);
  }

  stash.addEventListener('stash:request', evt => {
    if (!isEnableFingerprints() && evt.detail?.body) {
      const body = JSON.parse(evt.detail.body);
      if (body.operationName === "SubmitStashBoxFingerprints") {
        body.variables.input.scene_ids = body.variables.input.scene_ids.filter(id => !removedFingerprints.includes(id));
        evt.detail.body = JSON.stringify(body);
      }
    }
  });

  function collectSaveButtons() {
    return [...document.querySelectorAll('.btn.btn-primary')]
      .filter(btn => btn.textContent.trim() === 'Save' && !btn.disabled);
  }

  async function runParallel() {
    if (!running || buttons.length === 0) {
      stop();
      return;
    }

    stash.setProgress((maxCount - buttons.length) / maxCount * 100);

    const batch = buttons.splice(0, batchSize);
    batch.forEach(btn => {
      const searchItem = getClosestAncestor(btn, '.search-item');
      if (!searchItem || searchItem.classList.contains('d-none')) return;

      const { id } = stash.parseSearchItem(searchItem);
      sceneId = id;
      btn.click();
    });

    requestAnimationFrame(runParallel);
  }

  function stop() {
    running = false;
    stash.setProgress(0);
    btn.innerText = 'Save All';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    stash.removeEventListener('stash:response', processSceneUpdate);
  }

  function start() {
    if (!confirm("Are you sure you want to batch save?")) return;

    running = true;
    stash.setProgress(0);
    buttons = collectSaveButtons();
    maxCount = buttons.length;

    btn.innerText = 'Stop Save';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');

    stash.addEventListener('stash:response', processSceneUpdate);
    runParallel();
  }

  const btnId = 'batch-save';
  const btn = document.createElement('button');
  btn.setAttribute('id', btnId);
  btn.className = 'btn btn-primary ml-3';
  btn.textContent = 'Save All';
  btn.onclick = () => (running ? stop() : start());

  stash.addEventListener('tagger:mutations:header', () => {
    const el = getElementByXpath("//button[text()='Scrape All']");
    if (el && !document.getElementById(btnId)) {
      el.parentElement.appendChild(btn);
      sortElementChildren(el.parentElement);
      el.classList.add('ml-3');
    }
  });

  stash.addEventListener('tagger:mutations:searchitems', async () => {
    const taggerContainer = document.querySelector('.tagger-container');
    const saveBtn = getElementByXpath("//button[text()='Save']", taggerContainer);
    btn.style.display = saveBtn ? 'inline-block' : 'none';
    await debouncedUpdateFingerprintQueue();
  });

  async function initRemoveButtons() {
    const nodes = getElementsByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']");
    const btns = [];
    let node;
    while ((node = nodes.iterateNext())) btns.push(node);

    for (const button of btns) {
      const searchItem = getClosestAncestor(button, '.search-item');
      if (searchItem.querySelector('.tagger-remove')) continue;

      const removeEl = createElementFromHTML(`
        <div class="mt-2 text-right tagger-remove">
          <button class="btn btn-danger">Remove</button>
        </div>
      `);
      const removeButton = removeEl.querySelector('button');
      removeButton.onclick = () => searchItem.classList.add('d-none');
      button.closest('.col-md-6')?.appendChild(removeEl);
    }
  }

  const pages = ['page:studio', 'page:tag', 'page:performer', 'page:scenes', 'page:studio:scenes', 'page:tag:scenes', 'page:performer:scenes'];
  pages.forEach(evt =>
    stash.addEventListener(evt, () => {
      stash.waitForElementByXpath("//button[contains(@class, 'btn-primary') and text()='Scrape by fragment']", initRemoveButtons);
    })
  );

  // Init settings on load
  loadSettings();
})();
