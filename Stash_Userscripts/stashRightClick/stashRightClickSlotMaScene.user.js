// ==UserScript==
// @name         Stash Slot Ma-Scene
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      1.2
// @description  Adds a right-click menu to randomly suggest scenes with a slot machine animation.
// @match        http://localhost:9999/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickSlotMaScene.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/stashRightClickSlotMaScene.user.js
// @run-at       document-end
// ==/UserScript==

(async function() {
    'use strict';

    /******************************************
     * USER CONFIGURATION
     ******************************************/
    const userConfig = {
        scheme: 'http', // or 'https'
        host: 'localhost', // your server IP or hostname
        port: 9999, // your server port
        apiKey: '' // Replace with your actual API key
    };

    // Build API URL
    const apiUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // Inject CSS for the custom modal and right-click menu
    GM_addStyle(`
        #custom-menu {
            background-color: #000;
            background: rgba(0, 0, 0, 0.3);
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            position: absolute;
            border: 1px solid #ccc;
            z-index: 10000;
            padding: 10px;
        }

        #custom-menu a {
            display: block;
            margin-bottom: 5px;
            color: white;
            text-decoration: none;
        }

        #custom-menu a:hover {
            text-decoration: underline;
        }

        #random-modal {
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .random-modal-content {
            background: rgba(0, 0, 0, 0.8);
            margin: 5% auto;
            padding: 40px;
            border: 2px solid #888;
            width: 90%;
            max-width: 2000px;
            max-height: 80vh;
            overflow-y: auto;
            color: #fff;
            text-align: center;
        }

        .random-close {
            color: #aaa;
            float: right;
            font-size: 56px;
            font-weight: bold;
        }

        .random-close:hover,
        .random-close:focus {
            color: #fff;
            text-decoration: none;
            cursor: pointer;
        }

        .random-header {
            text-align: center;
            font-size: 48px;
            margin-bottom: 40px;
        }

        .slots-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 600px;
            margin-bottom: 40px;
        }

        .slot {
            width: 600px;
            height: 600px;
            margin: 0 20px;
            background-color: #333;
            border: 4px solid #fff;
            position: relative;
            overflow: hidden;
        }

        .slot img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.1s;
        }

        .slot-title {
            position: absolute;
            bottom: 100px;
            left: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.5);
            color: #fff;
            font-size: 32px;
            padding: 10px;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .watch-now {
            position: absolute;
            bottom: 20px;
            left: 20px;
            right: 20px;
            background: rgba(255, 0, 0, 0.8);
            color: #fff;
            font-size: 32px;
            padding: 10px;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
        }

        .watch-now:hover {
            background: rgba(255, 0, 0, 1);
        }
    `);

    // Function to create the custom menu
    function createCustomMenu(event) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';

        const randomSceneLink = document.createElement('a');
        randomSceneLink.href = '#';
        randomSceneLink.textContent = 'Stash Slot Ma-Scene';
        randomSceneLink.addEventListener('click', async function(e) {
            e.preventDefault();
            menu.remove();
            await showRandomModal();
        });
        menu.appendChild(randomSceneLink);

        document.body.appendChild(menu);

        // Adjust menu position to align to the left of the cursor
        const menuWidth = menu.offsetWidth;
        const menuLeft = event.pageX - menuWidth;
        const menuTop = event.pageY;

        menu.style.top = `${menuTop}px`;
        menu.style.left = `${menuLeft}px`;

        const handleClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', handleClickOutside);
            }
        };

        document.addEventListener('click', handleClickOutside);
    }

    // Function to show the random modal
    async function showRandomModal() {
        const modal = document.createElement('div');
        modal.id = 'random-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'random-modal-content';

        const header = document.createElement('div');
        header.className = 'random-header';
        header.textContent = 'Stash Slot Ma-Scene - Let Em Ride\!';
        modalContent.appendChild(header);

        const closeButton = document.createElement('span');
        closeButton.className = 'random-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => {
            modal.style.display = 'none';
            modal.remove();
        };
        modalContent.appendChild(closeButton);

        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'slots-container';
        slotsContainer.innerHTML = `
            <div class="slot" id="slot-1"><img src="" alt=""><div class="slot-title"></div><a class="watch-now" href="" target="_blank">Watch Now</a></div>
            <div class="slot" id="slot-2"><img src="" alt=""><div class="slot-title"></div><a class="watch-now" href="" target="_blank">Watch Now</a></div>
            <div class="slot" id="slot-3"><img src="" alt=""><div class="slot-title"></div><a class="watch-now" href="" target="_blank">Watch Now</a></div>
        `;
        modalContent.appendChild(slotsContainer);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Fetch random scenes and animate the slots
        try {
            const allScenes = await fetchAllScenes();
            animateSlots(allScenes);
        } catch (error) {
            console.error('Failed to fetch scenes.', error);
        }
    }

    // Function to fetch all scenes
    async function fetchAllScenes() {
        const query = `
            query AllScenes {
                allScenes {
                    id
                    title
                    performers {
                        name
                    }
                    studio {
                        name
                    }
                    paths {
                        screenshot
                    }
                }
            }
        `;
        const variables = {};

        const response = await graphqlRequest(query, variables, userConfig.apiKey);
        if (response.errors) {
            throw new Error(`GraphQL error: ${response.errors.map(e => e.message).join(', ')}`);
        }
        return response.data.allScenes;
    }

    // Function to perform the GraphQL request
    async function graphqlRequest(query, variables, apiKey) {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apikey': apiKey
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    // Function to animate the slots
    function animateSlots(allScenes) {
        const slots = [document.getElementById('slot-1'), document.getElementById('slot-2'), document.getElementById('slot-3')];

        // Show initial animation
        const totalScenes = allScenes.length;
        let interval;
        const startAnimation = () => {
            interval = setInterval(() => {
                slots.forEach(slot => {
                    const randomIndex = Math.floor(Math.random() * totalScenes);
                    const scene = allScenes[randomIndex];
                    slot.querySelector('img').src = scene.paths.screenshot;
                    slot.querySelector('.slot-title').textContent = scene.title;
                });
            }, 100);
        };

        startAnimation();

        // Stop animation and show final scenes
        setTimeout(() => {
            clearInterval(interval);
            const finalScenes = allScenes.sort(() => 0.5 - Math.random()).slice(0, 3);
            slots.forEach((slot, i) => {
                setTimeout(() => {
                    const scene = finalScenes[i];
                    slot.querySelector('img').src = scene.paths.screenshot;
                    slot.querySelector('.slot-title').textContent = scene.title;
                    slot.querySelector('.watch-now').href = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/scenes/${scene.id}`;
                    slot.querySelector('img').style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        slot.querySelector('img').style.transform = 'scale(1)';
                    }, 300);
                }, i * 500);
            });
        }, 5000);
    }

    // Add right-click event listener to the scenes nav link
    document.addEventListener('contextmenu', function(event) {
        const scenesNavLink = event.target.closest('div[data-rb-event-key="/scenes"]');
        if (scenesNavLink) {
            event.preventDefault();
            createCustomMenu(event);
        }
    });

})();
