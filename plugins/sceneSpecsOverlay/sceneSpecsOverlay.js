function addSlideUpEffect() {
    waitForElement('.scene-card', (element) => {
        // Find the scene specs overlay
        const sceneSpecsOverlay = element.querySelector('.scene-specs-overlay');
        const cardSection = element.querySelector('.card-section');

        if (sceneSpecsOverlay && cardSection) {
            // Apply initial hidden state using inline styles for scene specs
            sceneSpecsOverlay.style.position = 'absolute';
            sceneSpecsOverlay.style.bottom = '10px';
            sceneSpecsOverlay.style.left = 'auto';
            sceneSpecsOverlay.style.width = 'auto';
            sceneSpecsOverlay.style.height = 'auto';
            sceneSpecsOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
            sceneSpecsOverlay.style.color = 'white';
            sceneSpecsOverlay.style.padding = '5px';
            sceneSpecsOverlay.style.boxSizing = 'border-box';
            sceneSpecsOverlay.style.textAlign = 'center';
            sceneSpecsOverlay.style.borderRadius = '4px';
            sceneSpecsOverlay.style.transform = 'translateY(100%)';
            sceneSpecsOverlay.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out';
            sceneSpecsOverlay.style.opacity = '0';
            sceneSpecsOverlay.style.visibility = 'hidden';
            sceneSpecsOverlay.style.zIndex = '9';

            // Ensure the card section is positioned correctly
            cardSection.style.position = 'relative';

            // Apply the hover effect to the .scene-card
            element.addEventListener('mouseover', () => {
                sceneSpecsOverlay.style.transform = 'translateY(0)';
                sceneSpecsOverlay.style.opacity = '1';
                sceneSpecsOverlay.style.visibility = 'visible';
            });

            element.addEventListener('mouseout', () => {
                sceneSpecsOverlay.style.transform = 'translateY(100%)';
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
