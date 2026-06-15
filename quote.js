/* =========================================================
   AFK STUDIO — QUOTE CALCULATOR + 3D WRAP PREVIEW
========================================================= */

const vehicleSel = document.getElementById('vehicle');
const serviceSel = document.getElementById('service');
const pkgOptions = document.querySelectorAll('.pkg-opt');

const outVehicle = document.getElementById('outVehicle');
const outSize = document.getElementById('outSize');
const outService = document.getElementById('outService');
const outMaterial = document.getElementById('outMaterial');
const outPkg = document.getElementById('outPkg');
const outTotal = document.getElementById('outTotal');
const ticketId = document.getElementById('ticketId');
const ticketCta = document.getElementById('ticketCta');

let activePkgMult = 1;
let activePkgLabel = 'Standard';

// Shared quote state — persisted to localStorage for the booking page
const quoteState = {
  vehicle: null,
  size: null,
  sizeLabel: null,
  service: null,
  serviceLabel: null,
  materialSqft: 0,
  pkgLabel: 'Standard',
  total: 0,
  durationHrs: 0,
  panelColors: null
};

pkgOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    pkgOptions.forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    activePkgMult = parseFloat(opt.dataset.mult);
    activePkgLabel = opt.textContent.trim();
    calculate();
  });
});

function calculate(){
  const vOpt = vehicleSel.options[vehicleSel.selectedIndex];
  const sqft = parseFloat(vOpt.dataset.sqft) || 0;
  const size = vOpt.dataset.size || '';
  const vehicleName = vOpt.value;
  const service = serviceSel.value;

  if (!vehicleName) {
    outVehicle.textContent = '—';
    outSize.textContent = '—';
    outService.textContent = serviceLabels[service];
    outMaterial.textContent = '—';
    outPkg.textContent = activePkgLabel;
    outTotal.textContent = '$0';
    ticketId.textContent = 'AFK-000';
    ticketCta.textContent = 'Select a Vehicle';

    quoteState.vehicle = null;
    quoteState.size = null;
    quoteState.sizeLabel = null;
    quoteState.service = service;
    quoteState.serviceLabel = serviceLabels[service];
    quoteState.materialSqft = 0;
    quoteState.pkgLabel = activePkgLabel;
    quoteState.total = 0;
    quoteState.durationHrs = durationHours[service];

    updatePreview(null, null);
    saveQuoteState(quoteState);
    return;
  }

  const factor = coverageFactor[service];
  const materialSqft = Math.round(sqft * factor);
  const rate = rates[service];
  const total = Math.round(materialSqft * rate * activePkgMult);

  outVehicle.textContent = vehicleName;
  outSize.textContent = sizeLabels[size] || '—';
  outService.textContent = serviceLabels[service];
  outMaterial.textContent = materialSqft + ' sq ft';
  outPkg.textContent = activePkgLabel;
  outTotal.textContent = '$' + total.toLocaleString();

  ticketId.textContent = 'AFK-' + String(sqft).padStart(3,'0');
  ticketCta.textContent = 'Book This Quote';

  quoteState.vehicle = vehicleName;
  quoteState.size = size;
  quoteState.sizeLabel = sizeLabels[size] || '—';
  quoteState.service = service;
  quoteState.serviceLabel = serviceLabels[service];
  quoteState.materialSqft = materialSqft;
  quoteState.pkgLabel = activePkgLabel;
  quoteState.total = total;
  quoteState.durationHrs = durationHours[service];

  updatePreview(size, vehicleName);
  saveQuoteState(quoteState);
}

vehicleSel.addEventListener('change', calculate);
serviceSel.addEventListener('change', calculate);

/* =========================================================
   3D WRAP PREVIEW
========================================================= */
const previewPanel = document.getElementById('previewPanel');
const previewVehicleLabel = document.getElementById('previewVehicleLabel');
const previewCanvasWrap = document.getElementById('previewCanvasWrap');
const previewPanelsEl = document.getElementById('previewPanels');
const applyAllColor = document.getElementById('applyAllColor');
const applyAllSwatch = document.getElementById('applyAllSwatch');
const applyAllBtn = document.getElementById('applyAllBtn');

