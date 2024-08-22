function addSlideUpEffect() {
    waitForElement('.scene-card', (element) => {
        // Find the scene specs overlay
        const sceneSpecsOverlay = element.querySelector('.scene-specs-overlay');
        const thumbnailSection = element.querySelector('.thumbnail-section');

        if (sceneSpecsOverlay && thumbnailSection) {
            // Apply initial hidden state using inline styles
            sceneSpecsOverlay.style.position = 'absolute';
            sceneSpecsOverlay.style.bottom = '1';
            sceneSpecsOverlay.style.left = 'auto'; // Position it at the bottom right
            sceneSpecsOverlay.style.width = 'auto'; // Width adjusts to the content
            sceneSpecsOverlay.style.height = 'auto'; // Height adjusts to the content
            sceneSpecsOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
            sceneSpecsOverlay.style.color = 'white';
            sceneSpecsOverlay.style.padding = '5px';
            sceneSpecsOverlay.style.boxSizing = 'border-box';
            sceneSpecsOverlay.style.textAlign = 'center';
            sceneSpecsOverlay.style.borderRadius = '4px'; // Rounded corners
            sceneSpecsOverlay.style.transform = 'translateY(30%)'; // Slightly hidden initially
            sceneSpecsOverlay.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
            sceneSpecsOverlay.style.opacity = '0';
            sceneSpecsOverlay.style.visibility = 'hidden';
            sceneSpecsOverlay.style.zIndex = '9';

            // Ensure the thumbnail section is positioned correctly
            thumbnailSection.style.position = 'relative';
            thumbnailSection.style.overflow = 'hidden';

            // Apply the hover effect to the .scene-card
            element.addEventListener('mouseover', () => {
                sceneSpecsOverlay.style.transform = 'translateY(0)'; // Move into view
                sceneSpecsOverlay.style.opacity = '1';
                sceneSpecsOverlay.style.visibility = 'visible';
            });

            element.addEventListener('mouseout', () => {
                sceneSpecsOverlay.style.transform = 'translateY(30%)'; // Partially hidden
                sceneSpecsOverlay.style.opacity = '0';
                sceneSpecsOverlay.style.visibility = 'hidden';
            });
        }
    });
}

// Initial call to add the slide-up effect
addSlideUpEffect();

// Set up a listener for any stash page change if needed
PluginApi.Event.addEventListener("stash:location", () => {
    console.log('Page changed, adding slide-up effect...');
    addSlideUpEffect();
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
