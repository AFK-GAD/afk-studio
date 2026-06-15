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
  compact: {
    label: 'Compact / Small Sedan',
    bodyStyle: 'hatchback',
    length: 4.0, width: 1.65, height: 1.25,
    wheelbase: 2.4, hoodLen: 0.95, trunkLen: 0.55,
    wheelScale: 1.0
  },
  midsize: {
    label: 'Mid-size Sedan / Coupe',
    bodyStyle: 'sedan',
    length: 4.8, width: 1.78, height: 1.35,
    wheelbase: 2.75, hoodLen: 1.15, trunkLen: 1.05,
    wheelScale: 1.05
  },
  suv: {
    label: 'SUV / Crossover',
    bodyStyle: 'suv',
    length: 4.7, width: 1.9, height: 1.78,
    wheelbase: 2.75, hoodLen: 1.0, trunkLen: 0.55,
    wheelScale: 1.2
  },
  truck: {
    label: 'Truck / Large SUV',
    bodyStyle: 'pickup',
    length: 5.6, width: 2.0, height: 1.9,
    wheelbase: 3.4, hoodLen: 1.15, trunkLen: 1.5,
    wheelScale: 1.35
  }
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
  hood: 'AFK Signature Vermilion',
  roof: 'AFK Signature Vermilion',
  trunk: 'AFK Signature Vermilion',
  doorLeft: 'AFK Signature Vermilion',
  doorRight: 'AFK Signature Vermilion',
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

  camera = new THREE.PerspectiveCamera(40, previewCanvasWrap.clientWidth / previewCanvasWrap.clientHeight, 0.1, 1000);
  camera.position.set(5.5, 3.2, 6.5);
  camera.lookAt(0, 0.7, 0);

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

// A box with rounded vertical edges (rounded rect cross-section, extruded along Z = depth)
function roundedBox(w, h, d, radius, color){
  const r = Math.min(radius, w/2 - 0.001, h/2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w/2, y = -h/2;

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    curveSegments: 8
  });
  geo.translate(0, 0, -d/2); // center along Z so position behaves like BoxGeometry
  const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.5 });
  return new THREE.Mesh(geo, mat);
}

// A box that tapers in height from back to front (used for sloped hoods/rooflines).
// frontH = height at +Z end, backH = height at -Z end. Base sits at y=0 (bottom face flat).
function taperedBox(w, backH, frontH, d, color){
  const geo = new THREE.BoxGeometry(w, 1, d, 1, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++){
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    // z ranges -d/2 (back) .. +d/2 (front); y ranges -0.5 (bottom) .. +0.5 (top)
    const t = (z + d/2) / d; // 0 at back, 1 at front
    const h = backH + (frontH - backH) * t;
    const newY = (y + 0.5) * h; // 0 at bottom, h at top
    pos.setY(i, newY);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.4, roughness: 0.5 });
  return new THREE.Mesh(geo, mat);
}

