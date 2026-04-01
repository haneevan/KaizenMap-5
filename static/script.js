/* Kaizen Portal - Script.js (Refined Global & Map-Interaction) */

// --- GLOBAL STATE ---
let map;
let activeMarkerLayer = null; 
let tempCoords = null;
let tempMarker = null; 
let tempRelX = 0;
let tempRelY = 0;
let scale = 1;
let isDragging = false;
let startX, startY;
let translateX = 0;
let translateY = 0;

// Mock User Data
const currentUser = { id: "USR001", role: "admin" }; 

// --- 1. CONFIGURATION ---
const factoryConfig = {
    "第一工場": {
        folder: "1st Factory",
        floors: {
            "1階": { path: "1st_Factory_1F.png", id: "f1_1f" },
            "2階": { path: "1st_Factory_2F-1.png", id: "f1_2f_1" },
            "3階": { path: "1st_Factory_3F.png", id: "f1_3f" },
            "屋外": { path: "1st_Factory_Outdoor.png", id: "f1_od" },
            "屋上": { path: "1st_Factory_RF.png", id: "f1_rf" }
        }
    },
    "第二工場": {
        folder: "2nd Factory",
        floors: {
            "1階": { path: "2nd_Factory_1F.png", id: "f2_1f" },
            "2階": { path: "2nd_Factory_2F.png", id: "f2_2f" },
            "3階": { path: "2nd_Factory_3F.png", id: "f2_3f" },
            "屋外": { path: "2nd_Factory_Outdoor.png", id: "f2_od" }
        }
    },
    "第三工場": {
        folder: "3rd Factory",
        floors: {
            "1階": { path: "3rd_Factory_1F.png", id: "f3_1f" }
        }
    },
    "豊田工場": {
        folder: "Toyota Factory",
        floors: {
            "1階": { path: "Toyota_Factory_1F.png", id: "tf_1f" },
            "2階": { path: "Toyota_Factory_2F.png", id: "tf_2f" },
            "3階": { path: "Toyota_Factory_3F.png", id: "tf_3f" },
            "屋外": { path: "Toyota_Factory_Outdoor.png", id: "tf_od" }
        }
    }
};

const office_othersConfig = {
    "事務棟": {
        folder: "Head Office",
        floors: {
            "1階": { path: "Head_Office_1F.png", id: "ho_1f" },
            "2階": { path: "Head_Office_2F.png", id: "ho_2f" },
            "3階": { path: "Head_Office_3F.png", id: "ho_3f" },
            "屋外": { path: "Head_Office_Outdoor.png", id: "ho_od" },
            "屋上": { path: "Head_Office_RF.png", id: "ho_rf" }
        }
    },
    "倉庫": {
        folder: "Material Warehouse",
        floors: {
            "1階": { path: "Material_Warehouse_1F.png", id: "wh_1f" },
            "2階": { path: "Material_Warehouse_2F.png", id: "wh_2f" },
            "3階": { path: "Material_Warehouse_3F.png", id: "wh_3f" },
        }
    }
};

const markers = {};
const allConfigs = [factoryConfig, office_othersConfig];

allConfigs.forEach(configSet => {
    for (const building in configSet) {
        const floorData = configSet[building].floors;
        for (const floor in floorData) {
            const id = floorData[floor].id;
            markers[id] = L.layerGroup();
        }
    }
});

// --- 2. NAVIGATION ---
function showSection(sectionId) {
    const sections = ['home', 'map', 'list', 'personal', 'profile', 'settings'];
    closeKaizenSidePanel(); 
    clearTempMarker();

    sections.forEach(s => {
        const content = document.getElementById('content-' + s);
        const link = document.getElementById('link-' + s);
        if (content) content.classList.add('hidden');
        if (link) link.classList.remove('nav-active');
    });

    const activeSection = document.getElementById('content-' + sectionId);
    if (activeSection) activeSection.classList.remove('hidden');

    const activeLink = document.getElementById('link-' + sectionId);
    if (activeLink) activeLink.classList.add('nav-active');

    if (sectionId === 'map') {
        initMap();
        setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    }
}

