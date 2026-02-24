//heavily based on https://github.com/AttorneyOnline/webDownloader
//zip and download from https://huynvk.dev/blog/download-files-and-zip-them-in-your-browsers-using-javascript

import * as ini from 'https://esm.run/ini';

const BASE_URL = window.location.origin + "/base/";

const BASE_CHARACTERS_URL = BASE_URL + "characters/";
const BASE_BACKGROUND_URL = BASE_URL + "background/";
const BASE_SOUNDS_URL = BASE_URL + "sounds/";
const BASE_MISC_URL = BASE_URL + "misc/";

const IGNORE_VALUES = new Set([
    "Name",
    "Last modified",
    "Size",
    "Description",
    "Parent Directory",
    "../"
])

const FETCH = {
    CRAWL: "CRAWL",
    CHARACTERS: "CHARACTERS",
    BACKGROUNDS: "BACKGROUNDS",
    SFX: "SFX",
    MISC: "MISC"
}

let imageFallbacks = [".png", ".gif", ".jpg", ".jpeg", ".webp"];

let currentCharacter;
let currentBackground;
let allSFX;
let allMisc;

let isCharacterView = true;

const crawl = async (url, crawling) => {
    return await fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(async data => {
            const tempPage = document.createElement("html");
            tempPage.innerHTML = data;

            const tags = tempPage.getElementsByTagName('a')
            let validLinks = []
            for (const link of tags) {
                const aTagValue = link.getAttribute('href')
                if (IGNORE_VALUES.has(link.innerHTML) || aTagValue == "music/") {
                    continue
                }

                switch (crawling){
                    case FETCH.CRAWL:
                        const newUrl = url + aTagValue
                        // Crawl all directories,
                        if (aTagValue.endsWith('/')) {
                            validLinks.push(...await crawl(newUrl, FETCH.CRAWL))
                        } else {
                            validLinks.push(newUrl)
                        }
                        break;
                    case FETCH.BACKGROUNDS:
                    case FETCH.CHARACTERS:
                        if (aTagValue.endsWith('/')) {
                            validLinks.push(decodeURI(aTagValue.slice(0, -1)))
                        }
                        break;
                    case FETCH.SFX:
                        if (aTagValue.endsWith('/')) {
                            const extraLinks = await crawl(url + aTagValue, FETCH.SFX);
                            if (extraLinks != null)
                                validLinks = validLinks.concat(extraLinks);
                        } else
                            validLinks.push(decodeURI(url + aTagValue));
                        break;
                    case FETCH.MISC:
                        if (aTagValue.endsWith('/')) {
                            const extraLinks = await crawl(url + aTagValue, FETCH.MISC);
                            if (extraLinks != null)
                                validLinks = validLinks.concat(extraLinks);
                        } else
                            validLinks.push(decodeURI(url + aTagValue));
                        break;
                }
            }
            return validLinks;
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

export const buildCharacterTable = async () => {
    const characterNames = await crawl(`${BASE_CHARACTERS_URL}`, FETCH.CHARACTERS);

    const characterTable = document.getElementById('character-table');

    for (let i = 0; i < characterNames.length; i++) {

        const characterBox = document.createElement("div");
        characterBox.classList.add('char-box');

        const characterIcon = document.createElement('img');
        characterIcon.classList.add('char-icon');
        characterIcon.setAttribute("src", `${BASE_CHARACTERS_URL + characterNames[i] + '/char_icon.png'}`);
        characterIcon.setAttribute("onerror",`${"this.src='" + BASE_CHARACTERS_URL + characterNames[i] + "/char%20icon.png'"}`)
        characterIcon.setAttribute("title",`${characterNames[i]}`)
        characterIcon.addEventListener("click", () => {
            location.href = `${BASE_CHARACTERS_URL + characterNames[i]}`;
        });

        const characterName = document.createElement('div');
        characterName.classList.add('char-name');
        characterName.innerHTML += characterNames[i];

        const downloadIcon = document.createElement('img');
        downloadIcon.classList.add('char-download', 'disabled');
        downloadIcon.setAttribute("src", './img/black-download.svg')
        downloadIcon.setAttribute('title', 'Loading still in progress...');
        downloadIcon.addEventListener("click", () => {
            if (!downloadIcon.classList.contains('disabled')) {
                currentCharacter = characterNames[i];
                downloadCharacter();
            }
        });

        const clipboardIcon = document.createElement('img');
        clipboardIcon.classList.add('char-clipboard');
        clipboardIcon.setAttribute("src", './img/clipboard.svg')
        clipboardIcon.setAttribute('title', 'Copy name to clipboard');
        clipboardIcon.addEventListener("click", () => {
            navigator.clipboard.writeText(characterNames[i]);
            showToastNotification('Copied "' + characterNames[i] + '" to clipboard');
        });

        characterBox.appendChild(characterIcon);
        characterBox.appendChild(characterName);
        characterBox.appendChild(downloadIcon);
        characterBox.appendChild(clipboardIcon);
        characterTable.appendChild(characterBox)
    }

}

export const buildBackgroundsTable = async () => {
    const backgroundNames = await crawl(`${BASE_BACKGROUND_URL}`, FETCH.BACKGROUNDS);

    const backgroundTable = document.getElementById('background-table');

    for (let i = 0; i < backgroundNames.length; i++) {

        const backgroundBox = document.createElement("div");
        backgroundBox.classList.add('bg-box');

        const backgroundIcon = document.createElement('img');
        backgroundIcon.classList.add('bg-icon');
        backgroundIcon.setAttribute('id', 'bg-' + i);
        backgroundIcon.setAttribute('fallbackIndex', 0);
        backgroundIcon.setAttribute("src", `${BASE_BACKGROUND_URL + backgroundNames[i] + '/witnessempty.png'}`);

        backgroundIcon.addEventListener('error', async (event) => {
            const bgIcon = document.getElementById('bg-' + i);
            let fallbackIndex = bgIcon.getAttribute('fallbackIndex');

            if (+fallbackIndex + 1 < imageFallbacks.length) {
                bgIcon.src = BASE_BACKGROUND_URL + backgroundNames[i] + "/witnessempty" + imageFallbacks[+fallbackIndex + 1];
                bgIcon.setAttribute('fallbackIndex', +fallbackIndex + 1);
            } else {
                const validUrls = await crawl(`${BASE_BACKGROUND_URL}${backgroundNames[i]}/`, FETCH.CRAWL);

                bgIcon.src = filterByExtension(validUrls,imageFallbacks)[0];
            }
        });

        backgroundIcon.setAttribute("title",`${backgroundNames[i]}`)
        backgroundIcon.addEventListener("click", () => {
            location.href = `${BASE_BACKGROUND_URL + backgroundNames[i]}`;
        });

        const backgroundName = document.createElement('div');
        backgroundName.classList.add('bg-name');
        backgroundName.innerHTML += backgroundNames[i];

        const downloadIcon = document.createElement('img');
        downloadIcon.classList.add('bg-download');
        downloadIcon.setAttribute("src", './img/black-download.svg')
        downloadIcon.setAttribute('title', "Download");
        downloadIcon.addEventListener("click", () => {
            if (!downloadIcon.classList.contains('disabled')) {
                currentBackground = backgroundNames[i];
                downloadBackground();
            }
        });

        const clipboardIcon = document.createElement('img');
        clipboardIcon.classList.add('bg-clipboard');
        clipboardIcon.setAttribute("src", './img/clipboard.svg')
        clipboardIcon.setAttribute('title', 'Copy name to clipboard');
        clipboardIcon.addEventListener("click", () => {
            navigator.clipboard.writeText(backgroundNames[i]);
            showToastNotification('Copied "' + backgroundNames[i] + '" to clipboard');
        });

        const backgroundButtons = document.createElement('div');
        backgroundButtons.classList.add('bg-buttons');

        backgroundBox.appendChild(backgroundIcon);
        backgroundBox.appendChild(backgroundName);
        backgroundButtons.appendChild(downloadIcon);
        backgroundButtons.appendChild(clipboardIcon);
        backgroundBox.appendChild(backgroundButtons);
        backgroundTable.appendChild(backgroundBox)
    }

}

export const downloadCharacter = async () => {
    document.getElementById('loader').style.display = 'block';
    const validUrls = await crawl(`${BASE_CHARACTERS_URL}${currentCharacter}/`, FETCH.CRAWL);

    // go through char.ini
    await fetch(`${BASE_CHARACTERS_URL}${currentCharacter}/char.ini`).then(resp => resp.blob()).then(blob => blob.text()).then(text => {
        const charIni = ini.parse(text.toLowerCase());

        // include blip sound, SoundN and frameSFX files
        const blip = (charIni.options.blips != null) ? charIni.options.blips : (charIni.options.gender != null) ? charIni.options.gender : null;
        if (blip !== null && allSFX.find((element) => element.includes(blip)))
            validUrls.push(`${BASE_SOUNDS_URL}` + "blips/" + blip + ".opus");

        for (const key in charIni) {
            if (key !== "soundn" && !key.endsWith("_framesfx"))
                continue;

            for (const value in charIni[key]) {
                const sfx = charIni[key][value];
                const sfxUrl = `${BASE_SOUNDS_URL}` + "general/" + sfx + ".opus";

                if (sfx != null && sfx.length > 1 && !validUrls.find((existing) => existing == sfxUrl) && allSFX.find((element) => element.includes(sfx)))
                {
                    validUrls.push(sfxUrl);
                }
            }
        }

        // include misc textboxes and shouts
        const chat = charIni.options.chat;
        const shouts = charIni.options.shouts;

        if (!!chat && !!shouts && chat === shouts || !!chat) {
            getMiscByName(validUrls, chat);
        } else if (!!shouts) {
            getMiscByName(validUrls, shouts)
        }
    });

    await downloadAndZip(currentCharacter, validUrls);
}

export const getSFX = async () => {
    const allSfxNames = await crawl(`${BASE_SOUNDS_URL}`, FETCH.SFX);
    allSFX = Array.from(new Set(allSfxNames));

    checkIfLoaded();
}

export const getMisc = async () => {
    const allMiscNames = await crawl(`${BASE_MISC_URL}`, FETCH.MISC);
    allMisc = Array.from(new Set(allMiscNames));

    checkIfLoaded();
}

export const downloadBackground = async () => {
    document.getElementById('loader').style.display = 'block';
    const validUrls = await crawl(`${BASE_BACKGROUND_URL}${currentBackground}/`, FETCH.CRAWL);

    await downloadAndZip(currentBackground, validUrls);
}

export const getMiscByName = async (validUrls, item) => {
    var foundMisc = allMisc.filter((element) => element.replace(BASE_MISC_URL,'').includes(item));
    foundMisc.forEach((misc) => validUrls.push(misc));
}

const filterByExtension = (files, allowedExtns) => {
    return files.filter(file => {
        const lastIndex = file.lastIndexOf(".");
        return lastIndex !== -1 && allowedExtns.includes(file.substring(lastIndex))
    })
}

function showToastNotification (text) {
    const notificationText = document.getElementById('toast-text');
    notificationText.innerHTML = text;

    const notificationToast = document.getElementById('toast');
    notificationToast.style.visibility = 'visible';

    setTimeout(() => {  notificationToast.style.visibility = 'hidden'; }, 4000);
}

function toggleCharBg() {
    isCharacterView = !isCharacterView;
    checkShownPage();
}

function checkShownPage() {
    if (isCharacterView) {
        document.getElementById('char-selector').style.display = 'flex';
        document.getElementById('bg-selector').style.display = 'none';
        document.getElementById('char-bg-text').innerText = "Switch to backgrounds";
    } else {
        document.getElementById('char-selector').style.display = 'none';
        document.getElementById('bg-selector').style.display = 'flex';
        document.getElementById('char-bg-text').innerText = "Switch to characters";
    }
}

function checkIfLoaded() {
    if (!!allSFX && !!allMisc) {
        const downloadButtons = document.getElementsByClassName('char-download');

        for (let i = 0; i < downloadButtons.length; i++) {
            downloadButtons[i].classList.remove('disabled');
            downloadButtons[i].setAttribute('title', "Download");
        }
    }
}

function filterByName(event, isCharacterSearch) {
    const searchTerm = event.target.value;
    const listItems = isCharacterSearch ? document.querySelectorAll('.char-box') : document.querySelectorAll('.bg-box');

    listItems.forEach(function(item) {
        const itemName = isCharacterSearch ? item.querySelector('.char-name') : item.querySelector('.bg-name');
        if (itemName.innerText.toLowerCase().includes(searchTerm.toLowerCase())) {
            item.style.display = 'inline-flex';
        } else {
            item.style.display = 'none';
        }
    });
}

document.addEventListener("DOMContentLoaded", function(event) {
    checkShownPage();
    document.getElementById('char-search').addEventListener("input", (event) => filterByName(event, true));
    document.getElementById('bg-search').addEventListener("input", (event) => filterByName(event, false));
    document.getElementById('char-bg').addEventListener('click', () => toggleCharBg());

    buildCharacterTable();
    getSFX();
    getMisc();
    buildBackgroundsTable();
});

//DOWNLOADER
const download = async (url) => {
    return fetch(url).then(resp => {
        const filename = url.slice(BASE_URL.length);
        return {
            filename: filename,
            blob: resp.blob()
        }
    });
};

const exportZip = (specificName, blobData) => {
    const zip = JSZip();
    const charname = specificName;
    blobData.forEach((blob) => {
        zip.file(`${decodeURI(blob.filename)}`, blob.blob);
    });

    zip.generateAsync({type: 'blob'}).then(zipFile => {
        const fileName = `${charname}.zip`;

        return saveAs(zipFile, fileName);
    });
}

export const downloadAndZip = (specificName, urls) => {
    Promise.all(urls.map(download)).then(blobData => exportZip(specificName, blobData)).finally(() => {
        document.getElementById('loader').style.display = 'none';
    })
}