// Vehicle class proportions for the procedural model
const carProfiles = {
  compact: { length: 4.2, width: 1.7, height: 1.3, wheelbase: 2.5, hoodLen: 1.0, trunkLen: 0.8 },
  midsize: { length: 4.7, width: 1.8, height: 1.4, wheelbase: 2.7, hoodLen: 1.1, trunkLen: 1.0 },
  suv:     { length: 4.6, width: 1.85, height: 1.7, wheelbase: 2.7, hoodLen: 1.05, trunkLen: 0.9 },
  truck:   { length: 5.4, width: 1.95, height: 1.85, wheelbase: 3.2, hoodLen: 1.2, trunkLen: 1.4 }
};

const panelLabels = {
  hood: 'Hood',
  roof: 'Roof',
  trunk: 'Trunk / Tailgate',
  doorLeft: 'Doors (Left)',
  doorRight: 'Doors (Right)',
  frontBumper: 'Front Bumper',
  rearBumper: 'Rear Bumper'
};

// Default colour assigned to each panel (by name, from wrapColors in common.js)
const defaultPanelColorNames = {
  hood: 'Gloss Vermilion (AFK Signature)',
  roof: 'Gloss Vermilion (AFK Signature)',
  trunk: 'Gloss Vermilion (AFK Signature)',
  doorLeft: 'Gloss Vermilion (AFK Signature)',
  doorRight: 'Gloss Vermilion (AFK Signature)',
  frontBumper: 'Gloss Black',
  rearBumper: 'Gloss Black'
};

let scene, camera, renderer, carGroup;
const panelMeshes = {};
let panelColors = {}; // panelKey -> hex string
let threeInitialized = false;
let isDragging = false;
let prevPointerX = 0;
let autoRotate = true;

function colorNameToHex(name){
  const found = wrapColors.find(c => c.name === name);
  return found ? found.hex : '#FF4D1C';
}

function populateColorSelect(selectEl, selectedHex){
  selectEl.innerHTML = '';
  wrapColors.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.hex;
    opt.textContent = c.name;
    if (c.hex.toUpperCase() === (selectedHex || '').toUpperCase()) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function initThree(){
  if (threeInitialized || typeof THREE === 'undefined') return;
  threeInitialized = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x23201C);

  camera = new THREE.PerspectiveCamera(35, previewCanvasWrap.clientWidth / previewCanvasWrap.clientHeight, 0.1, 1000);
  camera.position.set(5, 3, 6);
  camera.lookAt(0, 0.6, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(previewCanvasWrap.clientWidth, previewCanvasWrap.clientHeight);
  previewCanvasWrap.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0xFF4D1C, 0.25);
  dirLight2.position.set(-5, 4, -5);
  scene.add(dirLight2);

  const groundGeo = new THREE.PlaneGeometry(20, 20);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1A1714 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  scene.add(ground);

  // Drag rotation
  previewCanvasWrap.addEventListener('mousedown', (e) => {
    isDragging = true; autoRotate = false; prevPointerX = e.clientX;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !carGroup) return;
    carGroup.rotation.y += (e.clientX - prevPointerX) * 0.01;
    prevPointerX = e.clientX;
  });
  previewCanvasWrap.addEventListener('touchstart', (e) => {
    isDragging = true; autoRotate = false; prevPointerX = e.touches[0].clientX;
  }, { passive: true });
  window.addEventListener('touchend', () => isDragging = false);
  window.addEventListener('touchmove', (e) => {
    if (!isDragging || !carGroup) return;
    carGroup.rotation.y += (e.touches[0].clientX - prevPointerX) * 0.01;
    prevPointerX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!previewPanel.classList.contains('visible')) return;
    camera.aspect = previewCanvasWrap.clientWidth / previewCanvasWrap.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(previewCanvasWrap.clientWidth, previewCanvasWrap.clientHeight);
  });

  function animate(){
    requestAnimationFrame(animate);
    if (carGroup && autoRotate) carGroup.rotation.y += 0.003;
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  animate();
}

