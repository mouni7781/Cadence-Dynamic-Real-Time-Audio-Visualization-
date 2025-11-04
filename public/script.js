let currsong = new Audio();

let songs
let currfolder;
let currentPlaylistInfo = [];
let audioContext, analyser, source, dataArray;
let canvas, canvasCtx;
let visualizerInitialized = false;
let currentTrackInfo = { songName: '', artistName: '' };
let isBioFetching = false;

let play = document.querySelector(".plybtn");
let next = document.querySelector(".next")
let prev = document.querySelector(".prev")
let icon = play.querySelector("img");

const defaultImage = "https://placehold.co/168x168/191919/999999?text=Cover";

// ************************************************************************************************** //
class MusicAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.currentPlay = null;
        this.playStartTime = null;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Track song play event
    trackPlay(songName, artist = 'Unknown') {
        this.currentPlay = {
            song: songName,
            artist: artist,
            startTime: Date.now(),
            completed: false
        };
        this.playStartTime = Date.now();

        this.sendEvent({
            type: 'play',
            song: songName,
            artist: artist,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        });
    }

    // Track when song completes
    trackComplete(songName) {
        if (!this.currentPlay) return;
        
        const duration = Date.now() - this.playStartTime;
        
        this.sendEvent({
            type: 'complete',
            song: songName,
            duration: duration,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        });
        this.currentPlay = null;
       
        this.playStartTime = null;
    }

    // Track song skip
    trackSkip(songName) {
        if (!this.currentPlay) return;
        
        const duration = Date.now() - this.playStartTime;
        
        this.sendEvent({
            type: 'skip',
            song: songName,
            duration: duration,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        });
        this.currentPlay = null;
        this.playStartTime = null;
    }

    // Track pause
    trackPause(songName) {
        if (!this.currentPlay) return;
        
        const duration = Date.now() - this.playStartTime;
        
        this.sendEvent({
            type: 'pause',
            song: songName,
            duration: duration,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId
        });
        if (this.currentPlay) {
            this.currentPlay.paused = true;
        }
        this.playStartTime = null;
    }

    trackResume(songName) {
        if (this.currentPlay && this.currentPlay.song === songName && this.currentPlay.paused) {
            this.playStartTime = Date.now(); 
            this.currentPlay.paused = false;
        } 
        else if (!this.currentPlay || this.currentPlay.song !== songName) {
            this.trackPlay(songName, 'Artist Name');
        }
    }

    // Send event to backend
    async sendEvent(eventData) {
        try {
            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                console.error('Failed to track event');
            }
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }

    // Get user statistics
    async getStats(timeRange = 'week') {
        try {
            const response = await fetch(`/api/analytics/stats?range=${timeRange}&session=${this.sessionId}`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            return null;
        }
    }
}
const analytics = new MusicAnalytics();
// ************************************************************************************************** //

async function fetchAndDisplayBio() {
    // 1. Get elements
    const popover = document.getElementById('ai-bio-popover');
    const bioTextElement = document.getElementById('ai-bio-text');
    
    // 2. Read from global state
    const { songName, artistName } = currentTrackInfo;

    // 3. Prevent multiple fetches
    if (isBioFetching || !songName) return;
    isBioFetching = true;

    // 4. Show popover with loading state
    bioTextElement.textContent = 'Loading artist info...';
    popover.classList.add('show');

    try {
        const response = await fetch('/api/ai/artist-bio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songName, artistName })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch bio');
        }

        const data = await response.json();
        bioTextElement.textContent = data.bio; // 5. Populate with real data

    } catch (error) {
        console.error('Bio fetch error:', error);
        bioTextElement.textContent = 'Could not load artist info.'; // 6. Handle error
    } finally {
        isBioFetching = false; // 7. Allow fetching again
    }
}

