/* Kaizen Portal - Script.js (Google Maps Style Interaction Update) */

let map;
let activeMarkerLayer = null; 
let tempCoords = null;
let tempMarker = null; // Holds the grey "pending" pin
let tempRelX = 0;
let tempRelY = 0;

// Mock User Data for Permission Logic
const currentUser = { id: "USR001", role: "admin" }; 

// 1. DYNAMIC CONFIGURATION
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

// 2. MARKER STORAGE
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

// 3. NAVIGATION
function showSection(sectionId) {
    const sections = ['home', 'map', 'list', 'personal', 'profile', 'settings'];
    
    // 1. CLOSE THE PANEL ON EVERY NAVIGATION
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

// 4. MAP CORE LOGIC
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

        // 4a. TREE NODE BUILDER
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

        /* --- REPLACE YOUR OLD map.on('baselayerchange'...) WITH THIS --- */
         map.on('baselayerchange', function(e) {
    // 1. Identify which marker layer group to make active
    const floorId = Object.keys(markers).find(id => e.layer.hasLayer(markers[id]));
    if (floorId) activeMarkerLayer = markers[floorId];
    
    // 2. Determine the Building and Floor Name from your Configs
    let foundBuilding = "";
    let foundFloor = "";

    const searchConfigs = [factoryConfig, office_othersConfig];
    
    searchConfigs.forEach(configSet => {
        for (const bName in configSet) {
            const floors = configSet[bName].floors;
            for (const fName in floors) {
                // If the ID matches (e.g., 'f1_1f'), grab the actual keys
                if (floors[fName].id === floorId) {
                    foundBuilding = bName; // e.g., "第一工場"
                    foundFloor = fName;    // e.g., "1階"
                }
            }
        }
    });

    // 3. Update the UI Label
    // If we found a match in our config, use those names. 
    // Otherwise, fallback to the event name.
    if (foundBuilding && foundFloor) {
        updateFloorLabel(foundBuilding, foundFloor);
    } else if (e.name) {
        const labelElement = document.getElementById('active-floor-name');
        if (labelElement) labelElement.innerText = e.name;
    }
    
    // 4. Cleanup UI
    clearTempMarker();
});

        map.fitBounds(bounds);

        
        // 4c. GOOGLE MAPS STYLE CLICK HANDLER (WITH TOGGLE LOGIC)
map.on('click', function(e) {
    const prompt = document.getElementById('map-bottom-prompt');
    const panel = document.getElementById('kaizen-side-panel');
    
    // --- THE FIX: TOGGLE LOGIC ---
    // If the prompt is already visible OR the side panel is open, 
    // the user's "2nd click" should just clear everything and stop.
    const isPromptVisible = prompt && !prompt.classList.contains('hidden');
    const isPanelVisible = panel && !panel.classList.contains('hidden');

    if (isPromptVisible || isPanelVisible) {
        clearTempMarker(); // This removes pin and hides the prompt
        closeKaizenSidePanel(); // This slides the side panel away
        return; // STOP HERE. Don't proceed to place a new pin.
    }
    // -----------------------------

    // If we reached here, it's the "1st click" (or "3rd click")
    // Proceed to place the pin and show the prompt
    
    tempCoords = e.latlng;

    const greyIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    // Create or move the pin
    if (tempMarker) {
        tempMarker.setLatLng(e.latlng);
        if (!map.hasLayer(tempMarker)) tempMarker.addTo(map);
    } else {
        tempMarker = L.marker(e.latlng, { icon: greyIcon }).addTo(map);
        // Stop marker click from bubbling up to map (prevents double-toggling)
        tempMarker.on('click', (ev) => L.DomEvent.stopPropagation(ev));
    }

    // Show the bottom prompt (Snackbar)
    if (prompt) {
        prompt.classList.remove('hidden');
        // Use a tiny timeout to trigger the CSS transition if you have one
        setTimeout(() => {
            prompt.style.transform = 'translate(-50%, 0)';
        }, 10);
    }
});

    } else {
        setTimeout(() => { map.invalidateSize(); }, 100);
    }
}