// --- 3. LEAFLET MAP CORE ---
function initMap() {
    if (!map) {
        map = L.map('kaizen-map', {
            crs: L.CRS.Simple,
            minZoom: -1,
            maxZoom: 2,
            attributionControl: false
        });

        const bounds = [[0, 0], [1500, 2250]];
        const basePath = '/static/resource/Company Blueprints/';

        function buildTreeBranch(configSet) {
            let branch = [];
            for (const buildingName in configSet) {
                const buildingData = configSet[buildingName];
                const buildingNode = { label: buildingName, children: [] };
                
                for (const floorName in buildingData.floors) {
                    const config = buildingData.floors[floorName];
                    const fullPath = `${basePath}${buildingData.folder}/${config.path}`;
                    
                    const imgOverlay = L.imageOverlay(fullPath, bounds);
                    const combinedGroup = L.layerGroup([imgOverlay, markers[config.id]]);
                    
                    buildingNode.children.push({
                        label: floorName,
                        layer: combinedGroup,
                        selected: (config.id === 'f1_1f') 
                    });

                    if (config.id === 'f1_1f') {
                        combinedGroup.addTo(map);
                        activeMarkerLayer = markers[config.id];
                        updateFloorLabel(buildingName, floorName);
                    }
                }
                branch.push(buildingNode);
            }
            return branch;
        }

        const fullTreeData = [
            { label: '工場エリア (Factories)', children: buildTreeBranch(factoryConfig) },
            { label: '事務・倉庫 (Office & Warehouse)', children: buildTreeBranch(office_othersConfig) }
        ];

        L.control.layers.tree(fullTreeData, null, { 
            collapsed: true, 
            position: 'topleft' 
        }).addTo(map);

        map.on('baselayerchange', function(e) {
            const floorId = Object.keys(markers).find(id => e.layer.hasLayer(markers[id]));
            if (floorId) activeMarkerLayer = markers[floorId];
            
            let foundBuilding = "", foundFloor = "";
            [factoryConfig, office_othersConfig].forEach(configSet => {
                for (const bName in configSet) {
                    for (const fName in configSet[bName].floors) {
                        if (configSet[bName].floors[fName].id === floorId) {
                            foundBuilding = bName;
                            foundFloor = fName;
                        }
                    }
                }
            });

            if (foundBuilding && foundFloor) {
                updateFloorLabel(foundBuilding, foundFloor);
            }
            clearTempMarker();
        });

        map.on('click', function(e) {
            const prompt = document.getElementById('map-bottom-prompt');
            const panel = document.getElementById('kaizen-side-panel');
            
            if ((prompt && !prompt.classList.contains('hidden')) || (panel && !panel.classList.contains('hidden'))) {
                clearTempMarker();
                closeKaizenSidePanel();
                return;
            }
            
            tempCoords = e.latlng;
            const greyIcon = new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            if (tempMarker) {
                tempMarker.setLatLng(e.latlng);
                if (!map.hasLayer(tempMarker)) tempMarker.addTo(map);
            } else {
                tempMarker = L.marker(e.latlng, { icon: greyIcon }).addTo(map);
                tempMarker.on('click', (ev) => L.DomEvent.stopPropagation(ev));
            }

            if (prompt) {
                prompt.classList.remove('hidden');
                setTimeout(() => { prompt.style.transform = 'translate(-50%, 0)'; }, 10);
            }
        });

        map.fitBounds(bounds);
    } else {
        setTimeout(() => { map.invalidateSize(); }, 100);
    }
}

// --- 4. FORM LOGIC ---
window.openFullForm = function(event) {
    if (event) event.stopPropagation();
    const prompt = document.getElementById('map-bottom-prompt');
    if(prompt) {
        prompt.classList.add('hidden');
        prompt.style.transform = 'translate(-50%, 200%)';
    }
    if (tempMarker) tempMarker.setIcon(new L.Icon.Default());
    openKaizenSidePanel();

    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay && tempCoords) {
        coordDisplay.innerText = `Y: ${tempCoords.lat.toFixed(1)}, X: ${tempCoords.lng.toFixed(1)}`;
    }
};

window.submitKaizenForm = function() {
    const title = document.getElementById('kaizen-title').value;
    const categoryEl = document.querySelector('input[name="kubun"]:checked');
    const category = categoryEl ? categoryEl.value : "others";
    const desc = document.getElementById('kaizen-description').value;
    
    if (!title || !desc) return alert("件名と内容は必須です。");

    if (activeMarkerLayer && tempCoords) {
        const m = L.marker(tempCoords).addTo(activeMarkerLayer);
        const canEdit = (currentUser.role === 'admin' || currentUser.id === "USR001");

        m.bindPopup(`
            <div class="p-1 text-left min-w-[150px]">
                <b class="text-blue-600 text-sm">${title}</b><br>
                <span class="text-[10px] text-slate-400 font-bold">${category}</span>
                <p class="text-xs mt-1 text-slate-600">${desc}</p>
                <hr class="my-2 border-slate-100">
                ${canEdit ? `<button onclick="deleteMarker(${m._leaflet_id})" class="text-[9px] text-red-400 font-bold uppercase">Remove Pin</button>` : `<span class="text-[9px] text-slate-300">View Only</span>`}
            </div>
        `);

        m.on('click', (e) => { L.DomEvent.stopPropagation(e); clearTempMarker(); });
        addToLists(title, category, desc, m._leaflet_id);
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = null;
        closeKaizenSidePanel(); 
    }
};

