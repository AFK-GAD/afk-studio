/* =========================================================
   AFK STUDIO — SHARED DATA & UTILITIES
   Used across all pages
========================================================= */

// Service rates per sq ft
const rates = {
  wrap: 11.00,
  ppf: 16.50,
  'ppf-partial': 16.50,
  tint: 7.50,
  detail: 5.00
};

const serviceLabels = {
  wrap: 'Vinyl Wrap (full body)',
  ppf: 'PPF (full body)',
  'ppf-partial': 'PPF (front-end / high-impact)',
  tint: 'Window Tint (full vehicle)',
  detail: 'Detailing (full interior + exterior)'
};

const sizeLabels = {
  compact: 'Compact / Small Sedan',
  midsize: 'Mid-size Sedan / Coupe',
  suv: 'SUV / Crossover',
  truck: 'Truck / Large SUV'
};

// Coverage area multiplier for partial services
const coverageFactor = {
  wrap: 1,
  ppf: 1,
  'ppf-partial': 0.30,
  tint: 0.18,
  detail: 1
};

// Estimated duration in hours per service (affects slot length / availability)
const durationHours = {
  wrap: 8,
  ppf: 6,
  'ppf-partial': 3,
  tint: 1.5,
  detail: 3
};

// Named wrap/film colours available in the colour dropdowns
const wrapColors = [
  { name: 'Gloss Black', hex: '#0D0D0D' },
  { name: 'Satin Black', hex: '#1C1C1C' },
  { name: 'Matte Black', hex: '#2A2A2A' },
  { name: 'Gloss White', hex: '#F5F5F2' },
  { name: 'Satin Pearl White', hex: '#EDEAE3' },
  { name: 'AFK Signature Vermilion', hex: '#FF4D1C' },
  { name: 'Matte Burnt Orange', hex: '#C5481E' },
  { name: 'Gloss Racing Red', hex: '#C8102E' },
  { name: 'Satin Steel Grey', hex: '#6E6E6E' },
  { name: 'Gunmetal Grey', hex: '#3A352F' },
  { name: 'Gloss Deep Blue', hex: '#1E3A5F' },
  { name: 'Satin Sky Blue', hex: '#6FA8C9' },
  { name: 'Gloss British Racing Green', hex: '#1C3D2E' },
  { name: 'Satin Lime Green', hex: '#A6CE39' },
  { name: 'Gloss Champagne Gold', hex: '#C9A876' },
  { name: 'Matte Bronze', hex: '#8A6D3B' },
  { name: 'Chrome Silver', hex: '#C8C9CB' },
  { name: 'Carbon Fibre Texture', hex: '#1A1A1E' }
];

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ===== Scroll reveal (used on most pages) ===== */
function initScrollReveal(){
  const revealEls = document.querySelectorAll('.reveal');
  if (!revealEls.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => observer.observe(el));
}

/* ===== Nav active state ===== */
function setActiveNav(pageId){
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.dataset.page === pageId) a.classList.add('active');
  });
}

/* =========================================================
   QUOTE STATE PERSISTENCE
   Used to pass the calculator result + 3D wrap colours
   from quote.html to booking.html via localStorage.
========================================================= */
const QUOTE_STORAGE_KEY = 'afkQuoteState';

function saveQuoteState(state){
  try {
    localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // localStorage unavailable — booking page will just show defaults
  }
}

function loadQuoteState(){
  try {
    const raw = localStorage.getItem(QUOTE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/* ===== Mobile nav toggle ===== */
function initNavToggle(){
  const toggle = document.getElementById('navToggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Close menu when a link is tapped
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.addEventListener('DOMContentLoaded', initScrollReveal);
document.addEventListener('DOMContentLoaded', initNavToggle);