// A box that tapers in height AND has rounded vertical side edges — combines roundedBox + taper.
function roundedTaperedBox(w, backH, frontH, d, radius, color){
  const maxH = Math.max(backH, frontH, 0.05);
  const r = Math.min(radius, w/2 - 0.001, maxH/2 - 0.001);
  const shape = new THREE.Shape();
  const x = -w/2, y = 0;

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + maxH - r);
  shape.quadraticCurveTo(x + w, y + maxH, x + w - r, y + maxH);
  shape.lineTo(x + r, y + maxH);
  shape.quadraticCurveTo(x, y + maxH, x, y + maxH - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    curveSegments: 8
  });
  geo.translate(0, 0, -d/2);

  // Taper the height by scaling Y per-vertex based on Z position
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++){
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const t = (pz + d/2) / d; // 0 = back, 1 = front
    const targetH = backH + (frontH - backH) * t;
    const scale = maxH > 0 ? targetH / maxH : 1;
    pos.setY(i, py * scale);
  }
  geo.computeVertexNormals();

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

  // Chassis (non-colorable base) — slightly narrower than body for a "running board" look
  const chassisH = p.height * 0.22;
  const chassis = box(p.width * 0.94, chassisH, p.length * 0.96, 0x2A2622);
  chassis.position.set(0, bodyY + chassisH/2, 0);
  carGroup.add(chassis);

  const bodyBase = bodyY + chassisH; // top of chassis = base of body panels
  const cabinLen = p.length - p.hoodLen - p.trunkLen;

  /* ---------------------------------------------------
     HOOD — slopes down toward the front bumper
  --------------------------------------------------- */
  const hoodH = p.height * 0.30;
  const hoodFrontH = hoodH * 0.55; // lower at the very front
  const hood = taperedBox(p.width * 0.98, hoodH, hoodFrontH, p.hoodLen, getColor('hood'));
  hood.position.set(0, bodyBase, (p.length/2) - (p.hoodLen/2));
  carGroup.add(hood);
  panelMeshes.hood = hood;

  /* ---------------------------------------------------
     TRUNK / TAILGATE / BED — varies by body style
  --------------------------------------------------- */
  let trunkH = p.height * 0.30;
  let trunkMesh;

  if (p.bodyStyle === 'hatchback'){
    // Taller hatch panel near the cabin, sloping down toward the rear bumper
    trunkH = p.height * 0.55;
    const trunkBumperH = trunkH * 0.6;
    trunkMesh = taperedBox(p.width * 0.98, trunkBumperH, trunkH, p.trunkLen, getColor('trunk'));
    trunkMesh.position.set(0, bodyBase, -(p.length/2) + (p.trunkLen/2));
  } else if (p.bodyStyle === 'pickup'){
    // Truck bed: rounded low side walls
    const bedWallH = p.height * 0.32;
    trunkMesh = roundedBox(p.width * 0.98, bedWallH, p.trunkLen, 0.05, getColor('trunk'));
    trunkMesh.position.set(0, bodyBase + bedWallH/2, -(p.length/2) + (p.trunkLen/2));
    trunkH = bedWallH;
  } else {
    // Sedan / SUV trunk or tailgate — slight rise toward the cabin side
    const trunkFrontH = trunkH * 0.85;
    trunkMesh = taperedBox(p.width * 0.98, trunkFrontH, trunkH, p.trunkLen, getColor('trunk'));
    trunkMesh.position.set(0, bodyBase, -(p.length/2) + (p.trunkLen/2));
  }
  carGroup.add(trunkMesh);
  panelMeshes.trunk = trunkMesh;

  /* ---------------------------------------------------
     CABIN / ROOF / GLASS — varies by body style
  --------------------------------------------------- */
  let cabinH, cabinForwardLen, roofH, roofLen, roofYOffset, glassH;

  if (p.bodyStyle === 'suv'){
    cabinH = p.height * 0.78;
    cabinForwardLen = cabinLen * 0.95; // roofline extends almost to rear
    roofH = p.height * 0.16;
  } else if (p.bodyStyle === 'pickup'){
    cabinH = p.height * 0.62;
    cabinForwardLen = cabinLen * 0.55; // shorter cab, rest is bed
    roofH = p.height * 0.15;
  } else if (p.bodyStyle === 'hatchback'){
    cabinH = p.height * 0.68;
    cabinForwardLen = cabinLen * 0.88;
    roofH = p.height * 0.16;
  } else {
    // sedan
    cabinH = p.height * 0.66;
    cabinForwardLen = cabinLen * 0.82;
    roofH = p.height * 0.17;
  }

  const cabinBase = bodyBase;
  const cabinZOffset = p.bodyStyle === 'pickup'
    ? (p.length/2) - p.hoodLen - cabinForwardLen/2 // push cab toward front, leaving room for bed
    : 0;

  roofLen = cabinForwardLen;
  const roofFrontH = roofH * 0.85; // slight forward slope on the roofline
  const roof = roundedTaperedBox(p.width * 0.9, roofH, roofFrontH, roofLen, 0.08, getColor('roof'));
  roof.position.set(0, cabinBase + cabinH - roofH, cabinZOffset);
  carGroup.add(roof);
  panelMeshes.roof = roof;

  // Glass (non-colorable) — tapers shorter toward the front for a raked windshield look
  glassH = cabinH - roofH;
  const glassFrontH = glassH * 0.75;
  const glass = taperedBox(p.width * 0.86, glassH, glassFrontH, roofLen * 0.92, 0x223344);
  glass.material.metalness = 0.1;
  glass.material.roughness = 0.1;
  glass.material.opacity = 0.7;
  glass.material.transparent = true;
  glass.position.set(0, cabinBase, cabinZOffset);
  carGroup.add(glass);

  /* ---------------------------------------------------
     DOORS — rounded front/rear edges (built as roundedBox then rotated)
  --------------------------------------------------- */
  const doorH = chassisH + glassH * 0.55;
  const doorLen = p.bodyStyle === 'pickup' ? cabinForwardLen + 0.4 : cabinLen + 0.3;
  const doorThickness = 0.05;
  const doorZOffset = p.bodyStyle === 'pickup' ? cabinZOffset : 0;
  const doorRadius = 0.06;

  // roundedBox builds its rounded cross-section in the X/Y plane, extruded along Z.
  // We want rounding on the length/height face, with thickness along X — so build
  // with (length, height, thickness) then rotate 90° around Y.
  const doorRight = roundedBox(doorLen, doorH, doorThickness, doorRadius, getColor('doorRight'));
  doorRight.rotation.y = Math.PI / 2;
  doorRight.position.set(p.width/2 + doorThickness/2 - 0.01, bodyY + doorH/2, doorZOffset);
  carGroup.add(doorRight);
  panelMeshes.doorRight = doorRight;

  const doorLeft = roundedBox(doorLen, doorH, doorThickness, doorRadius, getColor('doorLeft'));
  doorLeft.rotation.y = Math.PI / 2;
  doorLeft.position.set(-(p.width/2 + doorThickness/2 - 0.01), bodyY + doorH/2, doorZOffset);
  carGroup.add(doorLeft);
  panelMeshes.doorLeft = doorLeft;

  /* ---------------------------------------------------
     BUMPERS — rounded ends
  --------------------------------------------------- */
  const bumperH = p.height * 0.20;
  const bumperLen = 0.32;
  const bumperRadius = 0.07;

  // roundedBox rounds the X/Y cross-section (width x height), extruded along Z (bumper depth)
  const frontBumper = roundedBox(p.width * 1.0, bumperH, bumperLen, bumperRadius, getColor('frontBumper'));
  frontBumper.position.set(0, bodyY + bumperH/2, p.length/2 + bumperLen/2 - 0.06);
  carGroup.add(frontBumper);
  panelMeshes.frontBumper = frontBumper;

  const rearBumper = roundedBox(p.width * 1.0, bumperH, bumperLen, bumperRadius, getColor('rearBumper'));
  rearBumper.position.set(0, bodyY + bumperH/2, -(p.length/2) - bumperLen/2 + 0.06);
  carGroup.add(rearBumper);
  panelMeshes.rearBumper = rearBumper;

  /* ---------------------------------------------------
     WHEELS — scaled per class
  --------------------------------------------------- */
  const wheelRadius = p.height * 0.26 * (p.wheelScale || 1);
  const wheelWidth = 0.28 * (p.wheelScale || 1);
  const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.7 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 });
  const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.45, wheelRadius * 0.45, wheelWidth + 0.02, 12);

  const wheelXOffset = p.width/2 + wheelWidth/2 - 0.02;
  const wheelZOffset = p.wheelbase/2;
  const wheelY = wheelRadius - 0.05;

  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([xs, zs]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI/2;
    wheel.position.set(xs * wheelXOffset, wheelY, zs * wheelZOffset);
    carGroup.add(wheel);

    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI/2;
    hub.position.set(xs * wheelXOffset, wheelY, zs * wheelZOffset);
    carGroup.add(hub);
  });

  // Store original (non-highlighted) emissive state for each colorable panel
  Object.values(panelMeshes).forEach(mesh => {
    mesh.userData.baseEmissive = mesh.material.emissive.clone();
    mesh.userData.baseEmissiveIntensity = mesh.material.emissiveIntensity || 1;
  });

  scene.add(carGroup);

  // Adjust camera distance so larger vehicles (e.g. trucks) stay in frame
  frameCameraForVehicle(p);

  // Re-apply highlight if a panel is currently selected for highlighting
  if (highlightedPanel && panelMeshes[highlightedPanel]){
    setHighlight(highlightedPanel);
  }
}