// ************************************************************************************************** //
// Formats time from seconds to a "m:ss" string.
function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "0:00";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}
// ************************************************************************************************** //
// Draws the audio visualizer on the canvas.
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);
    const gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#8A2BE2');
    gradient.addColorStop(0.5, '#FF00FF');
    gradient.addColorStop(1, '#00BFFF');
    canvasCtx.fillStyle = gradient;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = 3;
    let barHeight;
    let x = 0;
    for (let i = 0; i < analyser.frequencyBinCount; i++) {
        barHeight = dataArray[i] / 2;
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [10, 10, 0, 0]);
        canvasCtx.fill();
        x += barWidth + 2;
    }
}
// ************************************************************************************************** //
// Fetches song data from a folder's info.json.
async function getsongs(folder) {
    currfolder = folder;  
    try {
        // Fetch the info.json file directly from the static 'Songs' directory
        let response = await fetch(`/Songs/${folder}/info.json`);   
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for /Songs/${folder}/info.json`);
        }

        // This is the full array of song objects from info.json
        let songInfoArray = await response.json(); 

        if (!songInfoArray || songInfoArray.length === 0) {
            console.warn(`No songs found in info.json for: ${folder}`);
            songs = []; // Set global 'songs' to empty
            currentPlaylistInfo = [];
        } else {
            // Populate the global 'songs' array with *just the filenames*
            // This is CRITICAL for your Next/Prev buttons to work.
            songs = songInfoArray.map(song => song.fileName);
            currentPlaylistInfo = songInfoArray;
        }

        // Now, pass the *full info* to populatesongs to make the list look better
        populatesongs(songInfoArray); 
        
        return songs; // Return the array of filenames

    } catch (error) {
        console.error(`Failed to get songs for ${folder}:`, error);
        songs = []; 
        currentPlaylistInfo = [];
        return songs;
    }
}
// ************************************************************************************************** //

// Populates the song list UI from the song info array.
async function populatesongs(songInfoArray) { 
    let songul = document.querySelector(".songlist").getElementsByTagName("ul")[0];
    let songsHTML = "";

    // Check if we received an empty or invalid array
    if (!songInfoArray || songInfoArray.length === 0) {
        songul.innerHTML = "<li>No songs found in this playlist.</li>";
        return;
    }

    for (const [index, song] of songInfoArray.entries()) {    
        // Dynamically get artist names from the object
        let artistNames = song.artists ? song.artists.map(a => a.name).join(', ') : "Various Artists";

        songsHTML += `<li style="animation-delay: ${index * 50}ms;">
                            <img class="invert " height="30px" src="Assets/svg/song/songui.svg" alt="">
                            <div class="info">
                                <div>${song.name}</div>
                                <div>${artistNames}</div> 
                            </div>
                            <div class="playnow flex justify-center items-center">
                                <a>Play Now</a>    
                                <div class="ply-btn profile-rounded flex items-center justify-center">
                                        <img src="Assets/svg/other/play.svg" height="24px" width="24px" alt="">
                                </div>
                            </div>
                            <span class="song-filename" style="display: none;">${song.fileName}</span>
         </li>`;
        }
    songul.innerHTML = songsHTML;

    // Update the click event listener to read the hidden span
    Array.from(document.querySelector(".songlist").getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", element => {
            // Find the hidden span with the filename
            const fileName = e.querySelector(".song-filename").innerHTML;
            if (fileName) {
                // Ensure visualizer is ready
                if (!visualizerInitialized) {
                    init_visualizer();
                }
                playmusic(fileName);
            }
        })
    })
}

// ************************************************************************************************** //
// Plays a specific song from a card click.
async function playSongFromCard(folder, songName) {
    if (!visualizerInitialized) {
        init_visualizer();
    }
    // Update the global context (songs list and current folder)
    await getsongs(folder); 
    // Now that context is set, play the specific song
    playmusic(songName);
}

// ************************************************************************************************** //
// Displays song cards in a specific container.
async function displayCards(folder, container) {
    let songsData = await getAlbumFolders(`Songs/${folder}`);
    let card = document.querySelector(container).getElementsByTagName("div")[0]
    let cardsHTML = "";
    for (const [index, song] of songsData.entries()) {
        let artistsHTML = song.artists.map(artist => 
            `<a class="cfont-ash hover-underline" dir="auto" href="${artist.href || '#'}">${artist.name}</a>`
        ).join(', ');
        const imageSrc = song.image || defaultImage;

        cardsHTML += `<div data-folder="${folder}" class="card rounded click" style="animation-delay: ${index * 70}ms;">
                                    <div class="card-elements">
                                        <div class="play-btn profile-rounded flex items-center justify-center" onclick="playSongFromCard('${folder}', '${song.fileName}')">
                                            <img src="Assets/svg/other/play.svg" height="24px" width="24px" alt="">
                                        </div>
                                        <div class="img-cont rounded">
                                            <img class="img-rounded " loading="lazy"
                                                src="${imageSrc}"
                                                style="width: 168px ;height: 168px;padding: 10px;" alt="">
                                        </div>
                                        <span class="hover-underline f416">${song.name}</span>
                                        <span class="f414">
                                            ${artistsHTML}
                                        </span>
                                    </div>
                                </div>`
    }
    card.innerHTML = cardsHTML;
}

// ************************************************************************************************** //
// Fetches the info.json for a given album folder path.
async function getAlbumFolders(folderPath) {
    const jsonFilePath = `${folderPath}/info.json`;
    try {        
        const response = await fetch(jsonFilePath);
        if (!response.ok) {
            throw new Error(`Server could not find or load the file: ${jsonFilePath}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("CRITICAL ERROR: Failed to get album data.", error);
        return [];
    }
}