function box(w, h, d, color){
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.5 });
  return new THREE.Mesh(geo, mat);
}

function buildCar(profileKey){
  if (carGroup) {
    scene.remove(carGroup);
    carGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
  carGroup = new THREE.Group();

  const p = carProfiles[profileKey] || carProfiles.compact;
  const bodyY = 0.35;

  const getColor = (key) => panelColors[key] || colorNameToHex(defaultPanelColorNames[key]);

  // Chassis (non-colorable base)
  const chassisH = p.height * 0.45;
  const chassis = box(p.width, chassisH, p.length, 0x3A352F);
  chassis.position.set(0, bodyY + chassisH/2, 0);
  carGroup.add(chassis);

  // Hood
  const hoodH = p.height * 0.35;
  const hood = box(p.width * 0.96, hoodH, p.hoodLen, getColor('hood'));
  hood.position.set(0, bodyY + chassisH + hoodH/2, (p.length/2) - (p.hoodLen/2) - 0.05);
  carGroup.add(hood);
  panelMeshes.hood = hood;

  // Trunk / tailgate
  const trunkH = p.height * 0.38;
  const trunk = box(p.width * 0.96, trunkH, p.trunkLen, getColor('trunk'));
  trunk.position.set(0, bodyY + chassisH + trunkH/2, -(p.length/2) + (p.trunkLen/2) + 0.05);
  carGroup.add(trunk);
  panelMeshes.trunk = trunk;

  // Cabin / roof
  const cabinLen = p.length - p.hoodLen - p.trunkLen;
  const cabinH = p.height * 0.62;
  const cabinBase = bodyY + chassisH;

  const roofH = p.height * 0.18;
  const roof = box(p.width * 0.88, roofH, cabinLen * 0.82, getColor('roof'));
  roof.position.set(0, cabinBase + cabinH - roofH/2, 0.05);
  carGroup.add(roof);
  panelMeshes.roof = roof;

  // Glass (non-colorable)
  const glassH = cabinH - roofH;
  const glass = box(p.width * 0.84, glassH, cabinLen * 0.78, 0x223344);
  glass.material.metalness = 0.1;
  glass.material.roughness = 0.1;
  glass.material.opacity = 0.7;
  glass.material.transparent = true;
  glass.position.set(0, cabinBase + glassH/2, 0.05);
  carGroup.add(glass);

  // Doors
  const doorH = chassisH + glassH * 0.5;
  const doorLen = cabinLen + 0.3;
  const doorThickness = 0.04;

  const doorRight = box(doorThickness, doorH, doorLen, getColor('doorRight'));
  doorRight.position.set(p.width/2 + doorThickness/2 - 0.01, bodyY + doorH/2, 0.05);
  carGroup.add(doorRight);
  panelMeshes.doorRight = doorRight;

  const doorLeft = box(doorThickness, doorH, doorLen, getColor('doorLeft'));
  doorLeft.position.set(-(p.width/2 + doorThickness/2 - 0.01), bodyY + doorH/2, 0.05);
  carGroup.add(doorLeft);
  panelMeshes.doorLeft = doorLeft;

  // Bumpers
  const bumperH = p.height * 0.22;
  const bumperLen = 0.3;

  const frontBumper = box(p.width * 1.0, bumperH, bumperLen, getColor('frontBumper'));
  frontBumper.position.set(0, bodyY + bumperH/2, p.length/2 + bumperLen/2 - 0.05);
  carGroup.add(frontBumper);
  panelMeshes.frontBumper = frontBumper;

  const rearBumper = box(p.width * 1.0, bumperH, bumperLen, getColor('rearBumper'));
  rearBumper.position.set(0, bodyY + bumperH/2, -(p.length/2) - bumperLen/2 + 0.05);
  carGroup.add(rearBumper);
  panelMeshes.rearBumper = rearBumper;

  // Wheels
  const wheelRadius = p.height * 0.28;
  const wheelWidth = 0.25;
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.7 });

  const wheelXOffset = p.width/2 + wheelWidth/2 - 0.02;
  const wheelZOffset = p.wheelbase/2;
  const wheelY = wheelRadius - 0.1;

  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([xs, zs]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI/2;
    wheel.position.set(xs * wheelXOffset, wheelY, zs * wheelZOffset);
    carGroup.add(wheel);
  });

  scene.add(carGroup);
}

