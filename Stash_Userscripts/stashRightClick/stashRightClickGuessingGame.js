// ==UserScript==
// @name         Who's In Your Stash?
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      2.2
// @description  Adds a performer guessing game to the Performers nav link in Stash.
// @match        http://localhost:9999/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @connect      localhost
// @require      https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js
// @downloadURL  https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/performersGuessingGame.user.js
// @updateURL    https://github.com/Serechops/Serechops-Stash/raw/main/Stash_Userscripts/stashRightClick/performersGuessingGame.user.js
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
        apiKey: '' // your API key
    };

    // Build API URL
    const apiUrl = `${userConfig.scheme}://${userConfig.host}:${userConfig.port}/graphql`;

    // Inject CSS for the custom menu and modal
    GM_addStyle(`
        @import url('https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.css');

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

        #custom-modal {
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

        .custom-modal-content {
            background: rgba(0, 0, 0, 0.8);
            margin: 5% auto;
            padding: 20px;
            border: 1px solid #888;
            width: 80%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            color: #fff;
        }

        .custom-close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
        }

        .custom-close:hover,
        .custom-close:focus {
            color: #fff;
            text-decoration: none;
            cursor: pointer;
        }

        .custom-game-header {
            text-align: center;
            font-size: 24px;
            margin-bottom: 20px;
        }

        .custom-blurred-image {
            width: 50%;
            height: auto;
            filter: blur(10px);
            margin-bottom: 20px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }

        .custom-question {
            margin-bottom: 20px;
            font-size: 18px;
            text-align: center;
        }

        .custom-clues {
            margin-bottom: 20px;
            font-size: 16px;
        }

        .custom-answer {
            padding: 10px;
            border: 1px solid #ccc;
            cursor: pointer;
            margin-bottom: 10px;
            background-color: #333;
            color: #fff;
            text-align: center;
            text-transform: uppercase; /* Convert text to all caps */
        }

        .custom-answer:hover {
            background-color: #444;
        }

        .custom-result {
            margin-top: 20px;
            font-size: 20px;
            text-align: center;
        }

        .custom-result.correct {
            color: #4CAF50; /* Green */
        }

        .custom-result.incorrect {
            color: #F44336; /* Red */
        }

        .loading-animation {
            text-align: center;
            font-size: 18px;
            margin-top: 20px;
        }

        .custom-scene-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
            margin-top: 20px;
        }

        .custom-scene-card {
            background: rgba(0, 0, 0, 0.7);
            padding: 10px;
            border: 1px solid #ccc;
            text-align: center;
        }

        .custom-scene-title {
            font-size: 14px;
            margin-bottom: 5px;
        }

        .custom-scene-image {
            width: 100%;
            height: auto;
            margin-bottom: 5px;
        }

        .custom-scene-performer {
            font-size: 12px;
            margin-bottom: 5px;
            text-transform: uppercase; /* Convert text to all caps */
        }

        .custom-watch-now {
            font-size: 12px;
            color: #4CAF50;
            text-decoration: underline;
            cursor: pointer;
        }
    `);

    // Function to fetch all performers with scene count > 3
    async function fetchPerformers() {
        const query = `
            query AllPerformers {
                allPerformers {
                    id
                    name
                    birthdate
                    country
                    ethnicity
                    scene_count
                    image_count
                    gallery_count
                    movie_count
                    performer_count
                    o_counter
                    image_path
                    scenes {
                        id
                        title
                        studio {
                            name
                        }
                        paths {
                            screenshot
                            stream
                        }
                    }
                    movies {
                        name
                    }
                }
            }
        `;
        try {
            const response = await graphqlRequest(query, {}, config.apiKey);
            return response.data.allPerformers.filter(p => p.scene_count > 3 && !p.image_path.includes('default=true'));
        } catch (error) {
            console.error('Error fetching performers:', error);
            return [];
        }
    }

    // Function to create and show the custom modal for the game
    async function showGameModal() {
        const performers = await fetchPerformers();
        let currentRound = 0;
        const totalRounds = 5;
        let score = 0;
        const guessedPerformers = [];

        const modal = document.createElement('div');
        modal.id = 'custom-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'custom-modal-content';

        const header = document.createElement('div');
        header.className = 'custom-game-header';
        header.innerHTML = `
            <h2>Who\'s In Your Stash?</h2>
            <p>The following are three clues about your performer. Good luck!</p>
        `;
        modalContent.appendChild(header);

        const closeButton = document.createElement('span');
        closeButton.className = 'custom-close';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => {
            modal.style.display = 'none';
            modal.remove();
        };

        modalContent.appendChild(closeButton);

        const imageElement = document.createElement('img');
        imageElement.className = 'custom-blurred-image';
        modalContent.appendChild(imageElement);

        const cluesElement = document.createElement('ol');
        cluesElement.className = 'custom-clues';
        modalContent.appendChild(cluesElement);

        const questionElement = document.createElement('div');
        questionElement.className = 'custom-question';
        modalContent.appendChild(questionElement);

        const answersContainer = document.createElement('div');
        modalContent.appendChild(answersContainer);

        const resultElement = document.createElement('div');
        resultElement.className = 'custom-result';
        modalContent.appendChild(resultElement);

        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading-animation';
        loadingElement.textContent = 'Finding Facts...';
        modalContent.appendChild(loadingElement);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        const updateModalForRound = (performer) => {
            loadingElement.style.display = 'none';
            imageElement.style.display = 'block';
            cluesElement.style.display = 'block';
            questionElement.style.display = 'block';
            answersContainer.style.display = 'block';
            resultElement.style.display = 'none';
            resultElement.textContent = '';

            imageElement.src = performer.image_path + '/image.jpg';
            imageElement.style.filter = 'blur(10px)';

            const randomFacts = getRandomFacts(performer);
            if (!randomFacts) {
                startNextRound();
                return;
            }

            cluesElement.innerHTML = randomFacts.map(fact => `<li>${fact}</li>`).join('');

            const answers = performers.map(p => p.name.toUpperCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
            if (!answers.includes(performer.name.toUpperCase())) {
                answers[Math.floor(Math.random() * 3)] = performer.name.toUpperCase();
            }

            answersContainer.innerHTML = '';
            answers.forEach(answer => {
                const answerElement = document.createElement('div');
                answerElement.className = 'custom-answer';
                answerElement.textContent = answer;
                answerElement.onclick = () => {
                    imageElement.style.filter = 'none';
                    if (answer === performer.name.toUpperCase()) {
                        score++;
                        resultElement.textContent = 'Correct!';
                        resultElement.className = 'custom-result correct';
                    } else {
                        resultElement.textContent = 'Incorrect!';
                        resultElement.className = 'custom-result incorrect';
                        const correctAnswerElement = [...answersContainer.children].find(el => el.textContent === performer.name.toUpperCase());
                        correctAnswerElement.style.backgroundColor = '#4CAF50'; // Highlight correct answer
                    }
                    resultElement.style.display = 'block';
                    setTimeout(() => {
                        currentRound++;
                        if (currentRound < totalRounds) {
                            startNextRound();
                        } else {
                            showFinalScore();
                        }
                    }, 3000); // Delay of 3 seconds before moving to the next round
                };
                answersContainer.appendChild(answerElement);
            });
        };

        const getRandomFacts = (performer) => {
            const randomScene = performer.scenes.length > 0 ? performer.scenes[Math.floor(Math.random() * performer.scenes.length)] : null;
            const randomMovie = performer.movies.length > 0 ? performer.movies[Math.floor(Math.random() * performer.movies.length)] : null;
            const facts = [
                `This performer has appeared in ${performer.scene_count} scenes in your Stash, starring in "${randomScene?.title}" produced by "${randomScene?.studio.name}".`,
                `This performer's birthday is ${performer.birthdate}.`,
                `This performer appears in the movie "${randomMovie?.name}".`,
                `This performer's country of origin is ${performer.country}.`
            ];
            const availableFacts = facts.filter(fact => !fact.includes('undefined'));
            if (availableFacts.length < 3) {
                return null;
            }
            return availableFacts.sort(() => 0.5 - Math.random()).slice(0, 3);
        };

        const startNextRound = () => {
            loadingElement.style.display = 'block';
            imageElement.style.display = 'none';
            cluesElement.style.display = 'none';
            questionElement.style.display = 'none';
            answersContainer.style.display = 'none';
            resultElement.style.display = 'none';

            let randomPerformer;
            do {
                randomPerformer = performers[Math.floor(Math.random() * performers.length)];
            } while (randomPerformer.image_path.includes('default=true'));

            guessedPerformers.push(randomPerformer);
            updateModalForRound(randomPerformer);
        };

        const showFinalScore = () => {
            modalContent.innerHTML = `
                <h2><div class="custom-game-header">Game Over!</div></h2>
                <h3><p style="text-align: center;">Please enjoy the following scenes from our lovely participants!</p></h3>
                <h4><div style="text-align: center; font-size: 20px;">Your score: ${score} / ${totalRounds}</div></h4>
                <div class="custom-scene-grid"></div>
            `;

            const closeButton = document.createElement('span');
            closeButton.className = 'custom-close';
            closeButton.innerHTML = '&times;';
            closeButton.onclick = () => {
                modal.style.display = 'none';
                modal.remove();
            };
            modalContent.appendChild(closeButton);

            const sceneGrid = modalContent.querySelector('.custom-scene-grid');
            guessedPerformers.forEach(performer => {
                performer.scenes.forEach(scene => {
                    const sceneCard = document.createElement('div');
                    sceneCard.className = 'custom-scene-card';
                    sceneCard.innerHTML = `
                        <div class="custom-scene-title">${scene.title}</div>
                        <img src="${scene.paths.screenshot}" class="custom-scene-image" />
                        <div class="custom-scene-performer">${performer.name.toUpperCase()}</div>
                        <a class="custom-watch-now" data-scene-id="${scene.id}">Watch Now</a>
                    `;
                    sceneGrid.appendChild(sceneCard);
                });
            });

            sceneGrid.querySelectorAll('.custom-watch-now').forEach(link => {
                link.addEventListener('click', async (e) => {
                    const sceneId = e.target.dataset.sceneId;
                    showLoadingAnimation();
                    await fetchSceneStreams(sceneId);
                });
            });
        };

        // Function to fetch scene streams and navigate to the direct stream
        const fetchSceneStreams = async (sceneId) => {
            const query = `query ($id: ID!) {
                sceneStreams(id: $id) {
                    url mime_type label
                }
            }`;
            const variables = { id: sceneId };
            try {
                const res = await graphqlRequest(query, variables);
                const directStream = res.data.sceneStreams.find(scene => scene.label === 'Direct stream');
                if (directStream) {
                    window.location.href = directStream.url;
                } else {
                    showToast('Direct stream not found', 'error');
                    hideLoadingAnimation();
                }
            } catch (err) {
                showToast('Failed to fetch scene streams', 'error');
                console.error(err);
                hideLoadingAnimation();
            }
        };

        const showLoadingAnimation = () => {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.style.position = 'fixed';
            loadingOverlay.style.top = 0;
            loadingOverlay.style.left = 0;
            loadingOverlay.style.width = '100%';
            loadingOverlay.style.height = '100%';
            loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            loadingOverlay.style.zIndex = 10002;
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.justifyContent = 'center';
            loadingOverlay.style.alignItems = 'center';
            loadingOverlay.style.color = '#fff';
            loadingOverlay.style.fontSize = '24px';
            loadingOverlay.innerText = 'Loading...';
            document.body.appendChild(loadingOverlay);
        };

        const hideLoadingAnimation = () => {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.remove();
            }
        };

        modal.style.display = 'block';
        startNextRound();
    }

    // Function to create the custom menu
    function createCustomMenu(event) {
        const menu = document.createElement('div');
        menu.id = 'custom-menu';

        const playGameLink = document.createElement('a');
        playGameLink.href = '#';
        playGameLink.textContent = 'Who\'s That?';
        playGameLink.addEventListener('click', async function(e) {
            e.preventDefault();
            menu.remove();
            await showGameModal();
        });
        menu.appendChild(playGameLink);

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

    // Function to handle right-click on the Performers nav link
    document.addEventListener('contextmenu', function(event) {
        const performersNavLink = event.target.closest('div[data-rb-event-key="/performers"]');
        if (performersNavLink) {
            event.preventDefault();
            createCustomMenu(event);
        }
    });

    // GraphQL request function
    async function graphqlRequest(query, variables = {}, apiKey = '') {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Apikey': apiKey
            },
            body: JSON.stringify({ query, variables })
        });
        return response.json();
    }

    const config = {
        serverUrl: apiUrl,
        apiKey: userConfig.apiKey
    };

})();
