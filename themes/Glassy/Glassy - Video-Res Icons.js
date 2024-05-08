// Custom Resolution Icons in Scene Card

const resolutionMap = {
    '480p': 'https://imgur.com/qZZczlK.png',
    '720p': 'https://imgur.com/7yw1fBI.png',
    '1080p': 'https://imgur.com/O3FanXv.png',
    '1440p': 'https://imgur.com/9y7a1cZ.png',
    '4K': 'https://imgur.com/rI3crtx.png',
    '5K': 'https://imgur.com/8TCEWHH.png',
    '6K': 'https://imgur.com/QSgCChT.png',
    '8K': 'https://imgur.com/1KXygPI.png',
    '16K': 'https://imgur.com/rN7XKqt.png'
    
};

function setupElementObserver() {
    waitForElement('.scene-card.zoom-1.grid-card.card', (element) => {
        const overlays = element.querySelectorAll('span.overlay-resolution');
        overlays.forEach(overlay => {
            const resolution = overlay.textContent.trim();
            if (resolutionMap[resolution]) {
                // Create an image element
                const img = document.createElement('img');
                img.src = resolutionMap[resolution]; // Link to the image from the map
                img.alt = resolution;

                // Apply CSS styles to position the image
                img.style.position = 'absolute';
                img.style.top = '0';
                img.style.right = '0';
                img.style.transform = 'translateY(-190px)'; // Adjust this as needed

                // Replace the overlay span with the image
                overlay.replaceWith(img);
            }
        });
    });
}

// Initial call to handle elements on the current page
setupElementObserver();

// Set up a listener for any stash page change
stash.addEventListener('stash:page:any', () => {
    console.log('Page changed, re-checking for elements...');
    setupElementObserver();
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