// ************************************************************************************************** //
// Displays album cards in a specific container.
async function displayalbums(folder, container, cls) {
    const defaultImage = "https://placehold.co/168x168/181818/ffffff?text=Album";
    const albumFolders = await getAlbumFolders(folder);
    let card = document.querySelector(container).getElementsByTagName("div")[0]
    card.innerHTML = "";
    
    for (const [index, album] of albumFolders.entries()) {
        const imageSrc = album.image || defaultImage;
        card.innerHTML = card.innerHTML + `<div data-folder="${album.path}" class="card rounded click" style="animation-delay: ${index * 70}ms;">
                                    <div class="card-elements">
                                        <div class="play-btn profile-rounded flex items-center justify-center">
                                            <img src="Assets/svg/other/play.svg" height="24px" width="24px" alt="">
                                        </div>
                                        <div class="img-cont rounded">
                                           <img class="${cls}" loading="lazy"
                                                src="${imageSrc}"
                                                style="width: 168px ;height: 168px;padding: 10px;" alt="">
                                        </div>
                                        <span class="hover-underline f416">${album.name}</span>
                                        <span class="f414">
                                            <a class="cfont-ash hover-underline" dir="auto" href="">Artist</a>
                                        </span>
                                    </div>
                                </div>`
    }
}

