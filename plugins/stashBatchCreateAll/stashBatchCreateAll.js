(function () {
    'use strict';

    /******************************************
     * USER CONFIGURATION - stashBatchCreateAll
     ******************************************/
    const userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // your server IP or hostname
        port: 9999, // your server port
        apiKey: '' // your API key
    };

    console.log("Script started");

    const DEFAULT_DELAY = 100; 
    let delay = DEFAULT_DELAY;
    let running = false;
    let maxCreateCount = 0;
    let maxTagCount = 0;

    async function run() {
        if (!running) return;

        const createButtons = document.querySelectorAll('.btn-group');
        const tagButtons = document.querySelectorAll('.search-item button.minimal.ml-2.btn.btn-primary');
        maxCreateCount = createButtons.length;
        maxTagCount = tagButtons.length;

        // Process 'Create' buttons
        for (const createButtonGroup of createButtons) {
            const selectPlaceholder = createButtonGroup.querySelector('.react-select__placeholder');
            const buttons = createButtonGroup.querySelectorAll('button.btn.btn-secondary');

            for (const button of buttons) {
                if (selectPlaceholder && (selectPlaceholder.textContent.trim() === 'Select Performer' || selectPlaceholder.textContent.trim() === 'Select Studio')) {
                    if (!button.disabled && button.textContent.trim() === 'Create') {
                        button.click();
                        await delayAction(delay); // Wait for the specified delay

                        // Click the 'Save' button in the modal footer of the new window
                        const saveButton = document.querySelector('.ModalFooter.modal-footer button.btn.btn-primary');
                        if (saveButton) {
                            saveButton.click();
                            await delayAction(delay); // Wait for the specified delay
                        }
                    }
                }
            }
        }

        // Process tags independently
        for (const tagbutton of tagButtons) {
            tagbutton.click();
            await delayAction(delay); // Wait for the specified delay
        }

        stop();
    }

    // Function to delay actions
    async function delayAction(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const btnId = 'batch-create';
    const startLabel = 'Create All';
    const stopLabel = 'Stop Create All';
    const btn = document.createElement("button");
    btn.setAttribute("id", btnId);
    btn.classList.add('btn', 'btn-primary', 'ml-3');
    btn.innerHTML = startLabel;
    btn.onclick = () => {
        if (running) {
            stop();
        }
        else {
            start();
        }
    };

    // Function to place the button using custom event logic
    function placeButton() {
        const el = getElementByXpath("//button[text()='Scrape All']");
        if (el && !document.getElementById(btnId)) {
            const container = el.parentElement;
            container.appendChild(btn);
            sortElementChildren(container);
            el.classList.add('ml-3');
        }
    }

    // Mutation observer to watch for changes in the DOM and place the button
    const observer = new MutationObserver(() => {
        placeButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    function start() {
        btn.innerHTML = stopLabel;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');
        running = true;
        run();
    }

    function stop() {
        btn.innerHTML = startLabel;
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
        running = false;
    }

    loadSettings(); // Initialize settings

    // Function to load settings if needed
    async function loadSettings() {
        // Add any logic if settings need to be loaded
    }

    // Function to get an element by XPath
    function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }

    // Function to sort children of a container element
    function sortElementChildren(container) {
        const children = Array.from(container.children);
        children.sort((a, b) => a.textContent.localeCompare(b.textContent));
        children.forEach(child => container.appendChild(child));
    }
})();