function frameCameraForVehicle(p){
  if (!camera) return;
  // Base distance tuned for the compact profile (~4.0m length); scale up for longer vehicles
  const baseLength = 4.0;
  const scaleFactor = Math.max(1, p.length / baseLength);
  const dist = { x: 5.5, y: 3.2, z: 6.5 };
  camera.position.set(dist.x * scaleFactor, dist.y * (1 + (scaleFactor - 1) * 0.4), dist.z * scaleFactor);
  camera.lookAt(0, p.height * 0.35, 0);
}

/* ===== Panel highlighting ===== */
let highlightedPanel = null;

function clearHighlight(){
  Object.values(panelMeshes).forEach(mesh => {
    if (!mesh.material) return;
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 1;
  });
}

function setHighlight(panelKey){
  clearHighlight();
  highlightedPanel = panelKey;
  const mesh = panelMeshes[panelKey];
  if (mesh && mesh.material){
    mesh.material.emissive.setHex(0xFF4D1C);
    mesh.material.emissiveIntensity = 0.35;
  }
}

function buildPanelControls(){
  previewPanelsEl.innerHTML = '';
  Object.keys(panelLabels).forEach(panelKey => {
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-swatch';
    wrapper.dataset.panel = panelKey;

    const labelRow = document.createElement('div');
    labelRow.className = 'swatch-label-row';

    const label = document.createElement('label');
    label.textContent = panelLabels[panelKey];
    labelRow.appendChild(label);

    const highlightBtn = document.createElement('button');
    highlightBtn.type = 'button';
    highlightBtn.className = 'highlight-btn';
    highlightBtn.textContent = 'Show on model';
    highlightBtn.addEventListener('click', () => {
      if (highlightedPanel === panelKey){
        clearHighlight();
        highlightedPanel = null;
      } else {
        setHighlight(panelKey);
      }
      refreshHighlightButtons();
    });
    labelRow.appendChild(highlightBtn);

    wrapper.appendChild(labelRow);

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

  refreshHighlightButtons();
}

function refreshHighlightButtons(){
  previewPanelsEl.querySelectorAll('.panel-swatch').forEach(wrapper => {
    const key = wrapper.dataset.panel;
    const btn = wrapper.querySelector('.highlight-btn');
    if (!btn) return;
    if (highlightedPanel === key){
      btn.classList.add('active');
      btn.textContent = 'Hide highlight';
    } else {
      btn.classList.remove('active');
      btn.textContent = 'Show on model';
    }
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
  const service = serviceSel.value;
  const previewableServices = ['wrap', 'ppf', 'ppf-partial'];

  if (!sizeClass || !vehicleName || !previewableServices.includes(service)){
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