// 5. STEP 2: OPEN FORM FROM SNACKBAR
window.openFullForm = function(event) {
    // CRITICAL: Stop the map from receiving this click
    if (event) event.stopPropagation();

    const prompt = document.getElementById('map-bottom-prompt');
    if(prompt) {
        prompt.classList.add('hidden');
        prompt.style.transform = 'translate(-50%, 200%)'; // Move it down so it's ready for next time
    }
    if (tempMarker) {
        tempMarker.setIcon(new L.Icon.Default());
    }

    const panel = document.getElementById('kaizen-side-panel');
    if (panel) {
        panel.classList.remove('hidden');
        updateFormDate(); 
        // Use a slight delay to ensure the 'hidden' class removal is processed before sliding
        setTimeout(() => { 
            panel.style.transform = 'translateX(0)'; 
        }, 50);
    }

    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay && tempCoords) {
        coordDisplay.innerText = `Y: ${tempCoords.lat.toFixed(1)}, X: ${tempCoords.lng.toFixed(1)}`;
    }
};

function clearTempMarker() {
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null; // Important: set to null so next click creates a fresh one
    }
    const prompt = document.getElementById('map-bottom-prompt');
    if (prompt) {
        prompt.style.transform = 'translate(-50%, 200%)';
        setTimeout(() => prompt.classList.add('hidden'), 300);
    }
    tempCoords = null;
}

// 6. FORM SUBMISSION
window.submitKaizenForm = function() {
    const title = document.getElementById('kaizen-title').value;
    const categoryEl = document.querySelector('input[name="kubun"]:checked');
    const category = categoryEl ? categoryEl.value : "others";
    const desc = document.getElementById('kaizen-description').value;
    
    if (!title || !desc) {
        alert("件名と内容は必須です。");
        return;
    }

    if (activeMarkerLayer && tempCoords) {
        const m = L.marker(tempCoords).addTo(activeMarkerLayer);
        
        // Simulating logic: only owner or admin can see Delete button
        const canEdit = (currentUser.role === 'admin' || currentUser.id === "USR001");

        m.bindPopup(`
            <div class="p-1 text-left min-w-[150px]">
                <b class="text-blue-600 text-sm">${title}</b><br>
                <span class="text-[10px] text-slate-400 font-bold">${category}</span>
                <p class="text-xs mt-1 text-slate-600">${desc}</p>
                <hr class="my-2 border-slate-100">
                ${canEdit ? 
                    `<button onclick="deleteMarker(${m._leaflet_id})" class="text-[9px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wider">Remove Pin</button>` : 
                    `<span class="text-[9px] text-slate-300">View Only</span>`
                }
            </div>
        `);

        m.on('click', function(e) {
            L.DomEvent.stopPropagation(e); // Prevent map 'click' from firing
            clearTempMarker(); // Remove the grey pin and snackbar
            // The popup will open automatically via bindPopup
        });

        addToLists(title, category, desc, m._leaflet_id);
        
        // Remove the temporary grey marker since we have the real blue one now
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = null;

        closeKaizenSidePanel(); 
    }
};

// 7. UTILITIES
window.closeKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    if(!panel) return;
    
    panel.style.transform = 'translateX(100%)';
    
    // Wait for the CSS transition (300ms) to finish before hiding
    setTimeout(() => {
        panel.classList.add('hidden');
        
        // Clear inputs
        const titleField = document.getElementById('kaizen-title');
        const descField = document.getElementById('kaizen-description');
        if(titleField) titleField.value = '';
        if(descField) descField.value = '';
    }, 300);

    // Optional: Only clear the temp marker if you REALLY want it gone 
    // when the user cancels. Otherwise, they have to click the map again.
    // clearTempMarker(); 
};

window.deleteMarker = function(id) {
    if (activeMarkerLayer) {
        activeMarkerLayer.eachLayer(layer => {
            if (layer._leaflet_id === id) {
                activeMarkerLayer.removeLayer(layer);
            }
        });
    }
};

function updateFloorLabel(building, floor) {
    const label = document.getElementById('active-floor-name');
    if (label) {
        label.innerText = `${building} - ${floor}`;
    }
}

