// ==UserScript==
// @name         Studio Image Blur for StashDB
// @namespace    https://github.com/Serechops/Serechops-Stash
// @version      0.2
// @description  Blurs images from specific studios on StashDB scene cards, based on studio name and img src
// @author       Serechops
// @match        https://stashdb.org/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // List of studios to blur images from
    const studiosToBlur = [
"80Gays",
"8teenBoy",
"ASGmax Originals",
"Active Duty",
"Amateur Gay POV",
"Bait Bus",
"Bareback Attack",
"Bareback Casting",
"Bath House Bait",
"Beddable Boys",
"BelAmi",
"Best Bareback",
"BiLatinMen",
"Bigdaddy",
"Blake Mason",
"Boys Destroyed",
"Brazil TGirls",
"Bring Me a Boy",
"BrokeStraightBoys",
"Bromo",
"Brother Crush",
"Busted T-Girls",
"ChaosMen",
"Cocky Boys",
"Colby Knox",
"Corbin Fisher",
"Czech Gay Amateurs",
"Czech Gay Authentic Videos",
"Czech Gay Casting",
"Czech Gay Couples",
"Czech Gay Fantasy",
"Czech Gay Massage",
"Czech Gay Solarium",
"Dad Creep",
"Damn That's Big",
"Dick Rides",
"Doctor Tapes",
"Dream Tranny",
"Evolved Fights",
"ExB",
"Falcon Studios",
"Family Dick",
"FratBoy",
"Freeuse Twink",
"Fuckermate",
"GAYHOOPLAB",
"Gay Castings",
"Gay Creeps",
"Gay Horror",
"Gay Law Office",
"Gay Patrol",
"Gay Pawn",
"Gay Porn Berries",
"Gay Revenge",
"Gay Room",
"Gay Violations",
"Gay Wire",
"GayLifeNetwork",
"GaycestCarnal",
"Gayfruit",
"GenderXFilms",
"Grab Ass",
"Guy Selector",
"Haze Him",
"Helix Studios",
"Himeros.TV",
"Hot House Entertainment",
"It's Gonna Hurt",
"KeumGay",
"Kink Men",
"Kristen Bjorn",
"Latin Leche",
"Lollipop Twinks",
"Lucas Entertainment",
"LucasRaunch",
"Man Royale",
"Massage Bait",
"Men POV",
"Men.com",
"MenAtPlay",
"MenAtPlay",
"My Dirtiest Fantasy",
"NakedSword x Beau Butler",
"NakedSword",
"Next Door Male",
"Office Cock",
"Out Him",
"Out In Public",
"Pig Bottoms",
"Pound His Ass",
"Project City Bus",
"PureTS",
"Raging Stallion",
"Raging Stallion",
"Randy Blue",
"Raunchy Bastards",
"RealGayCouples",
"Rub Him",
"Sausage Party",
"SayUncle All Stars",
"Sean Cody",
"See Him Fuck",
"Setagaya VR",
"She Male Idol",
"Shower Bait",
"Southern Strokes",
"Str8 Hell",
"Str8 to GayMen.com",
"Straight Fraternity",
"Straight Guys for Gay Eyes",
"TGirl Japan Hardcore",
"TGirl Japan",
"TGirl Pornstar",
"Teach Twinks",
"Tgirl Post-Op",
"The Bro Network",
"The Gay Office",
"Thick and Big",
"Thug Hunter",
"Timtales",
"TitanMen",
"Tonight's Boyfriend",
"Trans Midnight",
"Trystan Bull",
"Twinklight",
"Twinkylicious",
"UngloryHole",
"VOYR",
"VRB GaySwearl",
"VirtualRealGay"
        // Add more as needed
    ];

    // List of image src patterns to blur
    const srcPatternsToBlur = [
        "https://cdn.stashdb.org/images/22/1a",  // example pattern to match against
        "https://cdn.stashdb.org/images/"
        // Add more src patterns as needed
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

        // Select all images on the page
        const allImages = document.querySelectorAll('img');

        allImages.forEach(image => {
            // Check if the image's parent has a studio name and if the src matches any pattern
            const studioNameElement = image.closest('.SceneCard, .card-body')?.querySelector('.SceneCard-studio-name, a[href*="/studios/"]');
            const isStudioMatch = studioNameElement && studiosToBlur.includes(studioNameElement.textContent.trim());

            if (isStudioMatch && srcPatternsToBlur.some(pattern => image.src.includes(pattern))) {
                // Apply CSS blur
                image.style.filter = 'blur(8px)';
            }
        });
    }

    // Run the blur function when the document loads
    window.addEventListener('load', blurImages);

    // Optionally, run the blur function on dynamic content updates, such as AJAX pagination
    const observer = new MutationObserver(blurImages);
    observer.observe(document.body, { childList: true, subtree: true });
})();
