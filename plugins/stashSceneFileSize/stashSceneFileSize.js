// Function to display the file size within the scene card
function displayFileSizeInSceneCard() {
    waitForElement('.scene-card', (element) => {
        const fileSizeOverlay = element.querySelector('span.overlay-filesize');

        if (fileSizeOverlay) {
            // Check if file size is already displayed
            if (!fileSizeOverlay.dataset.displayed) {
                const fileSize = fileSizeOverlay.textContent.trim();

                // Create a new span element to display the file size
                const fileSizeSpan = document.createElement('span');
                fileSizeSpan.textContent = `${fileSize}`;
                fileSizeSpan.style.color = 'white'; 
                fileSizeSpan.style.backgroundColor = 'none'; 
                fileSizeSpan.style.marginRight = '1px';
                
                // Find the resolution span to prepend the file size before it
                const resolutionSpan = element.querySelector('span.overlay-resolution');
                if (resolutionSpan) {
                    // Insert the file size span before the resolution span
                    resolutionSpan.insertAdjacentElement('beforebegin', fileSizeSpan);
                }

                // Mark this file size as displayed to avoid duplication
                fileSizeOverlay.dataset.displayed = true;
            }
        }
    });
}

// Initial call to display the file size within the scene card
displayFileSizeInSceneCard();

// Set up a listener for any stash page change if needed
PluginApi.Event.addEventListener("stash:location", () => {
    console.log('Page changed, re-checking for file size display...');
    displayFileSizeInSceneCard();
});

// Modified waitForElement function
function waitForElement(selector, callback) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.matches(selector)) {
                    callback(node);
                }
                // If the node has children, recursively check each child node that matches the selector
                node.querySelectorAll && node.querySelectorAll(selector).forEach(callback);
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Function to stop observing
    function stopObserving() {
        observer.disconnect();
    }

    return stopObserving;
}
