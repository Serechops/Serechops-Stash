/********************************************************************
 * Scene Download Plugin
 *
 * Injects a download icon in the bottom-right corner of each scene card.
 * Clicking the icon will fetch the direct stream as a Blob, then prompt
 * the user to download it with a custom filename (title_date.mp4).
 ********************************************************************/

console.log("Scene Download Plugin loaded!");

// Listen for page changes (e.g. navigating between Scenes/Performers pages)
PluginApi.Event.addEventListener("stash:location", (e) => {
  console.log("stash:location fired => ", e.detail?.data?.location?.pathname);
  setupSceneDownloadButtons();
});

// Run once on initial load as well
setupSceneDownloadButtons();

/**
 * Main function: Waits for `.scene-card` elements and injects a download icon into each.
 */
function setupSceneDownloadButtons() {
  console.log("Setting up scene download buttons...");

  waitForElement(".scene-card", (sceneCard) => {
    // If this card already has a download icon, skip
    if (sceneCard.querySelector(".scene-download-icon")) {
      return;
    }

    // Find scene ID (parsing the href on .scene-card-link)
    const cardLink = sceneCard.querySelector(".scene-card-link");
    if (!cardLink) {
      console.warn("Scene card found with no .scene-card-link element:", sceneCard);
      return;
    }

    const href = cardLink.getAttribute("href") || "";
    const sceneIdMatch = href.match(/\/scenes\/(\d+)/);
    if (!sceneIdMatch) {
      console.warn("Could not parse scene ID from href:", href);
      return;
    }
    const sceneId = sceneIdMatch[1];
    console.log("Creating download link for scene ID:", sceneId);

    // Create the download link/icon
    const downloadLink = document.createElement("a");
    downloadLink.classList.add("scene-download-icon");
    downloadLink.style.position = "absolute";
    downloadLink.style.bottom = "5px";
    downloadLink.style.right = "5px";
    downloadLink.style.zIndex = "9999"; // ensure it's above other elements
    downloadLink.style.cursor = "pointer";
    downloadLink.style.fontSize = "18px";
    downloadLink.style.padding = "4px";
    downloadLink.style.color = "#fff"; // The icon color will match this
    downloadLink.title = "Download Scene";

    // Inline SVG icon (Font Awesome 6.7.2, fill="currentColor")
    downloadLink.innerHTML = `
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 512 512" 
        fill="currentColor" 
        aria-hidden="true"
        width="15"
        height="15"
      >
        <path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 242.7-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 
                 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3
                 s-32.8-12.5-45.3 0L288 274.7 288 32zM64 352c-35.3 0-64 28.7-64 64l0 32c0 35.3 28.7 64 64 64l384 0
                 c35.3 0 64-28.7 64-64l0-32c0-35.3-28.7-64-64-64l-101.5 0-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352 64 352zm368 56
                 a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"/>
      </svg>
    `;

    // On click: fetch the scene metadata (including paths, title, date) and then trigger download
    downloadLink.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      console.log("Download icon clicked for scene ID:", sceneId);

      const sceneData = await fetchSceneStreamData(sceneId);
      if (!sceneData || !sceneData.streamUrl) {
        console.error("Could not retrieve stream URL for scene", sceneId);
        return;
      }

      console.log(
        `Stream URL for scene "${sceneData.title}" (${sceneData.date}) =>`,
        sceneData.streamUrl
      );

      // Construct a filename from the scene's title/date
      const safeTitle = sanitizeFilename(sceneData.title || `scene-${sceneId}`);
      const safeDate = sanitizeFilename(sceneData.date || "");
      // Example format: Title_YYYY-MM-DD.mp4
      // Adjust format to your preference:
      const fileName = safeDate
        ? `${safeTitle}_${safeDate}.mp4`
        : `${safeTitle}.mp4`;

      // Use the fetch-as-Blob approach to reliably name the file
      await triggerDownloadAsBlob(sceneData.streamUrl, fileName);
    });

    // Ensure the card container is relatively positioned (for absolute child positioning)
    sceneCard.style.position = "relative";

    // Append the icon directly to the card.
    sceneCard.appendChild(downloadLink);
  });
}

/**
 * Queries Stash’s GraphQL for the direct stream path, title, and date.
 * We'll return an object with { streamUrl, title, date }.
 */
async function fetchSceneStreamData(sceneId) {
  // Include "title" and "date" in addition to "paths { stream }"
  const query = `
    query GetSceneStream($id: ID!) {
      findScene(id: $id) {
        title
        date
        paths {
          stream
        }
      }
    }
  `;

  try {
    const response = await fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // If Stash requires auth cookies
      body: JSON.stringify({
        query,
        variables: { id: sceneId },
      }),
    });

    if (!response.ok) {
      console.error("GraphQL fetch failed with status:", response.status);
      return null;
    }

    const json = await response.json();
    const scene = json?.data?.findScene;
    if (!scene) {
      console.warn("No 'findScene' data in response for scene", sceneId, json);
      return null;
    }

    // Extract the direct stream. Handle both array or object `paths`.
    let streamUrl = null;
    const paths = scene.paths;

    if (Array.isArray(paths) && paths.length > 0 && paths[0].stream) {
      streamUrl = paths[0].stream;
    } else if (!Array.isArray(paths) && paths.stream) {
      streamUrl = paths.stream;
    }

    return {
      streamUrl: streamUrl,
      title: scene.title || "",
      date: scene.date || "",
    };
  } catch (err) {
    console.error("Error fetching scene data:", err);
  }

  return null;
}

/**
 * Helper to sanitize a string for use as a filename (remove invalid characters, trim, etc.)
 */
function sanitizeFilename(str) {
  // Remove characters not allowed in Windows filenames: <>:"/\|?*
  return str
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "_");
}

/**
 * Downloads a file with a custom filename by:
 * 1. Fetching the file as a Blob
 * 2. Creating an object URL
 * 3. Triggering <a download="filename" href="blob:...">
 *
 * This approach bypasses any server "Content-Disposition" overrides.
 */
async function triggerDownloadAsBlob(url, filename) {
  console.log(`Fetching blob for: ${url}`);
  try {
    // If Stash is behind auth, you might need credentials: "include" here as well
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectURL;
    link.download = filename; // the name we want the user to see
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Optionally revoke the object URL after a timeout to free memory
    setTimeout(() => URL.revokeObjectURL(objectURL), 60 * 1000);
  } catch (err) {
    console.error("Error downloading blob:", err);
    alert("Failed to download the file. Check console for more info.");
  }
}

/**
 * Observe the DOM for new `.scene-card` elements and call `callback` for each.
 */
function waitForElement(selector, callback) {
  // Immediately call callback on any existing matches
  document.querySelectorAll(selector).forEach((el) => callback(el));

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
          callback(node);
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          node.querySelectorAll(selector).forEach((matched) => {
            callback(matched);
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
