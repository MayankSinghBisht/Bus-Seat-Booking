// --- Database Setup & Models ---
let users = JSON.parse(localStorage.getItem('bus_users')) || [];
let bookingQueue = JSON.parse(localStorage.getItem('bus_queue')) || [];
let loggedInUser = JSON.parse(localStorage.getItem('bus_loggedInUser')) || null;
let requestCounter = JSON.parse(localStorage.getItem('bus_reqCount')) || 1;

const routes = [
    { id: 1, name: "Uttarakhand Volvo AC", price: 650, seats: 40, time: "08:00 AM Daily", stops: ["Kashipur", "Moradabad", "Ghaziabad", "Delhi"] },
    { id: 2, name: "Himalayan Express", price: 800, seats: 35, time: "10:00 PM Daily", stops: ["Dehradun", "Haridwar", "Roorkee", "Meerut", "Delhi"] },
    { id: 3, name: "Maratha Sleeper", price: 1200, seats: 40, time: "09:30 AM Daily", stops: ["Mumbai", "Pune", "Satara", "Kolhapur"] },
    { id: 4, name: "Shatabdi Connect", price: 400, seats: 38, time: "06:00 AM Daily", stops: ["Jaipur", "Gurugram", "Delhi"] }
];

let pendingPaymentData = null;

function saveData() {
    localStorage.setItem('bus_users', JSON.stringify(users));
    localStorage.setItem('bus_queue', JSON.stringify(bookingQueue));
    localStorage.setItem('bus_loggedInUser', JSON.stringify(loggedInUser));
    localStorage.setItem('bus_reqCount', JSON.stringify(requestCounter));
}

// --- Navigation & Initialization ---
window.onload = () => {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById('journey-date').min = today;
    
    if (loggedInUser) {
        setupDashboard();
        showView('dashboard-view');
    } else {
        showView('login-view');
    }
};

function showView(viewId) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    const navLinks = document.getElementById('nav-links');
    const navPane = document.getElementById('nav-pane');

    if (viewId === 'dashboard-view' || viewId === 'payment-view') {
        navLinks.innerHTML = `<button onclick="logout()" class="nav-btn primary">Logout</button>`;
        navPane.style.display = 'block'; 
        if(viewId === 'dashboard-view') setupDashboard();
    } else {
        navLinks.innerHTML = `<button onclick="showView('login-view')" class="nav-btn">Login</button>
                              <button onclick="showView('register-view')" class="nav-btn primary">Register</button>`;
        navPane.style.display = 'none'; 
    }
}

function setupDashboard() {
    if (!loggedInUser) return;
    document.getElementById('user-display-name').innerText = loggedInUser.fullName;
    populateBoardingStops();
    renderUserTickets();
}

function logout() { 
    loggedInUser = null; 
    saveData(); 
    showView('login-view'); 
}

// --- Auth Logic ---
document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    if (users.find(u => u.email === email)) { alert("User already exists!"); return; }
    
    const newUser = {
        id: users.length + 1, 
        fullName: document.getElementById('reg-name').value, email: email,
        password: document.getElementById('reg-password').value,
        phone: document.getElementById('reg-phone').value, age: parseInt(document.getElementById('reg-age').value),
        hasDisability: document.getElementById('reg-disability').checked
    };
    users.push(newUser); saveData();
    alert("Registration successful! Please login."); e.target.reset(); showView('login-view');
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        loggedInUser = user; saveData(); e.target.reset(); showView('dashboard-view');
    } else {
        document.getElementById('login-msg').innerText = "Invalid email or password";
    }
});

// --- Smart Booking Flow ---
function populateBoardingStops() {
    let allStops = new Set();
    routes.forEach(r => r.stops.forEach(s => allStops.add(s)));
    
    let stopsHtml = '<option value="">Select Boarding City...</option>' + 
        Array.from(allStops).sort().map(s => `<option value="${s}">${s}</option>`).join('');
        
    document.getElementById('boarding-select').innerHTML = stopsHtml;
    document.getElementById('dropping-select').innerHTML = '<option value="">Select Boarding First...</option>';
}

document.getElementById('boarding-select').onchange = function() {
    const bStop = this.value;
    const droppingSelect = document.getElementById('dropping-select');
    
    if (!bStop) {
        droppingSelect.innerHTML = '<option value="">Select Boarding First...</option>';
        return;
    }

    let reachableStops = new Set();
    routes.forEach(route => {
        if (route.stops.includes(bStop)) {
            route.stops.forEach(s => { if (s !== bStop) reachableStops.add(s); });
        }
    });

    droppingSelect.innerHTML = '<option value="">Select Destination...</option>' + 
        Array.from(reachableStops).sort().map(s => `<option value="${s}">${s}</option>`).join('');
};

