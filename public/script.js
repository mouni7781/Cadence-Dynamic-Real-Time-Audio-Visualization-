let currsong = new Audio();
let songs
let currfolder;
let audioContext, analyser, source, dataArray;
let canvas, canvasCtx;
let visualizerInitialized = false;

let play = document.querySelector(".plybtn");
let next = document.querySelector(".next")
let prev = document.querySelector(".prev")
let icon = play.querySelector("img");

const songImageMap = {
    "52 Bars.mp3": "https://i.scdn.co/image/ab67616d00001e02d036158f4b83af10de8d2443",
    "Azul.mp3": "https://i.scdn.co/image/ab67616d00001e02203e6495a78184970ab274ac",
    "Deva Shree Ganesha.mp3": "https://i.scdn.co/image/ab67616d00001e02b22e21de789378f223e1795f",
    "For A Reason.mp3": "https://i.scdn.co/image/ab67616d00001e023dc5639cb321a69b721bed92",
    "Guzaara.mp3": "https://i.scdn.co/image/ab67616d00001e020e320aaa87e6f08b7a0f87ef",
    "Tears.mp3": "https://i.scdn.co/image/ab67616d00001e0245e9957f1f728941041d3210",
};
const defaultImage = "https://placehold.co/168x168/191919/999999?text=Cover";
const regex = /\s-\s.*?\./;