function updateFormDate() {
    const dateElement = document.getElementById('current-submission-date');
    if(!dateElement) return;
    const now = new Date();
    dateElement.innerText = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function addToLists(title, category, desc, id) {
    const today = new Date().toLocaleDateString('ja-JP');
    const tableBody = document.getElementById('all-kaizen-table-body');
    const row = `<tr>
        <td class="p-4 text-xs font-mono">${today}</td>
        <td class="p-4 font-bold text-xs">System Admin</td>
        <td class="p-4 text-xs">Production</td>
        <td class="p-4 text-sm">${title}</td>
        <td class="p-4 text-xs font-bold text-blue-500">#${category}</td>
        <td class="p-4"><span class="bg-amber-100 text-amber-700 text-[10px] px-2 py-1 rounded-full font-black">PENDING</span></td>
    </tr>`;
    if(tableBody) tableBody.insertAdjacentHTML('afterbegin', row);
}

// Function to show the panel
// --- UNIFIED PANEL LOGIC ---
window.openKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    
    if (panel) {
        panel.classList.remove('hidden');
        updateFormDate(); 
        // Small delay to trigger CSS transition
        setTimeout(() => { 
            panel.style.transform = 'translateX(0)'; 
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.classList.add('opacity-100');
            }
        }, 10);
    }
};