document.getElementById('book-ticket-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const bStop = document.getElementById('boarding-select').value;
    const dStop = document.getElementById('dropping-select').value;
    const jDate = document.getElementById('journey-date').value;
    const errorMsg = document.getElementById('route-error');
    errorMsg.innerText = "";

    let assignedRoute = null;
    for (let route of routes) {
        if (route.stops.includes(bStop) && route.stops.includes(dStop)) {
            assignedRoute = route; break; 
        }
    }

    if (!assignedRoute) { errorMsg.innerText = "System error allocating bus. Please try again."; return; }
    
    const takenSeats = bookingQueue.filter(b => b.routeId === assignedRoute.id && b.date === jDate && b.status === 'ALLOCATED');
    if (takenSeats.length >= assignedRoute.seats) {
        errorMsg.innerText = `Sorry, the bus is fully booked for ${jDate}.`; return; 
    }

    const existing = bookingQueue.find(b => b.userId === loggedInUser.id && b.routeId == assignedRoute.id && b.date === jDate && b.status === 'ALLOCATED');
    if (existing) { errorMsg.innerText = "You already have a valid ticket for this route on this date."; return; }

    pendingPaymentData = { route: assignedRoute, bStop, dStop, jDate };
    
    document.getElementById('payment-summary').innerHTML = `
        <div style="background: #e0f2fe; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <strong>🚌 Bus Assigned: ${assignedRoute.name}</strong>
        </div>
        <p>Journey: <strong>${bStop}</strong> ➔ <strong>${dStop}</strong></p>
        <p>Date: ${jDate} | Timing: ${assignedRoute.time}</p>
        <strong>Total Fare: ₹${assignedRoute.price}</strong>
    `;
    showView('payment-view');
});

// --- Instant Seat Allocation & Payment ---
document.getElementById('payment-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const takenSeats = bookingQueue
        .filter(r => r.routeId === pendingPaymentData.route.id && r.date === pendingPaymentData.jDate && r.status === 'ALLOCATED')
        .map(r => r.seatNumber);

    let availableSeats = [];
    for (let i = 1; i <= pendingPaymentData.route.seats; i++) { 
        if (!takenSeats.includes(i)) availableSeats.push(i); 
    }

    if(availableSeats.length === 0) {
        alert("Transaction Failed: The bus sold out while processing your payment.");
        showView('dashboard-view');
        return;
    }

    const assignedSeatNumber = availableSeats.shift(); 
    
    bookingQueue.push({
        id: requestCounter++, userId: loggedInUser.id, fullName: loggedInUser.fullName,
        routeId: pendingPaymentData.route.id, routeName: pendingPaymentData.route.name,
        routeTime: pendingPaymentData.route.time,
        boarding: pendingPaymentData.bStop, dropping: pendingPaymentData.dStop,
        date: pendingPaymentData.jDate, status: 'ALLOCATED', seatNumber: assignedSeatNumber, 
        timestamp: Date.now() 
    });

    saveData();
    pendingPaymentData = null; 
    e.target.reset();
    
    alert(`Payment Successful! Seat #${assignedSeatNumber} has been instantly reserved for you.`);
    showView('dashboard-view');
});

// --- Ticket Cancellation ---
window.cancelTicket = function(ticketId) {
    if(confirm("Are you sure you want to cancel this ticket? Your seat will be released immediately.")) {
        const ticketIndex = bookingQueue.findIndex(t => t.id === ticketId);
        if(ticketIndex > -1) {
            bookingQueue[ticketIndex].status = 'CANCELLED';
            bookingQueue[ticketIndex].seatNumber = null;
            saveData();
            alert("Ticket cancelled successfully. Refund initiated.");
            setupDashboard();
        }
    }
}

// --- Rendering Helpers ---
function renderUserTickets() {
    const listEl = document.getElementById('user-tickets-list');
    const myTickets = bookingQueue.filter(b => b.userId === loggedInUser.id);
    
    if (myTickets.length === 0) { 
        listEl.innerHTML = `
            <div style="background: #fff; padding: 40px; text-align: center; border-radius: 12px; border: 2px dashed #cbd5e1;">
                <p style="color:#64748b; font-size: 1.2em;">You have no booked journeys.</p>
            </div>`; 
        return; 
    }

    listEl.innerHTML = myTickets.reverse().map(t => {
        let statusClass = t.status === 'ALLOCATED' ? 'badge-allocated' : 'badge-cancelled';
        let seatText = t.seatNumber ? `Seat #${t.seatNumber}` : 'Cancelled';
        
        let cancelButtonHtml = t.status === 'ALLOCATED' 
            ? `<button class="btn-cancel" onclick="cancelTicket(${t.id})">Cancel Ticket</button>` 
            : '';

        return `
            <div class="passenger-card">
                <div class="p-details">
                    <strong style="${t.status === 'CANCELLED' ? 'color:#94a3b8;' : ''}">${t.routeName}</strong>
                    <span style="${t.status === 'CANCELLED' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">📅 ${t.date} | ⏰ ${t.routeTime}</span>
                    <span style="${t.status === 'CANCELLED' ? 'text-decoration: line-through; opacity: 0.6;' : ''}">📍 ${t.boarding} ➔ ${t.dropping}</span>
                </div>
                <div class="badges">
                    <span class="${statusClass}">${t.status}</span>
                    <span class="badge-seat" style="${t.status === 'CANCELLED' ? 'background: #f1f5f9; color: #94a3b8;' : ''}">${seatText}</span>
                    ${cancelButtonHtml}
                </div>
            </div>`;
    }).join('');
}