function buildPanelControls(){
  previewPanelsEl.innerHTML = '';
  Object.keys(panelLabels).forEach(panelKey => {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-swatch';

    const label = document.createElement('label');
    label.textContent = panelLabels[panelKey];
    wrapper.appendChild(label);

    const row = document.createElement('div');
    row.className = 'swatch-row';

    const indicator = document.createElement('div');
    indicator.className = 'swatch-indicator';
    const currentHex = panelColors[panelKey] || colorNameToHex(defaultPanelColorNames[panelKey]);
    indicator.style.background = currentHex;
    row.appendChild(indicator);

    const select = document.createElement('select');
    populateColorSelect(select, currentHex);
    select.addEventListener('change', (e) => {
      const hex = e.target.value;
      panelColors[panelKey] = hex;
      indicator.style.background = hex;
      if (panelMeshes[panelKey]) panelMeshes[panelKey].material.color.set(hex);
      persistPanelColors();
    });
    row.appendChild(select);

    wrapper.appendChild(row);
    previewPanelsEl.appendChild(wrapper);
  });
}

function persistPanelColors(){
  quoteState.panelColors = Object.assign({}, panelColors);
  saveQuoteState(quoteState);
}

applyAllBtn.addEventListener('click', () => {
  const hex = applyAllColor.value;
  Object.keys(panelLabels).forEach(panelKey => {
    panelColors[panelKey] = hex;
    if (panelMeshes[panelKey]) panelMeshes[panelKey].material.color.set(hex);
  });
  persistPanelColors();
  // Refresh individual swatches to reflect new colour
  buildPanelControls();
});

applyAllColor.addEventListener('change', (e) => {
  applyAllSwatch.style.background = e.target.value;
});

function updatePreview(sizeClass, vehicleName){
  if (!sizeClass || !vehicleName){
    previewPanel.classList.remove('visible');
    return;
  }

  previewPanel.classList.add('visible');
  previewVehicleLabel.textContent = vehicleName;

  initThree();
  if (!threeInitialized) return; // THREE failed to load

  // Initialise panel colours to defaults on first preview of this session
  if (Object.keys(panelColors).length === 0){
    Object.keys(panelLabels).forEach(key => {
      panelColors[key] = colorNameToHex(defaultPanelColorNames[key]);
    });
  }

  buildCar(sizeClass);
  buildPanelControls();

  // Populate "apply to all" select
  populateColorSelect(applyAllColor, '#FF4D1C');
  applyAllSwatch.style.background = applyAllColor.value;

  persistPanelColors();

  // Force a resize/render after becoming visible
  requestAnimationFrame(() => {
    if (camera && renderer){
      camera.aspect = previewCanvasWrap.clientWidth / previewCanvasWrap.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(previewCanvasWrap.clientWidth, previewCanvasWrap.clientHeight);
    }
  });
}

// Restore previous selection on page load, if any
(function restore(){
  const saved = loadQuoteState();
  if (saved && saved.vehicle){
    // Try to find and select the matching option
    for (let i = 0; i < vehicleSel.options.length; i++){
      if (vehicleSel.options[i].value === saved.vehicle){
        vehicleSel.selectedIndex = i;
        break;
      }
    }
  }
  if (saved && saved.service){
    serviceSel.value = saved.service;
  }
  if (saved && saved.pkgLabel){
    pkgOptions.forEach(opt => {
      if (opt.textContent.trim() === saved.pkgLabel){
        pkgOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        activePkgMult = parseFloat(opt.dataset.mult);
        activePkgLabel = saved.pkgLabel;
      }
    });
  }
  if (saved && saved.panelColors){
    panelColors = Object.assign({}, saved.panelColors);
  }
})();

// Initial render
calculate();