window.closeKaizenSidePanel = function() {
    const panel = document.getElementById('kaizen-side-panel');
    const overlay = document.getElementById('side-panel-overlay');
    
    if (panel) {
        panel.style.transform = 'translateX(100%)';
        panel.classList.remove('active-global'); // Clear the bypass flag
    }

    if (overlay) {
        overlay.classList.remove('opacity-100');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
    
    // Hide panel completely after animation
    setTimeout(() => {
        if (panel) panel.classList.add('hidden');
        // Clear inputs
        const fields = ['kaizen-title', 'kaizen-description'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
    }, 300);
};

// 8. DASHBOARD CLOCK
function updateDashboardClock() {
    const clockElement = document.getElementById('dashboard-clock'); // Add this ID in your HTML
    if (!clockElement) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    clockElement.innerText = `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

// Start the clock interval
setInterval(updateDashboardClock, 1000);

// 9. NEW REPORT BUTTON LOGIC
window.startNewReport = function() {
    // 9.1. Switch to map section
    showSection('map');
    
    // 9.2. Clear any old data
    clearTempMarker(); 
    
    // 9.3. Optional: Show a small toast or alert to guide the user
    // You could use the existing map-bottom-prompt but change the text
    const prompt = document.getElementById('map-bottom-prompt');
    if (prompt) {
        prompt.classList.remove('hidden');
        prompt.innerHTML = `<div class="flex items-center gap-2">
            <i class="fa-solid fa-location-dot animate-bounce"></i>
            <span>マップ上をクリックして場所を選択してください</span>
        </div>`;
        prompt.style.transform = 'translate(-50%, 0)';
    }
};

window.openGlobalNewForm = function() {
        
    // 1. Open the side panel immediately
    const panel = document.getElementById('kaizen-side-panel');
    if (panel) {
        panel.classList.remove('hidden');
        panel.classList.add('active-global'); // Temporary flag to prevent auto-close
        updateFormDate(); // Set current date
        
        setTimeout(() => { 
            panel.style.transform = 'translateX(0)'; 
        }, 50);
    }

    // 2. Update the coordinate display to show it's pending
    const coordDisplay = document.getElementById('display-coords');
    if(coordDisplay) {
        coordDisplay.innerText = "マップ上で場所を選択してください (Select location on map)";
        coordDisplay.classList.add('text-amber-500', 'animate-pulse');
    }
};

// cascading selector 
// Add event listeners to the new dropdowns
document.getElementById('select-main-area').addEventListener('change', function(e) {
    const buildingSelect = document.getElementById('select-building');
    const floorSelect = document.getElementById('select-floor');
    const area = e.target.value;

    // Reset children
    buildingSelect.innerHTML = '<option value="">選択してください</option>';
    buildingSelect.disabled = !area;
    buildingSelect.classList.toggle('opacity-50', !area);
    floorSelect.disabled = true;
    floorSelect.classList.add('opacity-50');

    const configSource = area === 'factory' ? factoryConfig : office_othersConfig;

    for (const building in configSource) {
        const opt = document.createElement('option');
        opt.value = building;
        opt.textContent = building;
        buildingSelect.appendChild(opt);
    }
});

// mini-map
document.getElementById('select-floor').addEventListener('change', function(e) {
    const floorId = e.target.value;
    if (!floorId) return;

    // 1. Find the image path from your configs
    let imgPath = "";
    const searchConfigs = [factoryConfig, office_othersConfig];
    
    searchConfigs.forEach(cfg => {
        for (const b in cfg) {
            for (const f in cfg[b].floors) {
                if (cfg[b].floors[f].id === floorId) {
                    imgPath = `/static/resource/Company Blueprints/${cfg[b].folder}/${cfg[b].floors[f].path}`;
                }
            }
        }
    });

    if (!imgPath) return;

    // 2. Update the mini-map preview with the "Zoom-in" overlay
    const miniMapContainer = document.getElementById('sync-mini-map');
    miniMapContainer.innerHTML = `
        <div class="group relative w-full h-full cursor-zoom-in" id="mini-map-trigger">
            <img src="${imgPath}" class="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity">
            <div class="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-transparent transition-colors">
                <span class="bg-white/90 px-3 py-1 rounded-full text-[10px] font-bold text-blue-600 shadow-md border border-blue-100">
                   <i class="fa-solid fa-magnifying-glass-plus mr-1"></i> マップを拡大してピン留め
                </span>
            </div>
            <!-- This is the pin that will appear AFTER you select it in the lightbox -->
            <div id="mini-pin" class="absolute hidden text-red-600 pointer-events-none z-10">
                <i class="fa-solid fa-location-dot text-2xl"></i>
            </div>
        </div>
    `;

    // 3. Link the click to the Lightbox (The big modal)
    document.getElementById('mini-map-trigger').onclick = function() {
        openMapLightbox(imgPath, floorId);
    };
});

document.getElementById('select-building').addEventListener('change', function(e) {
    const floorSelect = document.getElementById('select-floor');
    const area = document.getElementById('select-main-area').value;
    const building = e.target.value;

    floorSelect.innerHTML = '<option value="">階を選択</option>';
    floorSelect.disabled = !building;
    floorSelect.classList.toggle('opacity-50', !building);

    const configSource = area === 'factory' ? factoryConfig : office_othersConfig;
    const floors = configSource[building].floors;

    for (const floorName in floors) {
        const opt = document.createElement('option');
        opt.value = floors[floorName].id; // Use the ID (e.g., f1_1f)
        opt.textContent = floorName;
        floorSelect.appendChild(opt);
    }
});

window.openMapLightbox = function(path, floorId) {
    const lightbox = document.getElementById('map-lightbox');
    const img = document.getElementById('lightbox-img');
    const pin = document.getElementById('lightbox-pin');

    img.src = path;
    pin.classList.add('hidden'); // Reset pin for new open

    lightbox.classList.remove('hidden');
    setTimeout(() => lightbox.classList.add('opacity-100'), 10);

    // Pin logic inside the big view
    img.onclick = function(ev) {
        const rect = img.getBoundingClientRect();
        tempRelX = (ev.clientX - rect.left) / rect.width;
        tempRelY = (ev.clientY - rect.top) / rect.height;

        pin.style.left = `${tempRelX * 100}%`;
        pin.style.top = `${tempRelY * 100}%`;
        pin.style.transform = "translate(-50%, -100%)"; // Anchor at bottom of pin
        pin.classList.remove('hidden');
    };
};

// This function is called when the user clicks "Confirm Location" in the lightbox
window.confirmLightboxLocation = function() {
    if (!tempRelX) return alert("場所を選択してください");

    // Sync back to the mini-map preview
    const miniPin = document.getElementById('mini-pin');
    if (miniPin) {
        miniPin.style.left = `${tempRelX * 100}%`;
        miniPin.style.top = `${tempRelY * 100}%`;
        miniPin.style.transform = "translate(-50%, -100%)";
        miniPin.classList.remove('hidden');
    }

    // Save actual coords for final submission
    tempCoords = { relX: tempRelX, relY: tempRelY };
    
    closeMapLightbox();
};

window.closeMapLightbox = () => {
    const lightbox = document.getElementById('map-lightbox');
    lightbox.classList.remove('opacity-100');
    setTimeout(() => lightbox.classList.add('hidden'), 300);
};

window.toggleUserMenu = () => document.getElementById('user-dropdown').classList.toggle('hidden');

document.addEventListener('DOMContentLoaded', () => {
    showSection('home');
    updateFormDate();
});