// --- 5. LIGHTBOX INTERACTION (DRAG/ZOOM) ---
const viewport = document.getElementById('lightbox-viewport');
const container = document.getElementById('lightbox-container');

if (viewport && container) {
    viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    const zoomSpeed = 0.1;
    const rect = viewport.getBoundingClientRect();
    
    // 1. Get mouse position relative to the viewport
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // 2. Calculate point on the image (accounting for current translate/scale)
    const imageX = (mouseX - translateX) / scale;
    const imageY = (mouseY - translateY) / scale;

    // 3. Determine new scale
    const delta = e.deltaY < 0 ? 1.1 : 0.9; // Smooth multiplier
    const newScale = Math.min(Math.max(scale * delta, 0.5), 5);

    // 4. Calculate new translations to keep imageX/imageY under the cursor
    translateX = mouseX - imageX * newScale;
    translateY = mouseY - imageY * newScale;
    
    scale = newScale;

    updateTransform();
}, { passive: false });

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        viewport.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        if(viewport) viewport.style.cursor = 'grab';
    });

    viewport.onclick = function(e) {
    // Prevent accidental pins while dragging the map
    if (Math.abs(e.movementX) > 5 || Math.abs(e.movementY) > 5) return; 

    const pin = document.getElementById('lightbox-pin');
    
    // TOGGLE LOGIC: If pin is already visible, remove it (Reset)
    if (pin && !pin.classList.contains('hidden')) {
        pin.classList.add('hidden');
        tempRelX = 0;
        tempRelY = 0;
        
        // Reset the coordinate display in the form
        const coordDisplay = document.getElementById('display-coords');
        if(coordDisplay) {
            coordDisplay.innerText = "マップ上で場所を選択してください";
            coordDisplay.classList.add('text-amber-500', 'animate-pulse');
            coordDisplay.classList.remove('text-green-600');
        }
        return; // Exit here so we don't immediately re-pin
    }

    // PIN LOGIC: If no pin, place a new one
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    if (pin) {
        pin.style.left = `${x}px`;
        pin.style.top = `${y}px`;
        pin.classList.remove('hidden');
    }

    const img = document.getElementById('lightbox-img');
    tempRelX = x / img.offsetWidth;
    tempRelY = y / img.offsetHeight;
};
}

function updateTransform() {
    if (container) container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

window.openMapLightbox = function(path, floorId) {
    const lightbox = document.getElementById('map-lightbox');
    const img = document.getElementById('lightbox-img');
    const viewport = document.getElementById('lightbox-viewport');
    
    if (!img || !viewport) return;

    // 1. Set the image source
    img.src = path;
    
    // 2. Reset scale
    scale = 1;

    // 3. Wait for the image to load to get its dimensions, then center it
    img.onload = function() {
        translateX = (viewport.offsetWidth - img.offsetWidth) / 2;
        translateY = (viewport.offsetHeight - img.offsetHeight) / 2;
        updateTransform();
    };

    // 4. Reset pin state
    tempRelX = 0; 
    tempRelY = 0;
    const pin = document.getElementById('lightbox-pin');
    if (pin) pin.classList.add('hidden');

    // 5. Show lightbox
    lightbox.classList.remove('hidden');
    setTimeout(() => lightbox.classList.add('opacity-100'), 10);
};

window.resetLightboxView = function() {
    const vp = document.getElementById('lightbox-viewport');
    const img = document.getElementById('lightbox-img');
    
    scale = 1;
    
    if (vp && img) {
        // Calculate the center offset
        translateX = (vp.offsetWidth - img.offsetWidth) / 2;
        translateY = (vp.offsetHeight - img.offsetHeight) / 2;
    } else {
        translateX = 0;
        translateY = 0;
    }

    updateTransform();
};

window.confirmLightboxLocation = function() {
    const pin = document.getElementById('lightbox-pin');
    
    // Check if the pin is currently hidden
    if (!pin || pin.classList.contains('hidden')) {
        alert("場所をピン留めしてください (Please drop a pin first)");
        return;
    }

    const miniPin = document.getElementById('mini-pin');
    if (miniPin) {
        miniPin.style.left = `${tempRelX * 100}%`;
        miniPin.style.top = `${tempRelY * 100}%`;
        miniPin.classList.remove('hidden');
    }

    // Convert to Leaflet Simple CRS Coords for the final submission
    tempCoords = { lat: (1 - tempRelY) * 1500, lng: tempRelX * 2250 };
    
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "Location Set via Map";
        coordDisplay.classList.remove('animate-pulse', 'text-amber-500');
        coordDisplay.classList.add('text-green-600');
    }
    
    window.closeMapLightbox();
};

window.closeMapLightbox = () => {
    const lightbox = document.getElementById('map-lightbox');
    lightbox.classList.remove('opacity-100');
    setTimeout(() => lightbox.classList.add('hidden'), 300);
};

