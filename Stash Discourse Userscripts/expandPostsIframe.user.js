// ==UserScript==
// @name         Expand Parent Posts Inline with iFrame
// @namespace    https://discourse.stashapp.cc/
// @version      0.2
// @description  Expand parent posts and display sub-posts inline underneath the parent post with an interactive iFrame on Discourse forums.
// @author       Serechops
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash Discourse Userscripts/expandPostsIframe.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash Discourse Userscripts/expandPostsIframe.user.js
// @match        https://discourse.stashapp.cc/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Add the expand button next to each topic title
    function addExpandButtons() {
        const topicRows = document.querySelectorAll('tbody.topic-list-body tr');

        topicRows.forEach((row) => {
            const topicLink = row.querySelector('.raw-topic-link');
            if (topicLink && !row.querySelector('.expand-posts-btn')) {
                const button = document.createElement('button');
                button.innerText = 'Expand Posts';
                button.classList.add('expand-posts-btn');
                button.style.marginLeft = '10px';
                button.style.marginBottom = '10px';
                button.style.cursor = 'pointer';
                button.style.padding = '3px 9px';
                button.style.border = '1px solid #555';
                button.style.borderRadius = '4px';
                button.style.background = '#333';
                button.style.color = '#fff';
                button.style.fontSize = '14px';

                // Attach the click event to expand or collapse posts
                button.addEventListener('click', () => toggleSubPosts(topicLink.href, row, button));
                topicLink.parentNode.appendChild(button);
            }
        });
    }

    // Toggle sub-posts (expand or collapse) with iFrame
    function toggleSubPosts(url, parentRow, button) {
        const existingSubPosts = parentRow.nextElementSibling;

        if (existingSubPosts && existingSubPosts.classList.contains('sub-posts-container')) {
            // Collapse sub-posts if already expanded
            existingSubPosts.remove();
            button.innerText = 'Expand Posts';
        } else {
            // Expand sub-posts
            const subPostsContainer = document.createElement('tr');
            subPostsContainer.classList.add('sub-posts-container');
            subPostsContainer.style.background = '#2a2a2a';
            subPostsContainer.style.color = '#fff';

            subPostsContainer.innerHTML = `
                <td colspan="5" style="padding: 10px;">
                    <div style="margin: 0; padding: 0; position: relative;">
                        <p class="loading-message" style="margin: 0; color: #ccc;">Loading sub-post...</p>
                        <iframe src="${url}" style="width: 100%; height: 500px; border: none; margin-top: 10px; border-radius: 8px; background: #fff;"></iframe>
                    </div>
                </td>
            `;

            // Insert the container after the parent row
            parentRow.parentNode.insertBefore(subPostsContainer, parentRow.nextSibling);

            // Remove the loading message when the iframe is loaded
            const iframe = subPostsContainer.querySelector('iframe');
            iframe.addEventListener('load', () => {
                const loadingMessage = subPostsContainer.querySelector('.loading-message');
                if (loadingMessage) {
                    loadingMessage.remove();
                }
            });

            button.innerText = 'Collapse Posts';
        }
    }

    // Monitor for dynamic content changes
    function observeContent() {
        const observer = new MutationObserver(() => {
            addExpandButtons();
        });

        const target = document.querySelector('.topic-list-body');
        if (target) {
            observer.observe(target, { childList: true });
        }
    }

    // Initialize the script after DOM content is fully loaded
    function init() {
        const checkInterval = setInterval(() => {
            const topicList = document.querySelector('.topic-list-body');
            if (topicList) {
                addExpandButtons();
                observeContent();
                clearInterval(checkInterval); // Ensure this only runs once
            }
        }, 100); // Check every 100ms
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