// ************************************************************************************************** //
const playmusic = async (musictrack, pause = false) => {
    musictrack = decodeURIComponent(musictrack).trim();
    currsong.src = `/Songs/${currfolder}/${encodeURIComponent(musictrack)}`;
    let artistName = 'Unknown Artist';
    if (currentPlaylistInfo && currentPlaylistInfo.length > 0) {
        const songInfo = currentPlaylistInfo.find(song => song.fileName === musictrack);
        
        if (songInfo && songInfo.artists && songInfo.artists.length > 0) {
            artistName = songInfo.artists.map(a => a.name).join(', ');
        } else if (songInfo) {
            artistName = 'Various Artists';
        }
    }   
    const songName = decodeURIComponent(musictrack);
    currentTrackInfo = { songName, artistName };
    document.getElementById('ai-bio-popover').classList.remove('show');
    if (!pause) {
        try {
            const songName = decodeURIComponent(musictrack);
            analytics.trackPlay(songName, 'Artist Name');           
            await currsong.play();
            icon.src = "Assets/svg/Play-btns/pause.svg";
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    }
    document.querySelector(".songinfo").innerHTML = decodeURI(musictrack)
    document.querySelector(".songtime").querySelector(".current-time").innerHTML = "00:00";
}

// ************************************************************************************************** //
// Initializes the AudioContext and visualizer components.
function init_visualizer(){    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaElementSource(currsong);
    analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    canvas = document.getElementById('visualizerCanvas');
    canvasCtx = canvas.getContext('2d');
    drawVisualizer();
    visualizerInitialized = true;
}

// ************************************************************************************************** //
async function main() {
    await displayCards("TrendSongs", ".sect-a .song-row-container");
    await displayalbums("Songs/secb", ".sect-b .song-row-container", "profile-rounded");
    await displayalbums("Songs/Pas", ".sect-c .song-row-container", "img-rounded");
    await getsongs("TrendSongs")
    playmusic(songs[0], true)

    const bioButton = document.getElementById('ai-bio-btn');
    const bioPopover = document.getElementById('ai-bio-popover');
    const bioCloseBtn = document.getElementById('ai-bio-close');
    bioButton.addEventListener('click', () => {
        if (!bioPopover.classList.contains('show')) {
            fetchAndDisplayBio();
        } else {
            bioPopover.classList.remove('show');
        }
    });
    bioCloseBtn.addEventListener('click', () => {
        bioPopover.classList.remove('show');
    });

    // Handle play/pause from the main control bar.
    play.addEventListener("click", () => {
        if (!visualizerInitialized) {
            init_visualizer();
        }
        const songName = decodeURIComponent(currsong.src.split("/").slice(-1)[0]);
        if (currsong.paused) {
            currsong.play();
            icon.src = "Assets/svg/Play-btns/pause.svg"
            analytics.trackResume(songName);
        } else {
            currsong.pause();
            icon.src = "Assets/svg/other/play.svg"
            analytics.trackPause(songName);
        }
    });
    
    // Handle 'previous' button click.
    prev.addEventListener("click", () => {
        let index = songs.indexOf(decodeURIComponent(currsong.src.split("/").slice(-1)[0]));
        let currentSongName = decodeURIComponent(currsong.src.split("/").slice(-1)[0]);
        if (index - 1 >= 0) {
            playmusic(songs[index - 1])
        }
        analytics.trackSkip(currentSongName);
    });
    
    // Handle 'next' button click.
    next.addEventListener("click", () => {       
        let index = songs.indexOf(decodeURIComponent(currsong.src.split("/").slice(-1)[0]));
        let currentSongName = decodeURIComponent(currsong.src.split("/").slice(-1)[0]);
        
        if (index + 1 < songs.length) {
            playmusic(songs[index + 1])
        } else {
            playmusic(songs[0])
        }
        analytics.trackSkip(currentSongName);
    });

    // Handle volume control.
    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        currsong.volume = parseInt(e.target.value) / 100;
    })

    // Update song time and seek bar.
    currsong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime .current-time").innerHTML = `${formatTime(currsong.currentTime)}`;
        document.querySelector(".songtime .total-duration").innerHTML = `${formatTime(currsong.duration)}`;
        document.querySelector(".seek").style.left = (currsong.currentTime / currsong.duration) * 100 + "%";
        document.querySelector(".seekbar").style.setProperty('--progress', `${(currsong.currentTime / currsong.duration) * 100}%`);       
    });

    // Handle seek bar click.
    document.querySelector(".seekbar").addEventListener("click", e => {
        let percent = ((e.offsetX / e.target.getBoundingClientRect().width) * 100)
        document.querySelector(".seek").style.left = percent + "%";
        currsong.currentTime = ((currsong.duration) * percent) / 100;
    })
    
    // Handle hamburger menu click.
    document.querySelector(".ham").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0";
        document.querySelector(".overlay").style.display = "block";
        document.querySelector(".overlay").style.opacity = "1";
    })

    // Handle overlay click to close menu.
    document.querySelector(".overlay").addEventListener("click", () => {
        const mediaQuery = window.matchMedia('(max-width: 1249px)');
        if (mediaQuery.matches) {
            document.querySelector(".left").style.left = "-100%";
            document.querySelector(".overlay").style.display = "none";
        }
        window.addEventListener('resize', () => {
            if (window.innerWidth > 1249) {
                document.querySelector(".left").style.removeProperty('left');
                overlay.style.display = 'none';
            }
        })
    });

    // Add click listeners to album/playlist cards.
    Array.from(document.getElementsByClassName("card")).forEach(e => {
        e.addEventListener("click", async items => {            
            const folderPath = items.currentTarget.dataset.folder;
          
            
            if (folderPath === "TrendSongs") {
                if (!visualizerInitialized) {
                    init_visualizer();
                }
                songs = await getsongs(folderPath);
            } else {
                songs = await getsongs(folderPath);
                
                if (songs && songs.length > 0) {
                    if (!visualizerInitialized) {
                        init_visualizer();
                    }
                    playmusic(songs[0]);
                } else {
                    console.warn("No songs found in this album");
                }
            }
        })
    });

    // Handle search functionality.
    const searchInput = document.getElementById('search-ph');
    const browseSections = document.querySelectorAll('.right-main > section');
    const searchResultsContainer = document.getElementById('searchResultsContainer');
    const searchResultsGrid = document.getElementById('searchResultsGrid');
    const allCardsOriginal = document.querySelectorAll('.card');
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length > 0) {
            browseSections.forEach(section => section.classList.add('hidden'));
            searchResultsContainer.classList.remove('hidden');
            searchResultsGrid.innerHTML = '';
            
            allCardsOriginal.forEach(card => {
                const title = card.querySelector('.f416').textContent.toLowerCase();
                if (title.includes(searchTerm)) {
                    const cardClone = card.cloneNode(true);
                    searchResultsGrid.appendChild(cardClone);
                }
            });
            
            if (searchResultsGrid.children.length === 0) {
                searchResultsGrid.innerHTML = `<h1 class="no-results">No songs or albums found with that name.</h1>`;
            }
        } else {
            browseSections.forEach(section => section.classList.remove('hidden'));
            searchResultsContainer.classList.add('hidden');
            searchResultsGrid.innerHTML = '';
        }
    });

    // Handle horizontal scroll arrows for card sections.
    let rightbtn = document.querySelectorAll(".right-arrow");
    let leftbtn = document.querySelectorAll(".left-arrow");    
    
    rightbtn.forEach(btn => {
        btn.addEventListener("click", () => {            
            const songRowContainer = btn.closest(".song-row-container");          
            const cardContainer = songRowContainer.querySelector(".cardcont");
            if (cardContainer) {
                cardContainer.scrollLeft += 200;
            }
        });
    });
    
    leftbtn.forEach(btn => {
        btn.addEventListener("click", () => {            
            const songRowContainer = btn.closest(".song-row-container");          
            const cardContainer = songRowContainer.querySelector(".cardcont");
            if (cardContainer) {
                cardContainer.scrollLeft -= 200;
            }
        });
    });
    
    // Automatically play the next song when one ends.
    currsong.addEventListener('ended', () => {
        const songName = decodeURIComponent(currsong.src.split("/").slice(-1)[0]);
        
        
        let index = songs.indexOf(songName);
        if (index + 1 < songs.length) {
            playmusic(songs[index + 1]);
        } else {
            playmusic(songs[0]); 
        }
        analytics.trackComplete(songName);
    });
}
main()