// --- 6. UTILITIES ---
function clearTempMarker() {
    if (tempMarker && map) map.removeLayer(tempMarker);
    tempMarker = null;
    const prompt = document.getElementById('map-bottom-prompt');
    if (prompt) {
        prompt.style.transform = 'translate(-50%, 200%)';
        setTimeout(() => prompt.classList.add('hidden'), 300);
    }
    tempCoords = null;
}

window.openKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    if (panel) {
        panel.classList.remove('hidden');
        updateFormDate(); 
        setTimeout(() => { 
            panel.style.transform = 'translateX(0)'; 
            if (overlay) { overlay.classList.remove('hidden'); overlay.classList.add('opacity-100'); }
        }, 10);
    }
};

window.closeKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    if (panel) panel.style.transform = 'translateX(100%)';
    if (overlay) { overlay.classList.remove('opacity-100'); setTimeout(() => overlay.classList.add('hidden'), 300); }
    setTimeout(() => { 
        if (panel) panel.classList.add('hidden');
        ['kaizen-title', 'kaizen-description'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = ''; });
    }, 300);
};

function updateFloorLabel(building, floor) {
    const label = document.getElementById('active-floor-name');
    if (label) label.innerText = `${building} - ${floor}`;
}

function updateFormDate() {
    const dateElement = document.getElementById('current-submission-date');
    if(!dateElement) return;
    const now = new Date();
    dateElement.innerText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function updateDashboardClock() {
    const clockElement = document.getElementById('dashboard-clock');
    if (!clockElement) return;
    const now = new Date();
    clockElement.innerText = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

// --- 7. GLOBAL ACTIONS ---
window.openGlobalNewForm = function() {
    openKaizenSidePanel();
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "マップ上で場所を選択してください";
        coordDisplay.classList.add('text-amber-500', 'animate-pulse');
    }
};

window.toggleUserMenu = () => document.getElementById('user-dropdown').classList.toggle('hidden');

// --- 8. CASCADING SELECTORS ---
document.getElementById('select-main-area')?.addEventListener('change', function(e) {
    const bSel = document.getElementById('select-building');
    const fSel = document.getElementById('select-floor');
    const area = e.target.value;

    // Reset Building Dropdown
    bSel.innerHTML = '<option value="" selected disabled>工場を選択 (Select Building)</option>';
    
    if (area) {
        bSel.disabled = false;
        const config = area === 'factory' ? factoryConfig : office_othersConfig;
        for (const b in config) {
            const opt = document.createElement('option');
            opt.value = b; 
            opt.textContent = b;
            bSel.appendChild(opt);
        }
    } else {
        bSel.disabled = true;
    }

    // Always lock the floor until a building is picked
    fSel.disabled = true;
    fSel.innerHTML = '<option value="">階を選択 (Select Floor)</option>';
});

document.getElementById('select-building')?.addEventListener('change', function(e) {
    const fSel = document.getElementById('select-floor');
    const area = document.getElementById('select-main-area').value;
    const b = e.target.value;

    fSel.innerHTML = '<option value="" selected disabled>階を選択 (Select Floor)</option>';
    
    if (b) {
        fSel.disabled = false;
        const config = (area === 'factory' ? factoryConfig : office_othersConfig)[b].floors;
        for (const f in config) {
            const opt = document.createElement('option');
            opt.value = config[f].id; 
            opt.textContent = f;
            fSel.appendChild(opt);
        }
    } else {
        fSel.disabled = true;
    }
});

document.getElementById('select-floor')?.addEventListener('change', function(e) {
    const floorId = e.target.value;
    if (!floorId) return;
    let imgPath = "";
    [factoryConfig, office_othersConfig].forEach(cfg => {
        for (const b in cfg) {
            for (const f in cfg[b].floors) {
                if (cfg[b].floors[f].id === floorId) imgPath = `/static/resource/Company Blueprints/${cfg[b].folder}/${cfg[b].floors[f].path}`;
            }
        }
    });
    const miniMap = document.getElementById('sync-mini-map');
    if (miniMap) {
        miniMap.innerHTML = `
            <div class="group relative w-full h-full cursor-zoom-in" onclick="openMapLightbox('${imgPath}', '${floorId}')">
                <img src="${imgPath}" class="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity">
                <div class="absolute inset-0 flex items-center justify-center bg-black/5">
                    <span class="bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold text-blue-600 shadow-md">
                       <i class="fa-solid fa-magnifying-glass-plus mr-1"></i> マップを拡大してピン留め
                    </span>
                </div>
                <div id="mini-pin" class="absolute hidden text-red-600 pointer-events-none z-10"><i class="fa-solid fa-location-dot text-2xl"></i></div>
            </div>`;
    }
});


// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    showSection('home');
    setInterval(updateDashboardClock, 1000);
});