// ************************************************************************************************** //
function formatTime(totalSeconds) {
    if (isNaN(totalSeconds) || totalSeconds < 0) {
        return "0:00";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}
// ************************************************************************************************** //
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

async function getsongs(folder) {
    // Remove 'songs/' or 'Songs/' prefix if present (case insensitive)
    let subfolder = folder.replace(/^songs\//i, '');
    currfolder = subfolder;  
    try {
        let a = await fetch(`/api/songs/${subfolder}`);   
        if (!a.ok) {
            throw new Error(`HTTP error! status: ${a.status}`);
        }
        songs = await a.json();
        console.log('Songs received:', songs);
        if (!songs || songs.length === 0) {
            console.warn(`No songs found in folder: ${folder}`);
            songs = [];
        }
        populatesongs(songs);
        return songs;
    } catch (error) {
        console.error(`Failed to get songs for ${folder}:`, error);
        songs = []; 
        return songs;
    }
}

// populate available songs in the available section
async function populatesongs(songs) {
    let songul = document.querySelector(".songlist").getElementsByTagName("ul")[0]
    let songsHTML = "";
    for (const [index, song] of songs.entries()) {    
        songsHTML += `<li style="animation-delay: ${index * 50}ms;"><img class="invert " height="30px" src="Assets/svg/song/songui.svg" alt="">
                                    <div class="info">
                                        <div>${song.replaceAll("%20", " ")}</div>
                                        <div>Mouni</div>                                        
                                    </div>
                                    <div class="playnow flex justify-center items-center">
                                        <a>Play Now</a>    
                                        <div class="ply-btn profile-rounded flex items-center justify-center">
                                                <img src="Assets/svg/other/play.svg" height="24px" width="24px" alt="">
                                        </div>
                                    </div>                              
         </li>`;
        }
    songul.innerHTML = songsHTML;

    // to play song by selecting from available window
    Array.from(document.querySelector(".songlist").getElementsByTagName("li")).forEach(e => {
        e.addEventListener("click", element => {
            playmusic(e.querySelector(".info").firstElementChild.innerHTML)
        })
    })
}
// ************************************************************************************************** //
async function displayCards(folder, container) {
    let tsongs = await getsongs(folder);
    folder = folder.replace("Songs/", "");
    let card = document.querySelector(container).getElementsByTagName("div")[0]
    let cardsHTML = "";
    for (const [index, song] of tsongs.entries()) {
        let imgso = (song.replaceAll("%20", " ")).replace(regex, ".")
        const imageSrc = songImageMap[imgso] || defaultImage;
        cardsHTML += `<div data-folder="${folder}" class="card rounded click" style="animation-delay: ${index * 70}ms;">
                                    <div class="card-elements">
                                        <div class="play-btn profile-rounded flex items-center justify-center" onclick="playmusic('${song}')">
                                            <img src="Assets/svg/other/play.svg" height="24px" width="24px" alt="">
                                        </div>
                                        <div class="img-cont rounded">
                                            <img class="img-rounded " loading="lazy"
                                                src="${imageSrc}"
                                                style="width: 168px ;height: 168px;padding: 10px;" alt="">
                                        </div>
                                        <span class="hover-underline f416">${imgso.replaceAll(".mp3", "")}</span>
                                        <span class="f414">
                                            <a class="cfont-ash hover-underline" dir="auto" href="">Ajay-Atul</a>,
                                            <a class="cfont-ash hover-underline" dir="auto" href=""> Ajay Gogavale</a>
                                        </span>
                                    </div>
                                </div>`
    }
    card.innerHTML = cardsHTML;
}
// ************************************************************************************************** //
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
const playmusic = (musictrack, pause = false) => {
    musictrack = decodeURIComponent(musictrack).trim();
    // Construct the path - currfolder should already have the full path
    currsong.src = `Songs/${currfolder}/${encodeURIComponent(musictrack)}`;
    console.log('Playing:', currsong.src);
    
    if (!pause) {
        currsong.play();
        icon.src = "Assets/svg/Play-btns/pause.svg"
    }
    document.querySelector(".songinfo").innerHTML = decodeURI(musictrack)
    document.querySelector(".songtime").querySelector(".current-time").innerHTML = "00:00";
}

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
    await displayCards("Songs/TrendSongs", ".sect-a .song-row-container");
    await displayalbums("Songs/secb", ".sect-b .song-row-container", "profile-rounded");
    await displayalbums("Songs/Pas", ".sect-c .song-row-container", "img-rounded");
    await getsongs("Songs/TrendSongs")
    playmusic(songs[0], true)

    // to play song from song bar
    play.addEventListener("click", () => {
        if (!visualizerInitialized) {
            init_visualizer();
        }
        if (currsong.paused) {
            currsong.play();
            icon.src = "Assets/svg/Play-btns/pause.svg"
        } else {
            currsong.pause();
            icon.src = "Assets/svg/other/play.svg"
        }
    });
    
    // Making Previous Button
    prev.addEventListener("click", () => {
        let index = songs.indexOf(decodeURIComponent(currsong.src.split("/").slice(-1)[0]));
        if (index - 1 >= 0) {
            playmusic(songs[index - 1])
        }
    });
    
    // Making next Button
    next.addEventListener("click", () => {       
        let index = songs.indexOf(decodeURIComponent(currsong.src.split("/").slice(-1)[0]));
        if (index + 1 < songs.length) {
            playmusic(songs[index + 1])
        } else {
            playmusic(songs[0])
        }
    });

    // Making Volume Control Button
    document.querySelector(".range").getElementsByTagName("input")[0].addEventListener("change", (e) => {
        currsong.volume = parseInt(e.target.value) / 100;
    })

    //Update songs time  
    currsong.addEventListener("timeupdate", () => {
        document.querySelector(".songtime .current-time").innerHTML = `${formatTime(currsong.currentTime)}`;
        document.querySelector(".songtime .total-duration").innerHTML = `${formatTime(currsong.duration)}`;
        document.querySelector(".seek").style.left = (currsong.currentTime / currsong.duration) * 100 + "%";
        document.querySelector(".seekbar").style.setProperty('--progress', `${(currsong.currentTime / currsong.duration) * 100}%`);
    });

    // Seekbar control to select diff timeline of the song 
    document.querySelector(".seekbar").addEventListener("click", e => {
        let percent = ((e.offsetX / e.target.getBoundingClientRect().width) * 100)
        document.querySelector(".seek").style.left = percent + "%";
        currsong.currentTime = ((currsong.duration) * percent) / 100;
    })
    
    document.querySelector(".ham").addEventListener("click", () => {
        document.querySelector(".left").style.left = "0";
        document.querySelector(".overlay").style.display = "block";
        document.querySelector(".overlay").style.opacity = "1";
    })

    // overlay when the left cont moves in smaller devices
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

    Array.from(document.getElementsByClassName("card")).forEach(e => {
        e.addEventListener("click", async items => {
            const folderPath = items.currentTarget.dataset.folder;
            console.log("Card clicked, folder:", folderPath);
            
            if (folderPath === "TrendSongs") {
                if (!visualizerInitialized) {
                    init_visualizer();
                }
                songs = await getsongs(`Songs/${folderPath}`);
                console.log("TrendSongs loaded, not auto-playing");
            } else {
                console.log("Loading album:", folderPath);
                songs = await getsongs(`Songs/${folderPath}`);
                
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

    // search functionality
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

    // scroll cards arrow
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
}
main()