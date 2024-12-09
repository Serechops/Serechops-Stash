/**
 * Stash Enhanced Dropdown Plugin with Help and Extended Documentation
 * -------------------------------------------------------------------
 * This script demonstrates how to integrate custom UI elements into Stash,
 * query Stash's GraphQL API, generate code snippets for further integration,
 * and provide inline help for new developers.
 *
 * HOW TO USE:
 * 1. Copy and paste this entire script into Stash at:
 *    Settings -> Interface -> Custom JavaScript
 * 2. Refresh Stash. You'll see "Open Actions" and "Help" buttons in the navbar.
 * 3. Click "Open Actions" to try queries and generate code snippets.
 * 4. Click "Help" for guidance, links, and tips on customizing this script.
 *
 * FUTURE STEPS:
 * - Add more queries and actions in the config.
 * - Explore variable-based queries.
 * - Integrate results into more complex UI elements (grids, tables).
 * - Use the downloaded code snippets as starting points for your own plugins.
 */

(async function () {
    'use strict';

    // Prevent multiple initializations if included more than once
    if (window.stashEnhancedDropdownPluginLoaded) {
        console.log("Stash Enhanced Dropdown Plugin is already loaded");
        return;
    }
    window.stashEnhancedDropdownPluginLoaded = true;

    console.log("Stash Enhanced Dropdown Plugin started");

    /**
     * CONFIGURATION
     * -------------
     * Adjust these values based on your environment and desired functionality.
     * If you are new, try modifying 'queries' or adding another action in 'actionSelect'.
     */
    const config = {
        // GraphQL endpoint and authentication
        gqlEndpoint: localStorage.getItem('apiEndpoint') || '/graphql',
        apiKey: localStorage.getItem('apiKey') || null,

        // UI insertion point in Stash
        parentSelector: '.navbar-buttons',

        // Button that opens the main Actions modal
        mainButton: {
            id: 'open-actions-modal-btn',
            text: 'Open Actions',
            className: 'btn btn-secondary',
            style: { marginLeft: '8px' }
        },

        // A Help button to open an instructional modal
        helpButton: {
            id: 'open-help-modal-btn',
            text: 'Help',
            className: 'btn btn-info',
            style: { marginLeft: '8px' }
        },

        // Modal for choosing actions and generating code
        modal: {
            id: 'actions-modal',
            title: 'Choose an Action',
            bodyHTML: `
                <p style="font-size: 14px; margin-bottom:10px;">
                  Select an action below to run a sample GraphQL query and see the results.
                  Then, click "Generate Code" to download a JS file that you can paste into
                  Stash for a custom navbar button performing that action.
                </p>
                <div style="margin-bottom:10px;">
                    <label for="action-select">Select an Action:</label>
                    <select id="action-select" style="width:100%;padding:5px;margin-top:5px;">
                        <option value="">-- Choose an Action --</option>
                        <option value="performerCount">Get Performer Count</option>
                        <option value="sceneCount">Get Scene Count</option>
                    </select>
                </div>
                <div id="results-container" style="margin-top:15px; min-height: 50px;">
                    <!-- Results or status messages appear here -->
                </div>
            `,
            footerHTML: `
                <button class="btn btn-light" id="fetch-action">Fetch</button>
                <button class="btn btn-light" id="generate-code">Generate Code</button>
                <button class="btn btn-secondary" id="close-modal">Close</button>
            `
        },

        // A dedicated Help modal providing guidance and links
        helpModal: {
            id: 'help-modal',
            title: 'How to Use & Next Steps',
            bodyHTML: `
                <h3 style="margin-top:0;">Getting Started</h3>
                <p>
                  This script injects custom UI elements into Stash. You've already seen how to:
                  <ul>
                    <li>Create custom buttons in the navbar</li>
                    <li>Open a modal to run queries</li>
                    <li>Generate code snippets for standalone integration</li>
                  </ul>
                </p>
                <h3>Resources</h3>
                <p>
                  - Stash Docs: <a href="https://docs.stashapp.cc/" target="_blank">docs.stashapp.cc</a><br/>
                  - GraphQL Tutorial: <a href="https://graphql.org/learn/" target="_blank">graphql.org/learn</a><br/>
                  - Stash Community (Discord/GitHub): Find advice, share code, and learn from others.
                </p>
                <h3>Next Steps</h3>
                <p>
                  Try editing the script in Custom JS:
                  <ul>
                    <li>Add new actions with different queries (see commented examples at the bottom of this script).</li>
                    <li>Use variables in queries to filter results dynamically.</li>
                    <li>Create more advanced UI elements: forms, grids, image previews.</li>
                  </ul>
                </p>
                <p style="font-size:12px;color:#aaa;">
                  Tip: Keep iterating. Start small and gradually build more complex features.
                </p>
            `,
            footerHTML: `
                <button class="btn btn-secondary" id="close-help-modal">Close</button>
            `
        },

        // Queries for dropdown actions
        queries: {
            performerCount: `
                query FindPerformers {
                    findPerformers(
                        performer_filter: { scene_count: { value: 0, modifier: GREATER_THAN } }
                        filter: { per_page: -1 }
                    ) {
                        count
                        performers {
                            name
                        }
                    }
                }
            `,
            sceneCount: `
                query FindScenes {
                    findScenes(filter: { per_page: -1 }) {
                        count
                        scenes {
                            title
                        }
                    }
                }
            `
        }
    };

    /**
     * @function gqlHeaders
     * @description Creates headers for GraphQL requests. If an API key is set, it adds an Authorization header.
     * @returns {Object} Headers object suitable for fetch calls.
     */
    const gqlHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        return headers;
    };

    /**
     * @function performGraphQLQuery
     * @description Executes a GraphQL query against the configured endpoint.
     * @param {string} query - The GraphQL query string.
     * @param {Object} variables - Variables for the GraphQL query (optional).
     * @returns {Object|null} The data field from the JSON response, or null on error.
     */
    const performGraphQLQuery = async (query, variables = {}) => {
        try {
            const response = await fetch(config.gqlEndpoint, {
                method: 'POST',
                headers: gqlHeaders(),
                body: JSON.stringify({ query, variables }),
            });
            const data = await response.json();
            return data?.data || null;
        } catch (error) {
            console.error('Error performing GraphQL query:', error);
            return null;
        }
    };

    /**
     * @function createButton
     * @description Creates a button with given properties and event.
     * @param {string} id - Unique ID for the button.
     * @param {string} text - Button text.
     * @param {string} className - CSS classes (e.g., "btn btn-secondary").
     * @param {Object} style - Inline styles as an object (e.g., {marginLeft:'8px'}).
     * @param {Function} onClick - Event handler for click events.
     * @returns {HTMLElement} The created button element.
     */
    const createButton = (id, text, className, style, onClick) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = text;
        btn.type = 'button';
        btn.className = className;
        Object.assign(btn.style, style);
        if (onClick) btn.addEventListener('click', onClick);
        return btn;
    };

    /**
     * @function createDarkModal
     * @description Creates a dark-themed modal with a backdrop.
     * @param {string} id - Modal ID.
     * @param {string} title - Modal title.
     * @param {string} bodyHTML - Inner HTML for the body.
     * @param {string} footerHTML - Inner HTML for the footer (buttons, etc.).
     * @returns {Object} An object with show/hide methods and references to DOM elements.
     */
    const createDarkModal = (id, title, bodyHTML, footerHTML) => {
        const backdrop = document.createElement('div');
        backdrop.id = `${id}-backdrop`;
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.backgroundColor = 'rgba(0,0,0,0.5)';
        backdrop.style.display = 'flex';
        backdrop.style.justifyContent = 'center';
        backdrop.style.alignItems = 'center';
        backdrop.style.zIndex = '9999';
        backdrop.style.visibility = 'hidden';

        const modal = document.createElement('div');
        modal.id = id;
        modal.style.backgroundColor = '#1e1e1e';
        modal.style.color = '#ccc';
        modal.style.padding = '20px';
        modal.style.borderRadius = '8px';
        modal.style.width = '400px';
        modal.style.maxWidth = '90%';
        modal.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

        const header = document.createElement('h2');
        header.textContent = title;
        header.style.marginTop = '0';
        header.style.marginBottom = '10px';
        header.style.color = '#fff';
        modal.appendChild(header);

        const body = document.createElement('div');
        body.innerHTML = bodyHTML;
        modal.appendChild(body);

        const footer = document.createElement('div');
        footer.innerHTML = footerHTML;
        footer.style.marginTop = '20px';
        footer.style.textAlign = 'right';
        modal.appendChild(footer);

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const closeModal = () => { backdrop.style.visibility = 'hidden'; };
        const closeBtn = footer.querySelector('#close-modal');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // For help modal close
        const helpCloseBtn = footer.querySelector('#close-help-modal');
        if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeModal);

        return {
            show: () => { backdrop.style.visibility = 'visible'; },
            hide: closeModal,
            backdrop,
            modal
        };
    };

    // Create our main modals
    const modalInstance = createDarkModal(config.modal.id, config.modal.title, config.modal.bodyHTML, config.modal.footerHTML);
    const helpModalInstance = createDarkModal(config.helpModal.id, config.helpModal.title, config.helpModal.bodyHTML, config.helpModal.footerHTML);

    /**
     * @function generateCodeSnippet
     * @description Generates a code snippet for a standalone JS file that, when loaded, adds a custom button to Stash.
     * @param {string} actionKey - The selected action (e.g., "performerCount").
     * @param {string} query - The GraphQL query associated with this action.
     * @returns {string} A fully-formed JS script.
     */
    const generateCodeSnippet = (actionKey, query) => {
        let parseLogic = '';
        if (actionKey === 'performerCount') {
            parseLogic = `
            if (result && result.findPerformers) {
                const { count } = result.findPerformers;
                alert("Performers Count: " + count);
            } else {
                alert("No data found or query failed.");
            }`;
        } else if (actionKey === 'sceneCount') {
            parseLogic = `
            if (result && result.findScenes) {
                const { count } = result.findScenes;
                alert("Scene Count: " + count);
            } else {
                alert("No data found or query failed.");
            }`;
        } else {
            parseLogic = `alert("Query executed, check console for results.");`;
        }

        return `
(async function () {
    'use strict';

    // This script adds a custom button to the Stash navbar
    // that, when clicked, performs the chosen action.
    // Paste this into Stash's Custom JS or serve it locally.

    if (window.customActionButtonLoaded) return;
    window.customActionButtonLoaded = true;

    const gqlEndpoint = localStorage.getItem('apiEndpoint') || '/graphql';
    const apiKey = localStorage.getItem('apiKey') || null;

    const gqlHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = \`Bearer \${apiKey}\`;
        return headers;
    };

    const performGraphQLQuery = async (query, variables = {}) => {
        try {
            const response = await fetch(gqlEndpoint, {
                method: 'POST',
                headers: gqlHeaders(),
                body: JSON.stringify({ query, variables }),
            });
            const data = await response.json();
            return data?.data || null;
        } catch (error) {
            console.error('Error performing GraphQL query:', error);
            return null;
        }
    };

    const addButton = () => {
        const parent = document.querySelector('.navbar-buttons');
        if (!parent) return;

        const btn = document.createElement('button');
        btn.textContent = "Custom ${actionKey} Button";
        btn.type = "button";
        btn.className = "btn btn-secondary";
        btn.style.marginLeft = "8px";

        btn.addEventListener('click', async () => {
            const result = await performGraphQLQuery(\`${query}\`);
            ${parseLogic}
        });

        parent.appendChild(btn);
    };

    const observer = new MutationObserver(() => {
        const parent = document.querySelector('.navbar-buttons');
        if (parent) {
            observer.disconnect();
            addButton();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
        `.trim();
    };

    /**
     * @function downloadSnippetAsFile
     * @description Downloads the generated code snippet as a .js file.
     * @param {string} filename - Name of the file (e.g., 'custom-performerCount-button.js').
     * @param {string} content - The JS code content.
     */
    const downloadSnippetAsFile = (filename, content) => {
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * MAIN INITIALIZATION LOGIC
     * -------------------------
     * The observer waits for '.navbar-buttons' to appear in the DOM,
     * then adds our "Open Actions" and "Help" buttons.
     */
    const initializeUI = () => {
        const parent = document.querySelector(config.parentSelector);
        if (!parent) {
            console.error(`Parent container not found: ${config.parentSelector}`);
            return;
        }

        // Main button: Opens the Actions modal
        if (!document.getElementById(config.mainButton.id)) {
            const mainBtn = createButton(
                config.mainButton.id,
                config.mainButton.text,
                config.mainButton.className,
                config.mainButton.style,
                () => { modalInstance.show(); }
            );
            parent.appendChild(mainBtn);
            console.log(`Main button added: ${config.mainButton.text}`);
        }

        // Help button: Opens the Help modal
        if (!document.getElementById(config.helpButton.id)) {
            const helpBtn = createButton(
                config.helpButton.id,
                config.helpButton.text,
                config.helpButton.className,
                config.helpButton.style,
                () => { helpModalInstance.show(); }
            );
            parent.appendChild(helpBtn);
            console.log(`Help button added: ${config.helpButton.text}`);
        }

        // Attach event listeners inside the Actions modal
        const fetchBtn = modalInstance.backdrop.querySelector('#fetch-action');
        const generateCodeBtn = modalInstance.backdrop.querySelector('#generate-code');
        const actionSelect = modalInstance.backdrop.querySelector('#action-select');
        const resultsContainer = modalInstance.backdrop.querySelector('#results-container');

        if (fetchBtn && actionSelect && resultsContainer) {
            fetchBtn.addEventListener('click', async () => {
                const selectedValue = actionSelect.value;
                resultsContainer.textContent = ''; // Clear previous results

                if (!selectedValue) {
                    resultsContainer.textContent = 'Please select an action first.';
                    return;
                }

                const query = config.queries[selectedValue];
                if (!query) {
                    resultsContainer.textContent = 'No query available for this action.';
                    return;
                }

                resultsContainer.textContent = 'Fetching...';
                const result = await performGraphQLQuery(query);

                // Display results
                if (selectedValue === 'performerCount' && result && result.findPerformers) {
                    const { count } = result.findPerformers;
                    resultsContainer.textContent = `Total Performers with >0 Scenes: ${count}`;
                } else if (selectedValue === 'sceneCount' && result && result.findScenes) {
                    const { count } = result.findScenes;
                    resultsContainer.textContent = `Total Scenes: ${count}`;
                } else {
                    resultsContainer.textContent = 'No data found or query failed.';
                }
            });
        }

        if (generateCodeBtn && actionSelect && resultsContainer) {
            generateCodeBtn.addEventListener('click', () => {
                const selectedValue = actionSelect.value;
                if (!selectedValue) {
                    resultsContainer.textContent = 'Please select an action first.';
                    return;
                }

                const query = config.queries[selectedValue];
                if (!query) {
                    resultsContainer.textContent = 'No query available for this action.';
                    return;
                }

                // Generate code snippet and download it
                const snippet = generateCodeSnippet(selectedValue, query);
                const filename = `custom-${selectedValue}-button.js`;
                downloadSnippetAsFile(filename, snippet);

                resultsContainer.textContent = `Code downloaded as ${filename}.`;
            });
        }
    };

    // Use MutationObserver to wait for .navbar-buttons to appear
    const observer = new MutationObserver(() => {
        const parent = document.querySelector(config.parentSelector);
        if (parent) {
            observer.disconnect();
            initializeUI();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Stash Enhanced Dropdown Plugin fully initialized");


    /**
     * ADDITIONAL EXAMPLES & NEXT STEPS
     * --------------------------------
     * Below are commented queries and notes. Uncomment or add new queries to try them out!
     *
     * // Example: Counting Studios
     * // Add an <option value="studioCount">Get Studio Count</option> in the dropdown
     * // and add a query here:
     * // queries: {
     * //   ...,
     * //   studioCount: `
     * //       query {
     * //           findStudios(filter: { per_page: -1 }) {
     * //               count
     * //           }
     * //       }
     * //   `
     * // }
     *
     * Then handle it like performerCount/sceneCount in fetchBtn's logic.
     *
     * SUGGESTIONS:
     * - Try adding a variable-based query (e.g., find a performer by name).
     * - Add input fields in the modal to let the user type a name or ID.
     * - Explore the Stash schema to find other interesting data to query.
     *
     * The idea is that by starting with these building blocks, you can create
     * interactive, data-driven UIs on top of your Stash instance.
     */
})();
