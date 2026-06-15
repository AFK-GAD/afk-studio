/* =========================================================
   AFK STUDIO — BOOKING CALENDAR
========================================================= */

const calMonthLabel = document.getElementById('calMonthLabel');
const calDays = document.getElementById('calDays');
const calPrev = document.getElementById('calPrev');
const calNext = document.getElementById('calNext');
const slotsLabel = document.getElementById('slotsLabel');
const slotsGrid = document.getElementById('slotsGrid');

const bsVehicle = document.getElementById('bsVehicle');
const bsService = document.getElementById('bsService');
const bsPkg = document.getElementById('bsPkg');
const bsDate = document.getElementById('bsDate');
const bsTime = document.getElementById('bsTime');
const bsDuration = document.getElementById('bsDuration');
const bsTotal = document.getElementById('bsTotal');

const bfName = document.getElementById('bfName');
const bfPhone = document.getElementById('bfPhone');
const bfConfirm = document.getElementById('bfConfirm');
const bookingForm = document.getElementById('bookingForm');
const bookingConfirmation = document.getElementById('bookingConfirmation');
const bcRef = document.getElementById('bcRef');
const noQuoteHint = document.getElementById('noQuoteHint');

// Load quote details saved by quote.html (vehicle, service, total, duration, etc.)
const quoteState = loadQuoteState() || {
  vehicle: null,
  serviceLabel: null,
  pkgLabel: null,
  total: 0,
  durationHrs: 0
};

if (!quoteState.vehicle){
  noQuoteHint.style.display = 'block';
}

const today = new Date();
today.setHours(0,0,0,0);

let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = null; // Date object
let selectedSlot = null; // string e.g. "9:00 AM"

// Shop hours: 9am - 5pm, closed Sundays
const openHour = 9;
const closeHour = 17;
const slotIntervalHrs = 1;

// Deterministic pseudo-random "booked" slots so the same date always
// shows the same availability (no backend, but feels realistic).
function seededRandom(seed){
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dateKey(date){
  return date.getFullYear() * 10000 + (date.getMonth()+1) * 100 + date.getDate();
}

function getAllSlotsForDay(date){
  const slots = [];
  for (let h = openHour; h < closeHour; h += slotIntervalHrs){
    const period = h >= 12 ? 'PM' : 'AM';
    let displayHour = h % 12;
    if (displayHour === 0) displayHour = 12;
    slots.push({ hour: h, label: displayHour + ':00 ' + period });
  }
  return slots;
}

function isSlotBooked(date, hour){
  const seed = dateKey(date) * 31 + hour;
  return seededRandom(seed) < 0.3; // ~30% of slots pre-booked
}

function renderCalendar(){
  calMonthLabel.textContent = monthNames[viewMonth] + ' ' + viewYear;
  calDays.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  for (let i = 0; i < startWeekday; i++){
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    calDays.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++){
    const cellDate = new Date(viewYear, viewMonth, d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    const isPast = cellDate < today;
    const isSunday = cellDate.getDay() === 0;
    const isToday = cellDate.getTime() === today.getTime();

    if (isToday) cell.classList.add('today');

    if (isPast){
      cell.classList.add('past');
    } else if (isSunday){
      cell.classList.add('closed');
    } else {
      cell.classList.add('available');
      cell.addEventListener('click', () => selectDate(cellDate));
    }

    if (selectedDate && cellDate.getTime() === selectedDate.getTime()){
      cell.classList.add('selected');
    }

    calDays.appendChild(cell);
  }

  const isCurrentMonth = (viewYear === today.getFullYear() && viewMonth === today.getMonth());
  calPrev.disabled = isCurrentMonth;
}

function selectDate(date){
  selectedDate = date;
  selectedSlot = null;
  renderCalendar();
  renderSlots();
  updateBookingSummary();
}

function renderSlots(){
  slotsGrid.innerHTML = '';

  if (!selectedDate){
    slotsLabel.textContent = 'Select a date to see available times';
    return;
  }

  const dateStr = selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  slotsLabel.textContent = 'Available times — ' + dateStr;

  const allSlots = getAllSlotsForDay(selectedDate);
  let anyAvailable = false;

  allSlots.forEach(slot => {
    const booked = isSlotBooked(selectedDate, slot.hour);
    const btn = document.createElement('div');
    btn.className = 'slot-btn';
    btn.textContent = slot.label;

    if (booked){
      btn.classList.add('unavailable');
    } else {
      anyAvailable = true;
      if (selectedSlot === slot.label) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        selectedSlot = slot.label;
        renderSlots();
        updateBookingSummary();
      });
    }
    slotsGrid.appendChild(btn);
  });

  if (!anyAvailable){
    slotsLabel.textContent = 'No availability on ' + dateStr + ' — try another date';
  }
}

calPrev.addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 0){ viewMonth = 11; viewYear--; }
  renderCalendar();
});

calNext.addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 11){ viewMonth = 0; viewYear++; }
  renderCalendar();
});

function updateBookingSummary(){
  bsVehicle.textContent = quoteState.vehicle || '—';
  bsService.textContent = quoteState.serviceLabel || '—';
  bsPkg.textContent = quoteState.pkgLabel || '—';
  bsDate.textContent = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  bsTime.textContent = selectedSlot || '—';
  bsDuration.textContent = quoteState.durationHrs
    ? '~' + quoteState.durationHrs + ' hr' + (quoteState.durationHrs > 1 ? 's' : '')
    : '—';
  bsTotal.textContent = '$' + (quoteState.total || 0).toLocaleString();

  const ready = quoteState.vehicle && selectedDate && selectedSlot;
  bfConfirm.disabled = !ready;
  bfConfirm.textContent = ready ? 'Request Appointment' : 'Select a Vehicle, Date & Time';
}

bfConfirm.addEventListener('click', () => {
  if (bfConfirm.disabled) return;
  if (!bfName.value.trim() || !bfPhone.value.trim()){
    alert('Please enter your name and phone number.');
    return;
  }

  const ref = 'AFK-' + dateKey(selectedDate) + '-' + Math.floor(seededRandom(dateKey(selectedDate) + selectedDate.getHours()) * 9000 + 1000);

  bookingForm.style.display = 'none';
  bookingConfirmation.style.display = 'block';
  bcRef.textContent = 'Reference: ' + ref + ' — ' + (selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })) + ' at ' + selectedSlot;
});

renderCalendar();
renderSlots();
updateBookingSummary();
