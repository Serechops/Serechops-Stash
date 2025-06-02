// imageAnnotation.plugin.js
// --------------------------
// Stash UI plugin that:
//   1. Adds an “Annotations” section under Details with buttons: Annotate, Clear, Export All, Import.
//   2. Stores annotations as percentages of image dimensions (xPct, yPct, wPct, hPct), plus a chosen color.
//   3. Loads & draws annotations on page load—scaled to whatever the <img> size is, using stored color.
//   4. Lets you toggle “Annotate” mode on/off to draw new rectangles.
//   5. Persists every annotation to IndexedDB, so they survive reloads.
//   6. Uses an inline text input (rather than prompt()) for annotation text, plus a color picker.
//   7. Automatically redraws annotations on window resize.
//   8. Allows resizing each annotation via a small bottom‐right “handle.”
//
// Installation: drop this file in your Stash `plugins/` folder. Reload Stash.
//
// ---------------------------------------------------------------------------

(function() {
  // -------------------------------------------------------------------------
  // Section A: IndexedDB “mini database” for annotations (percentage‐based + color)
  // -------------------------------------------------------------------------
  const DB_NAME    = 'StashImageAnnotations';
  const STORE_NAME = 'annotations';
  const DB_VERSION = 1;

  class AnnotationDB {
    constructor() {
      this.db = null;
    }

    async initDB() {
      if (this.db) return this.db;
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'imageId' });
            store.createIndex('byImageId', 'imageId', { unique: true });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB error:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    async getAnnotations(imageId) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(imageId);
        req.onsuccess = (e) => {
          const record = e.target.result;
          resolve(record && Array.isArray(record.annotations) ? record.annotations : []);
        };
        req.onerror = (e) => {
          console.error('getAnnotations error:', e.target.error);
          reject(e.target.error);
        };
      });
    }

    async saveAnnotations(imageId, annotationsArray) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const payload = { imageId, annotations: annotationsArray };
        const req = store.put(payload);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          console.error('saveAnnotations error:', e.target.error);
          reject(e.target.error);
        };
      });
    }

    async addAnnotation(imageId, annotation) {
      const existing = await this.getAnnotations(imageId);
      existing.push(annotation);
      return this.saveAnnotations(imageId, existing);
    }

    async clearAnnotations(imageId) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(imageId);
        req.onsuccess = () => resolve();
        req.onerror = (e) => {
          console.error('clearAnnotations error:', e.target.error);
          reject(e.target.error);
        };
      });
    }

    async getAllRecords() {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const all = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            all.push(cursor.value);
            cursor.continue();
          } else {
            resolve(all);
          }
        };
        cursorReq.onerror = (e) => {
          console.error('getAllRecords error:', e.target.error);
          reject(e.target.error);
        };
      });
    }

    async importRecords(recordsArray) {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const rec of recordsArray) {
          store.put(rec);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => {
          console.error('importRecords error:', e.target.error);
          reject(e.target.error);
        };
      });
    }
  }

  const annotationDB = new AnnotationDB();


  // -------------------------------------------------------------------------
  // Section B: Main plugin logic (percentage‐based coordinates + color + resize)
  // -------------------------------------------------------------------------
  let annotations      = [];      // in‐memory for current image (array of {xPct,yPct,wPct,hPct,label,color})
  let isAnnotating     = false;
  let overlayDiv       = null;
  let currentImageId   = null;

  // Helper: get numeric imageId from the <img> src (e.g. “/image/4995/…”).
  function getImageIdFromPage() {
    const img = document.querySelector('.image-container img');
    if (!img) return null;
    const src = img.src;
    const m   = src.match(/\/image\/(\d+)\//);
    return m ? parseInt(m[1], 10) : null;
  }

  // Load annotations from IndexedDB for the current image, then redraw scaled to current <img> size.
  async function loadAnnotationsForPage() {
    const imgId = getImageIdFromPage();
    if (imgId === null) {
      annotations = [];
      currentImageId = null;
      return;
    }
    currentImageId = imgId;
    try {
      annotations = await annotationDB.getAnnotations(imgId);
    } catch (err) {
      console.error('Error loading annotations from DB:', err);
      annotations = [];
    }
    redrawAnnotations();
  }

  // Remove existing annotation boxes, then append one for each entry in `annotations[]`.
  function redrawAnnotations() {
    // Clear old wrappers
    document.querySelectorAll('.image-container .annotation-box-wrapper')
      .forEach(el => el.remove());

    // Recreate each one
    annotations.forEach((a, idx) => {
      createAnnotationBoxFromPct(
        a.xPct, a.yPct, a.wPct, a.hPct,
        a.label, a.color,
        idx
      );
    });
  }

  /**
   * Convert a hex color string "#RRGGBB" into an {r,g,b} object.
   */
  function hexToRgb(hex) {
    const clean = hex.replace(/^#/, '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }

  /**
   * Create a box based on percentage coordinates.
   * Each argument (xPct, yPct, wPct, hPct) is in [0,1].
   * We multiply by the image’s current width/height to get pixels,
   * then offset inside the container so it “sticks” exactly over the <img>.
   */
  function createAnnotationBoxFromPct(xPct, yPct, wPct, hPct, label, color = '#e74c3c', idx) {
    const imgContainer = document.querySelector('.image-container');
    if (!imgContainer) return;

    const img = imgContainer.querySelector('img');
    if (!img) return;

    // Figure out where the <img> lives inside the container
    const imgRect = img.getBoundingClientRect();
    const containerRect = imgContainer.getBoundingClientRect();
    const offsetLeft = imgRect.left - containerRect.left;
    const offsetTop  = imgRect.top  - containerRect.top;

    // Current displayed size of the image
    const imgW = img.clientWidth;
    const imgH = img.clientHeight;

    // Convert percentages back into pixel‐relative‐to‐image:
    let xPx = xPct * imgW;
    let yPx = yPct * imgH;
    let wPx = wPct * imgW;
    let hPx = hPct * imgH;

    // Absolute position inside the container = img offset + xPx/yPx:
    const absLeft = offsetLeft + xPx;
    const absTop  = offsetTop  + yPx;

    const wrapper = document.createElement('div');
    wrapper.classList.add('annotation-box-wrapper');
    Object.assign(wrapper.style, {
      position:   'absolute',
      left:       `${absLeft}px`,
      top:        `${absTop}px`,
      width:      `${wPx}px`,
      height:     `${hPx}px`,
      cursor:     'move',
      zIndex:     '2000',
      boxSizing:  'border-box'
    });

    // Make the box draggable (unless the user clicks the handle)
    wrapper.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('resize-handle')) {
        return;
      }
      e.stopPropagation();

      let startMouseX = e.clientX;
      let startMouseY = e.clientY;
      const origLeftPx = absLeft;
      const origTopPx  = absTop;

      function onDrag(e2) {
        const dx = e2.clientX - startMouseX;
        const dy = e2.clientY - startMouseY;
        const newLeft = origLeftPx + dx;
        const newTop  = origTopPx  + dy;

        wrapper.style.left = `${newLeft}px`;
        wrapper.style.top  = `${newTop}px`;
      }

      function onDrop(e3) {
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', onDrop);

        const finalLeftPx = parseFloat(wrapper.style.left);
        const finalTopPx  = parseFloat(wrapper.style.top);

        // Convert back into percentages relative to the image
        const relXpx = finalLeftPx - offsetLeft;
        const relYpx = finalTopPx  - offsetTop;
        const newXPct = relXpx / img.clientWidth;
        const newYPct = relYpx / img.clientHeight;

        annotations[idx].xPct = newXPct;
        annotations[idx].yPct = newYPct;
        annotationDB.saveAnnotations(currentImageId, annotations).catch(err => {
          console.error('Error saving dragged annotation:', err);
        });

        // Update the stored xPx/yPx in case the user drags again
        xPx = relXpx;
        yPx = relYpx;
      }

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDrop);
    });

    // Convert hex to rgb once:
    const { r, g, b } = hexToRgb(color);

    // The “colored box” that fills 100% of the wrapper
    const box = document.createElement('div');
    box.classList.add('annotation-box');
    Object.assign(box.style, {
      width:           '100%',
      height:          '100%',
      border:          `2px solid ${color}`,
      backgroundColor: `rgba(${r},${g},${b},0.2)`,
      boxSizing:       'border-box',
      position:        'relative'
    });

    // Add a bottom‐right resize handle
    const handle = document.createElement('div');
    handle.classList.add('resize-handle');
    Object.assign(handle.style, {
      width:           '10px',
      height:          '10px',
      backgroundColor: color,
      position:        'absolute',
      right:           '0',
      bottom:          '0',
      cursor:          'nwse-resize',
      boxSizing:       'border-box'
    });

    // Resize logic (updates wPct/hPct on mouseup)
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();

      // Starting rectangle in absolute pixels:
      const rect = wrapper.getBoundingClientRect();
      let origWidthPx  = rect.width;
      let origHeightPx = rect.height;
      let startMouseX  = e.clientX;
      let startMouseY  = e.clientY;

      function onResize(e2) {
        const dx = e2.clientX - startMouseX;
        const dy = e2.clientY - startMouseY;
        const newWpx = Math.max(origWidthPx + dx, 10);
        const newHpx = Math.max(origHeightPx + dy, 10);
        wrapper.style.width  = `${newWpx}px`;
        wrapper.style.height = `${newHpx}px`;
      }

      function onResizeEnd(e3) {
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', onResizeEnd);

        const finalWpx = parseFloat(wrapper.style.width);
        const finalHpx = parseFloat(wrapper.style.height);

        // Convert back to percentages relative to the image
        const newWPct = finalWpx / img.clientWidth;
        const newHPct = finalHpx / img.clientHeight;
        annotations[idx].wPct = newWPct;
        annotations[idx].hPct = newHPct;
        annotationDB.saveAnnotations(currentImageId, annotations).catch(err => {
          console.error('Error saving resized annotation:', err);
        });

        // Update stored wPx/hPx for potential future resize
        wPx = finalWpx;
        hPx = finalHpx;
      }

      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', onResizeEnd);
    });

    // Add a little “label bubble” above the box
    const badge = document.createElement('span');
    badge.classList.add('annotation-label');
    badge.textContent = label;
    Object.assign(badge.style, {
      position:        'absolute',
      top:             '-20px',
      left:            '0',
      backgroundColor: color,
      color:           'white',
      padding:         '2px 4px',
      fontSize:        '12px',
      borderRadius:    '3px',
      whiteSpace:      'nowrap'
    });

    box.appendChild(handle);
    wrapper.appendChild(box);
    wrapper.appendChild(badge);
    imgContainer.appendChild(wrapper);
  }


  // Enable “Annotate” mode: overlay a transparent div and listen for drawing events
  function enableAnnotationMode() {
    const imgContainer = document.querySelector('.image-container');
    if (!imgContainer) {
      console.warn('imageAnnotation: .image-container not found.');
      return;
    }
    const img = imgContainer.querySelector('img');
    if (!img) {
      console.warn('imageAnnotation: <img> not found.');
      return;
    }

    // Position overlayDiv exactly over the img’s bounding box
    const imgRect       = img.getBoundingClientRect();
    const containerRect = imgContainer.getBoundingClientRect();
    const offsetLeft    = imgRect.left - containerRect.left;
    const offsetTop     = imgRect.top  - containerRect.top;

    overlayDiv = document.createElement('div');
    overlayDiv.classList.add('annotation-overlay');
    Object.assign(overlayDiv.style, {
      position:        'absolute',
      left:            `${offsetLeft}px`,
      top:             `${offsetTop}px`,
      width:           `${img.clientWidth}px`,
      height:          `${img.clientHeight}px`,
      cursor:          'crosshair',
      backgroundColor: 'rgba(0,0,0,0)',
      zIndex:          '1000'
    });

    let startX = 0, startY = 0;
    let tempRect = null;
    let inputContainer = null;

    function onMouseDown(e) {
      if (e.button !== 0) return; // only left‐click
      const rect = overlayDiv.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;

      tempRect = document.createElement('div');
      tempRect.classList.add('temp-annotation-rect');
      Object.assign(tempRect.style, {
        position:        'absolute',
        border:          '2px dashed #ff0',
        backgroundColor: 'rgba(255,255,0,0.2)',
        left:            `${startX}px`,
        top:             `${startY}px`,
        width:           '0px',
        height:          '0px',
        pointerEvents:   'none',
        zIndex:          '1001'
      });
      overlayDiv.appendChild(tempRect);

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
      if (!tempRect) return;
      const rect = overlayDiv.getBoundingClientRect();
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const wPx = Math.abs(curX - startX);
      const hPx = Math.abs(curY - startY);
      const leftPx = Math.min(curX, startX);
      const topPx  = Math.min(curY, startY);

      Object.assign(tempRect.style, {
        left:  `${leftPx}px`,
        top:   `${topPx}px`,
        width:  `${wPx}px`,
        height: `${hPx}px`
      });
    }

    function onMouseUp(e) {
      if (!tempRect) return;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const rect = overlayDiv.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      const xPx = Math.min(startX, endX);
      const yPx = Math.min(startY, endY);
      const wPx = Math.abs(endX - startX);
      const hPx = Math.abs(endY - startY);

      overlayDiv.removeChild(tempRect);
      tempRect = null;

      // If too small, abort
      if (wPx < 5 || hPx < 5) {
        return;
      }

      // Show inline input box + color picker at (xPx, yPx)
      inputContainer = document.createElement('div');
      inputContainer.classList.add('annotation-input-container');
      Object.assign(inputContainer.style, {
        position:        'absolute',
        left:            `${xPx}px`,
        top:             `${yPx}px`,
        zIndex:          '2002',
        backgroundColor: 'white',
        border:          '1px solid #ccc',
        padding:         '4px',
        borderRadius:    '4px',
        display:         'flex',
        alignItems:      'center',
        gap:             '4px',
        boxShadow:       '0 2px 6px rgba(0,0,0,0.15)'
      });

      // Color picker
      const colorInput = document.createElement('input');
      colorInput.type  = 'color';
      colorInput.value = '#e74c3c'; // default
      Object.assign(colorInput.style, {
        width:  '28px',
        height: '28px',
        padding: '0',
        border: 'none',
        margin: '0'
      });

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.placeholder = 'Annotation text';
      Object.assign(textInput.style, {
        fontSize:     '12px',
        padding:      '2px 4px',
        border:       '1px solid #ccc',
        borderRadius: '2px',
        flexGrow:     '1'
      });

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      Object.assign(saveBtn.style, {
        fontSize: '12px',
        padding:  '2px 6px',
        backgroundColor: '#007bff',
        color:    'white',
        border:   'none',
        borderRadius: '2px',
        cursor:   'pointer'
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '✕';
      Object.assign(cancelBtn.style, {
        fontSize: '12px',
        padding:  '2px 6px',
        backgroundColor: '#dc3545',
        color:    'white',
        border:   'none',
        borderRadius: '2px',
        cursor:   'pointer'
      });

      inputContainer.appendChild(colorInput);
      inputContainer.appendChild(textInput);
      inputContainer.appendChild(saveBtn);
      inputContainer.appendChild(cancelBtn);
      overlayDiv.appendChild(inputContainer);
      textInput.focus();

      function cleanupInput() {
        if (inputContainer) {
          inputContainer.remove();
          inputContainer = null;
        }
      }

      saveBtn.addEventListener('click', async () => {
        const label = textInput.value.trim();
        if (!label) {
          cleanupInput();
          return;
        }
        const chosenColor = colorInput.value;

        // Convert to percentages relative to the image
        const imgWpx = img.clientWidth;
        const imgHpx = img.clientHeight;
        const xPct = xPx / imgWpx;
        const yPct = yPx / imgHpx;
        const wPct = wPx / imgWpx;
        const hPct = hPx / imgHpx;

        const annotationObj = { xPct, yPct, wPct, hPct, label, color: chosenColor };
        annotations.push(annotationObj);
        if (currentImageId !== null) {
          try {
            await annotationDB.addAnnotation(currentImageId, annotationObj);
          } catch (err) {
            console.error('Failed to save annotation in DB:', err);
          }
        }
        // Draw it
        createAnnotationBoxFromPct(xPct, yPct, wPct, hPct, label, chosenColor, annotations.length - 1);
        cleanupInput();
      });

      cancelBtn.addEventListener('click', cleanupInput);
    }

    overlayDiv.addEventListener('mousedown', onMouseDown);
    imgContainer.appendChild(overlayDiv);

    // Draw existing annotations on top of the overlay
    redrawAnnotations();
  }

  function disableAnnotationMode() {
    if (overlayDiv) {
      overlayDiv.remove();
      overlayDiv = null;
    }
  }


  // -------------------------------------------------------------------------
  // Section C: “Clear”, “Export”, “Import” support
  // -------------------------------------------------------------------------
  async function clearCurrentImageAnnotations() {
    if (currentImageId === null) return;
    await annotationDB.clearAnnotations(currentImageId);
    annotations = [];
    redrawAnnotations();
  }

  async function exportAllAnnotations() {
    try {
      const allRecords = await annotationDB.getAllRecords();
      const blob = new Blob([JSON.stringify(allRecords, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stash-image-annotations.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting annotations:', err);
    }
  }

  function importAnnotationsFromFile() {
    let fileInput = document.getElementById('annotation-import-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'annotation-import-input';
      fileInput.accept = 'application/json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (!Array.isArray(imported)) {
              throw new Error('JSON root must be an array of {imageId, annotations: [...]} objects');
            }
            for (const rec of imported) {
              if (typeof rec.imageId !== 'number' || !Array.isArray(rec.annotations)) {
                throw new Error('Invalid record format');
              }
            }
            await annotationDB.importRecords(imported);
            if (currentImageId !== null) {
              const reloaded = await annotationDB.getAnnotations(currentImageId);
              annotations = reloaded;
              redrawAnnotations();
            }
            alert('Import successful!');
          } catch (err) {
            console.error('Error importing annotations:', err);
            alert('Failed to import: ' + err.message);
          }
          fileInput.value = ''; // reset
        };
        reader.readAsText(file);
      });
    }
    fileInput.click();
  }


  // -------------------------------------------------------------------------
  // Section D: Insert annotation controls under “Details” (no duplicates + header)
  // -------------------------------------------------------------------------
  function injectAnnotationControlsUnderDetails() {
    waitForElement('label[for="details"]', (detailsLabel) => {
      if (document.querySelector('.annotation-controls-container')) {
        return;
      }

      // Wrapper for header + buttons
      const wrapper = document.createElement('div');
      wrapper.classList.add('annotation-controls-container');
      wrapper.style.marginBottom = '8px';
      wrapper.style.marginTop    = '8px';

      // Header
      const header = document.createElement('h6');
      header.textContent = 'Annotations';
      header.style.marginBottom = '4px';
      wrapper.appendChild(header);

      // Button bar
      const buttonBar = document.createElement('div');
      buttonBar.classList.add('annotation-controls');
      buttonBar.style.display    = 'flex';
      buttonBar.style.alignItems = 'center';
      buttonBar.style.gap        = '8px';

      // Annotate toggle
      const annotateBtn = document.createElement('button');
      annotateBtn.textContent = 'Annotate';
      annotateBtn.type = 'button';
      annotateBtn.classList.add('btn', 'btn-secondary', 'annotate-button');
      annotateBtn.addEventListener('click', async () => {
        isAnnotating = !isAnnotating;
        annotateBtn.textContent = isAnnotating ? 'Exit Annotate' : 'Annotate';
        if (isAnnotating) {
          await loadAnnotationsForPage();
          enableAnnotationMode();
        } else {
          disableAnnotationMode();
        }
      });
      buttonBar.appendChild(annotateBtn);

      // Clear
      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Clear';
      clearBtn.type = 'button';
      clearBtn.classList.add('btn', 'btn-warning', 'clear-button');
      clearBtn.addEventListener('click', async () => {
        if (confirm('Delete all annotations for this image?')) {
          await clearCurrentImageAnnotations();
        }
      });
      buttonBar.appendChild(clearBtn);

      // Export All
      const exportBtn = document.createElement('button');
      exportBtn.textContent = 'Export All';
      exportBtn.type = 'button';
      exportBtn.classList.add('btn', 'btn-info', 'export-button');
      exportBtn.addEventListener('click', exportAllAnnotations);
      buttonBar.appendChild(exportBtn);

      // Import
      const importBtn = document.createElement('button');
      importBtn.textContent = 'Import';
      importBtn.type = 'button';
      importBtn.classList.add('btn', 'btn-success', 'import-button');
      importBtn.addEventListener('click', importAnnotationsFromFile);
      buttonBar.appendChild(importBtn);

      wrapper.appendChild(buttonBar);

      // Insert below “Details”
      const formGroup = detailsLabel.closest('.form-group');
      if (formGroup) {
        formGroup.insertAdjacentElement('afterend', wrapper);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Section E: Utility to wait for an element via MutationObserver
  // -------------------------------------------------------------------------
  function waitForElement(selector, callback) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches(selector)) {
              callback(node);
            }
            node.querySelectorAll && node.querySelectorAll(selector).forEach(callback);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree:   true
    });

    // Also fire for any matches already in the DOM:
    document.querySelectorAll(selector).forEach(callback);
    return () => observer.disconnect();
  }

  // -------------------------------------------------------------------------
  // Section F: Hook into Stash page changes & initial load
  // -------------------------------------------------------------------------
  PluginApi.Event.addEventListener('stash:location', () => {
    setTimeout(async () => {
      injectAnnotationControlsUnderDetails();

      if (isAnnotating) {
        disableAnnotationMode();
        isAnnotating = false;
      }
      await loadAnnotationsForPage();
    }, 50);
  });

  document.addEventListener('DOMContentLoaded', async () => {
    injectAnnotationControlsUnderDetails();
    await loadAnnotationsForPage();
  });

  // -------------------------------------------------------------------------
  // Section G: Redraw on window resize
  // -------------------------------------------------------------------------
  window.addEventListener('resize', () => {
    if (currentImageId !== null) {
      redrawAnnotations();
    }
  });

  // -------------------------------------------------------------------------
  // Section H: Initialize the IndexedDB immediately
  // -------------------------------------------------------------------------
  annotationDB.initDB().catch(err => {
    console.error('Failed to initialize IndexedDB for annotations:', err);
  });

  // -------------------------------------------------------------------------
  // Section I: Reapply boxes whenever the <img> appears or reloads
  // -------------------------------------------------------------------------
  function watchForImageElement() {
    waitForElement('.image-container img', (img) => {
      function onImgLoad() {
        // Now that the image is present and sized, load + draw annotations
        loadAnnotationsForPage();
      }

      // If it’s already cached/complete, call right away:
      if (img.complete) {
        onImgLoad();
      }
      // Otherwise wait for the load event:
      img.addEventListener('load', onImgLoad);
    });
  }

  // -------------------------------------------------------------------------
  // SECTION J: “Early” watchers so that a straight‐refresh or direct URL always works
  // -------------------------------------------------------------------------
  // 1) Start watching for the <img> immediately, even before stash:location fires.
  watchForImageElement();

  // 2) Start watching for “Details” label right away, so that our controls appear
  injectAnnotationControlsUnderDetails();

  // 3) Also re‐watch after stash navigations (just in case):
  PluginApi.Event.addEventListener('stash:location', () => {
    setTimeout(watchForImageElement, 50);
    setTimeout(injectAnnotationControlsUnderDetails, 50);
  });
})();
