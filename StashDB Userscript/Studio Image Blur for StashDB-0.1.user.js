// ==UserScript==
// @name         Studio Image Blur for StashDB
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      0.1
// @description  Blurs images from specific studios on StashDB scene cards
// @author       Serechops
// @match        https://stashdb.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // List of studios to blur images from
    const studiosToBlur = [
"80Gays",
"Amateur Gay POV",
"Bait Bus",
"Bareback Attack",
"Bareback Casting",
"Bath House Bait",
"Beddable Boys",
"BelAmi",
"Best Bareback",
"Bigdaddy",
"Boys Destroyed",
"Czech Gay Amateurs",
"Czech Gay Authentic Videos",
"Czech Gay Casting",
"Czech Gay Couples",
"Czech Gay Fantasy",
"Czech Gay Massage",
"Czech Gay Solarium",
"Damn That's Big",
"ExB",
"Gay Castings",
"GaycestCarnal",
"Gay Creeps",
"Gayfruit",
"GAYHOOPLAB",
"Gay Horror",
"Gay Law Office",
"GayLifeNetwork",
"Gay Patrol",
"Gay Pawn",
"Gay Porn Berries",
"Gay Revenge",
"Gay Room",
"Gay Violations",
"Gay Wire",
"Grab Ass",
"Guy Selector",
"Haze Him",
"It's Gonna Hurt",
"KeumGay",
"Lollipop Twinks",
"Man Royale",
"Massage Bait",
"Men POV",
"Office Cock",
"Out Him",
"Out In Public",
"Pig Bottoms",
"Pound His Ass",
"Project City Bus",
"RealGayCouples",
"Rub Him",
"Sausage Party",
"Setagaya VR",
"Shower Bait",
"Str8 to GayMen.com",
"Straight Guys for Gay Eyes",
"Teach Twinks",
"The Gay Office",
"Thick and Big",
"Thug Hunter",
"Tonight's Boyfriend",
"Twinklight",
"Twinkylicious",
"UngloryHole",
"VirtualRealGay",
"VRB GaySwearl" // Add more as needed
    ];

    function blurImages() {
        // Select all scene card images
        const sceneCards = document.querySelectorAll('.SceneCard-image');

        sceneCards.forEach(card => {
            // Find the parent card element
            const studioNameElement = card.closest('.SceneCard').querySelector('.SceneCard-studio-name');

            if (studioNameElement && studiosToBlur.includes(studioNameElement.textContent.trim())) {
                // Apply CSS blur
                card.style.filter = 'blur(8px)';
            }
        });
    }

    // Run the blur function when the document loads
    window.addEventListener('load', blurImages);

    // Optionally, run the blur function on dynamic content updates, such as AJAX pagination
    const observer = new MutationObserver(blurImages);
    observer.observe(document.body, { childList: true, subtree: true });
})();
