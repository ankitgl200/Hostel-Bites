// Hostel Bites Client Application Core

// --- Application State ---
const state = {
  user: JSON.parse(localStorage.getItem('hb_user')) || null,
  token: localStorage.getItem('hb_token') || '',
  cart: JSON.parse(localStorage.getItem('hb_cart')) || [],
  shop: { isOpen: true, reason: '', openHour: 8, closeHour: 23 },
  menu: [],
  activeCategory: 'All',
  searchQuery: '',
  redeemRewardsChecked: false,
  adminActiveTab: 'orders'
};

// --- Theme Handling System ---
function initTheme() {
  const currentTheme = localStorage.getItem('hb_theme') || 'light';
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  updateThemeToggleButton();
}

function updateThemeToggleButton() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark-mode');
  btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('hb_theme', isDark ? 'dark' : 'light');
  updateThemeToggleButton();
}

// --- API Router Utility ---
const BACKEND_URL = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.hostname === '[::1]' || 
                    window.location.hostname === ''
  ? 'http://localhost:5000'
  : 'https://backendnewhb.onrender.com'; // REPLACE with your actual Render backend URL

async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const config = {
    method,
    headers
  };
  
  if (body) {
    config.body = JSON.stringify(body);
  }

  const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  // Strip trailing slash from BACKEND_URL if present to prevent double slashes (e.g. //api)
  const cleanBackendUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const targetUrl = isAbsolute ? endpoint : `${cleanBackendUrl}${endpoint}`;

  try {
    const response = await fetch(targetUrl, config);
    if (response.status === 401) {
      // Clear credentials on invalid token
      logout();
      showToast('Session expired. Please log in.', 'error');
      navigate('#/login');
      return { success: false, message: 'Unauthorized' };
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Unable to connect to the server.' };
  }
}

// --- Toast Notification System ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- Auth Manager ---
function login(userData, token) {
  state.user = userData;
  state.token = token;
  localStorage.setItem('hb_user', JSON.stringify(userData));
  localStorage.setItem('hb_token', token);
  
  updateAuthNavbar();
  showToast(`Welcome back, ${userData.name}!`, 'success');
  checkUnnotifiedAdminRewards();
}

function logout() {
  state.user = null;
  state.token = '';
  state.cart = [];
  state.redeemRewardsChecked = false;
  localStorage.removeItem('hb_user');
  localStorage.removeItem('hb_token');
  localStorage.removeItem('hb_cart');
  
  updateAuthNavbar();
  showToast('Logged out successfully.', 'info');
  navigate('#/home');
}

async function checkUnnotifiedAdminRewards() {
  if (state.token && state.user) {
    const resCards = await apiCall('/api/rewards/my-cards');
    if (resCards.success) {
      const cards = resCards.data;
      const unnotifiedAdminCard = cards.find(card => !card.order && !card.isScratched && !card.adminAwardNotified);
      if (unnotifiedAdminCard) {
        showAdminAwardNotification(unnotifiedAdminCard);
      }
    }
  }
}

function showAdminAwardNotification(card) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Prevent duplicate notifications
  if (document.getElementById(`notif-award-${card._id}`)) return;

  const notif = document.createElement('div');
  notif.id = `notif-award-${card._id}`;
  notif.className = 'toast success clickable-notif';
  notif.style.cursor = 'pointer';
  notif.style.border = '2px solid #ffd700';
  notif.style.animation = 'slideIn 0.3s ease-out forwards';
  notif.style.display = 'flex';
  notif.style.alignItems = 'center';
  notif.style.justifyContent = 'space-between';
  notif.style.width = '100%';
  notif.style.maxWidth = '350px';

  notif.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
      <i class="fa-solid fa-gift" style="color: #ffd700; font-size: 22px; animation: bounce-gift 1.2s infinite;"></i>
      <div style="flex-grow: 1; text-align: left;">
        <strong style="display: block; font-size: 13px; color: var(--text-main);">Admin Award Received!</strong>
        <span style="font-size: 11px; color: var(--text-muted); display: block; line-height: 1.3;">You received a new scratch card from the admin. Click to scratch!</span>
      </div>
      <button class="notif-close-btn" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 20px; font-weight: bold; padding: 0 6px; line-height: 1;">&times;</button>
    </div>
  `;

  // Close button listener
  const closeBtn = notif.querySelector('.notif-close-btn');
  closeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    notif.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => notif.remove(), 300);
    await apiCall(`/api/rewards/mark-notified/${card._id}`, 'PUT');
  });

  // Tap notification to redirect and highlight card
  notif.addEventListener('click', async () => {
    await apiCall(`/api/rewards/mark-notified/${card._id}`, 'PUT');
    state.rewardedScratchCardId = card._id;
    notif.style.animation = 'slideIn 0.3s reverse forwards';
    setTimeout(() => notif.remove(), 300);
    navigate('#/rewards');
  });

  container.appendChild(notif);
  playNotificationSound();
}

async function fetchUserProfile() {
  if (!state.token) return;
  const res = await apiCall('/api/auth/me');
  if (res.success) {
    state.user = res.data;
    localStorage.setItem('hb_user', JSON.stringify(res.data));
    updateAuthNavbar();
    checkUnnotifiedAdminRewards();
  }
}

async function rechargePoints(amount) {
  if (!state.token) {
    showToast('Please log in to recharge points.', 'error');
    navigate('#/login');
    return;
  }
  const res = await apiCall('/api/auth/recharge', 'POST', { amount });
  if (res.success) {
    state.user.rewards = res.data.rewards;
    localStorage.setItem('hb_user', JSON.stringify(state.user));
    updateAuthNavbar();
    showToast(res.message, 'success');
    renderCurrentView();
  } else {
    showToast(res.message || 'Recharge failed.', 'error');
  }
}

// --- Shop Status Checker ---
async function checkShopStatus() {
  const res = await apiCall('/api/shop/status');
  if (res.success) {
    state.shop = res.data;
    updateShopUI();
  }
}

function updateShopUI() {
  const badge = document.getElementById('shop-badge');
  const banner = document.getElementById('shop-closed-banner');
  const bannerText = document.getElementById('shop-banner-text');

  if (!badge) return;

  badge.className = 'shop-badge-status';
  if (state.shop.isOpen) {
    badge.classList.add('open');
    badge.innerHTML = `<span class="dot"></span> <span class="text">Open Now</span>`;
    if (banner) banner.classList.add('hidden');
  } else {
    badge.classList.add('closed');
    badge.innerHTML = `<span class="dot"></span> <span class="text">Store Closed</span>`;
    
    // Check if user is admin
    const isAdmin = state.user && state.user.role === 'admin';
    if (!isAdmin) {
      if (banner) {
        banner.classList.remove('hidden');
        bannerText.textContent = state.shop.reason;
      }
    } else {
      if (banner) banner.classList.add('hidden');
    }
  }
}

// --- Cart Manager ---
function getCartCount() {
  return state.cart.reduce((total, item) => total + item.quantity, 0);
}

function updateCartCounter() {
  const counter = document.getElementById('cart-counter');
  if (counter) {
    counter.textContent = getCartCount();
  }
}

function saveCart() {
  localStorage.setItem('hb_cart', JSON.stringify(state.cart));
  updateCartCounter();
}

// --- Inline DOM Sync for Menu Cards ---
function syncMenuCardDOM(itemId) {
  const badge = document.querySelector(`[data-stock-id="${itemId}"]`);
  const card = badge ? badge.closest('.menu-card') : null;
  if (!card) return;

  const item = state.menu.find(m => m._id === itemId);
  if (!item) return;

  const cartItem = state.cart.find(ci => ci._id === itemId);
  const quantityInCart = cartItem ? cartItem.quantity : 0;
  const isItemSoldOut = !item.isAvailable || item.stock <= 0;

  // Update stock badge
  if (badge) {
    badge.className = `item-stock-badge ${item.stock === 0 ? 'out-of-stock' : item.stock <= 10 ? 'low-stock' : 'normal-stock'}`;
    badge.innerHTML = `
      <i class="fa-solid ${item.stock === 0 ? 'fa-triangle-exclamation' : 'fa-boxes-stacked'}"></i>
      <span>${item.stock === 0 ? 'Out of stock' : item.stock <= 10 ? `Only ${item.stock} left` : `${item.stock} in stock`}</span>
    `;
  }

  // Update card class
  if (isItemSoldOut) {
    card.classList.add('unavailable');
  } else {
    card.classList.remove('unavailable');
  }

  // Update card footer controls
  const footer = card.querySelector('.menu-card-footer');
  if (footer) {
    if (isItemSoldOut) {
      footer.innerHTML = `
        <span class="menu-item-price">Rs. ${item.price}</span>
        <button class="btn btn-secondary btn-sm" disabled>Sold Out</button>
      `;
    } else if (quantityInCart > 0) {
      footer.innerHTML = `
        <span class="menu-item-price">Rs. ${item.price}</span>
        <div class="qty-selector">
          <button class="qty-btn dec-qty" data-id="${item._id}">-</button>
          <span class="qty-val">${quantityInCart}</span>
          <button class="qty-btn inc-qty" data-id="${item._id}">+</button>
        </div>
      `;
    } else {
      footer.innerHTML = `
        <span class="menu-item-price">Rs. ${item.price}</span>
        <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${item._id}"><i class="fa-solid fa-plus"></i> Add</button>
      `;
    }

    // Re-bind events in the updated footer
    const addBtn = footer.querySelector('.add-to-cart-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => addToCart(item));
    }
    const incBtn = footer.querySelector('.inc-qty');
    if (incBtn) {
      incBtn.addEventListener('click', () => updateCartQty(itemId, 1));
    }
    const decBtn = footer.querySelector('.dec-qty');
    if (decBtn) {
      decBtn.addEventListener('click', () => updateCartQty(itemId, -1));
    }
  }
}

function addToCart(menuItem, quantity = 1) {
  // Validate shop status first (Admins can place anytime)
  if (!state.shop.isOpen && (!state.user || state.user.role !== 'admin')) {
    showToast('Shop is closed! Cannot add items to cart.', 'error');
    navigate('#/shop-closed');
    return;
  }

  const freshItem = state.menu.find(m => m._id === menuItem._id) || menuItem;
  const existingItemIndex = state.cart.findIndex(item => item._id === menuItem._id);
  const currentCartQty = existingItemIndex > -1 ? state.cart[existingItemIndex].quantity : 0;

  if (freshItem.stock < currentCartQty + quantity) {
    showToast(`Cannot add ${menuItem.name}. Exceeds available stock (Only ${freshItem.stock} left).`, 'error');
    return;
  }

  if (existingItemIndex > -1) {
    state.cart[existingItemIndex].quantity += quantity;
  } else {
    state.cart.push({
      _id: menuItem._id,
      name: menuItem.name,
      price: menuItem.price,
      image: menuItem.image,
      category: menuItem.category,
      quantity: quantity
    });
  }
  
  saveCart();
  showToast(`${menuItem.name} added to cart!`, 'success');

  const hash = window.location.hash || '#/home';
  if (hash === '#/menu') {
    syncMenuCardDOM(menuItem._id);
  } else {
    renderCurrentView();
  }
}

function updateCartQty(itemId, change) {
  const itemIndex = state.cart.findIndex(item => item._id === itemId);
  if (itemIndex > -1) {
    const freshItem = state.menu.find(m => m._id === itemId);
    const newQty = state.cart[itemIndex].quantity + change;

    if (change > 0 && freshItem && freshItem.stock < newQty) {
      showToast(`Cannot add more. Only ${freshItem.stock} items left in stock.`, 'error');
      return;
    }

    state.cart[itemIndex].quantity = newQty;
    
    if (state.cart[itemIndex].quantity <= 0) {
      state.cart.splice(itemIndex, 1);
    }
    
    saveCart();

    const hash = window.location.hash || '#/home';
    if (hash === '#/menu') {
      syncMenuCardDOM(itemId);
    } else {
      renderCurrentView();
    }
  }
}

function removeFromCart(itemId) {
  state.cart = state.cart.filter(item => item._id !== itemId);
  saveCart();
  
  const hash = window.location.hash || '#/home';
  if (hash === '#/menu') {
    syncMenuCardDOM(itemId);
  } else {
    renderCurrentView();
  }
  showToast('Item removed from cart.', 'info');
}

// --- Navigation Router ---
function navigate(hash) {
  window.location.hash = hash;
}

function updateAuthNavbar() {
  const authActions = document.getElementById('auth-actions');
  const userMenu = document.getElementById('user-profile-menu');
  const avatarChar = document.getElementById('avatar-char');
  const usernameSpan = document.getElementById('navbar-username');
  const dropdownName = document.getElementById('dropdown-name');
  const dropdownPhone = document.getElementById('dropdown-phone');
  const dropdownPoints = document.getElementById('dropdown-points');
  
  const adminLinks = document.querySelectorAll('.admin-only');
  const userOnlyLinks = document.querySelectorAll('.user-only');

  if (state.user) {
    if (authActions) authActions.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (avatarChar) avatarChar.textContent = state.user.name.charAt(0).toUpperCase();
    if (usernameSpan) usernameSpan.textContent = state.user.name.split(' ')[0];
    if (dropdownName) dropdownName.textContent = state.user.name;
    if (dropdownPhone) dropdownPhone.textContent = state.user.phone;
    if (dropdownPoints) dropdownPoints.textContent = state.user.rewards || 0;

    userOnlyLinks.forEach(el => el.classList.remove('hidden'));

    // Toggle admin dashboards visibility
    if (state.user.role === 'admin') {
      adminLinks.forEach(el => el.classList.remove('hidden'));
    } else {
      adminLinks.forEach(el => el.classList.add('hidden'));
    }
  } else {
    if (authActions) authActions.classList.remove('hidden');
    if (userMenu) userMenu.classList.add('hidden');
    adminLinks.forEach(el => el.classList.add('hidden'));
    userOnlyLinks.forEach(el => el.classList.add('hidden'));
  }
}

// Map of route handlers
const routes = {
  '#/home': renderHome,
  '#/menu': renderMenu,
  '#/request-product': renderRequestProduct,
  '#/cart': renderCart,
  '#/checkout': renderCheckout,
  '#/orders': renderOrders,
  '#/rewards': renderRewards,
  '#/about': renderAbout,
  '#/admin': renderAdmin,
  '#/login': renderLogin,
  '#/shop-closed': renderShopClosed,
  '#/change-password': renderChangePassword
};

function handleRouting() {
  // Check shop status on routing
  checkShopStatus();
  
  const hash = window.location.hash || '#/home';
  
  // Update nav link active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  const matchedNavLink = document.querySelector(`.nav-link[href="${hash}"]`);
  if (matchedNavLink) {
    matchedNavLink.classList.add('active');
  }

  // Close mobile drawer on route
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');

  const handler = routes[hash] || renderHome;
  
  // Guard check: closed shop redirection for customers
  if (!state.shop.isOpen && hash !== '#/shop-closed' && hash !== '#/login' && hash !== '#/home' && hash !== '#/admin') {
    const isAdmin = state.user && state.user.role === 'admin';
    if (!isAdmin) {
      navigate('#/shop-closed');
      return;
    }
  }

  handler();
}

function renderCurrentView() {
  const hash = window.location.hash || '#/home';
  const handler = routes[hash] || renderHome;
  handler();
}

// --- Dynamic View Templates ---

// 1. HOME VIEW
function renderHome() {
  const content = document.getElementById('app-content');
  content.innerHTML = `
    <div class="container page-view">
      <section class="hero-section">
        <div class="hero-text">
          <h1>Snacks, Delivered to your <span>Hostel Room</span></h1>
          <p>Ditch the boring food! Enjoy Fast and secure delivery of snacks right to your room.</p>
          <div class="hero-cta">
            <a href="#/menu" class="btn btn-primary"><i class="fa-solid fa-pizza-slice"></i> Browse Menu</a>
            <a href="#/rewards" class="btn btn-secondary"><i class="fa-solid fa-gift"></i> Rewards Perks</a>
          </div>
        </div>
        <div class="hero-image-wrapper">
          <div class="hero-image-card">
            <img src="hostelbites_wbg.png" alt="Delicious burger and fries">
          </div>
          <div class="hero-badge-points">
            <i class="fa-solid fa-gift"></i>
            <div>
              <strong>Scratch Cards</strong>
              <span>Win rewards on every order</span>
            </div>
          </div>
        </div>
      </section>

      <section class="home-features">
        <div class="section-header">
          <h2>Why Order from Hostel Bites?</h2>
          <p>We solve the midnight hunger pangs with high quality Products.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="fa-solid fa-bolt"></i></div>
            <h3>Lightning Fast Delivery</h3>
            <p>Direct room delivery within 7 minutes inside the Hostel boundary.</p>
          </div>
          <div class="feature-card accent-card">
            <div class="feature-icon"><i class="fa-solid fa-gift"></i></div>
            <h3>Scratch Cards System</h3>
            <p>Get a scratch card on every single order. Scratch to win cash discounts or free items!</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fa-solid fa-clock"></i></div>
            <h3>Late Night Operations</h3>
            <p>Operational from 8PM to 12AM  Daily.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

// 2. SHOP CLOSED VIEW
function renderShopClosed() {
  const content = document.getElementById('app-content');
  
  // Format times nicely
  const formatHour = (hour) => {
    if (hour === 0 || hour === 24) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  content.innerHTML = `
    <div class="container page-view">
      <div class="closed-page">
        <div class="closed-icon"><i class="fa-solid fa-store-slash"></i></div>
        <h1>Store is Closed</h1>
        <p>${state.shop.reason || 'We are currently offline. Our Store staff is resting.'}</p>
        
        <div class="operating-hours-box">
          <h3>Customer Ordering Hours</h3>
          <p>${formatHour(state.shop.openHour)} to ${formatHour(state.shop.closeHour)} Daily</p>
        </div>

        <div class="closed-cta">
          <a href="#/home" class="btn btn-secondary">Return Home</a>
          ${state.user && state.user.role === 'admin' ? '<a href="#/admin" class="btn btn-primary">Open via Admin Panel</a>' : ''}
        </div>
      </div>
    </div>
  `;
}

// 2.2 REQUEST PRODUCT VIEW
async function renderRequestProduct() {
  const content = document.getElementById('app-content');

  if (!state.user) {
    content.innerHTML = `
      <div class="container page-view">
        <div class="empty-cart-state" style="padding: 40px 20px;">
          <i class="fa-solid fa-user-lock" style="font-size: 48px; color: var(--primary-color); margin-bottom: 16px;"></i>
          <h3>Authentication Required</h3>
          <p>You must login first to request new food products to your hostel floor.</p>
          <a href="#/login" class="btn btn-primary" style="margin-top: 10px;">Login to Request</a>
        </div>
      </div>
    `;
    return;
  }

  const defaultName = state.user.name || '';
  const defaultPhone = state.user.phone || '';
  const defaultRoom = state.user.roomNo || '';
  const defaultBlock = state.user.hostelBlock || '';
  
  const roomAndBlockStr = defaultRoom && defaultBlock ? `Room ${defaultRoom}, Block ${defaultBlock}` : '';

  // Show loading spinner while fetching request history
  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading request page...</p>
      </div>
    </div>
  `;

  const requestsRes = await apiCall('/api/requests/my-requests');
  const userRequests = requestsRes.success ? requestsRes.data : [];

  renderPageHTML(userRequests);

  function renderPageHTML(requestsList) {
    const requestsHtml = requestsList.length === 0 
      ? `
        <div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 14px; background: var(--bg-light); border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">
          <i class="fa-solid fa-clipboard-list" style="font-size: 28px; margin-bottom: 10px; display: block; color: var(--text-muted); opacity: 0.5;"></i>
          You have not placed any product requests yet.
        </div>
      `
      : `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${requestsList.map(req => {
            const date = new Date(req.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            let statusClass = 'status-pending';
            if (req.status === 'Reviewed') statusClass = 'status-reviewed';
            if (req.status === 'Added') statusClass = 'status-added';
            if (req.status === 'Rejected') statusClass = 'status-rejected';

            return `
              <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;"><i class="fa-regular fa-clock"></i> ${date}</span>
                  <span class="scratch-card-status ${statusClass}" style="font-size: 11px; font-weight: 700; border-radius: 50px; padding: 4px 10px;">${req.status}</span>
                </div>
                <div style="font-size: 14px; color: var(--text-main); line-height: 1.5; font-weight: 500; white-space: pre-wrap;">${req.requestText}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

    content.innerHTML = `
      <div class="container page-view" style="max-width: 600px; padding-bottom: 60px;">
        <div class="auth-card" style="margin: 40px auto 30px auto; padding: 30px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
          <h1 class="cart-title" style="margin-bottom: 8px; font-size: 24px; text-align: center;"><i class="fa-solid fa-clipboard-question"></i> Request a Product</h1>
          <p style="text-align: center; color: var(--text-muted); margin-bottom: 24px; font-size: 13px;">Can't find your favorite snacks? Request them here, and the Hostel Bites team will try to source and add them to our menu.</p>
          
          <form id="product-request-form">
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="req-name">Your Name</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-user"></i>
                <input type="text" id="req-name" value="${defaultName}" placeholder="e.g. John Doe" required style="width: 100%; padding-left: 36px;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label for="req-phone">Phone Number</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-phone"></i>
                <input type="tel" id="req-phone" value="${defaultPhone}" placeholder="e.g. 9876543210" required style="width: 100%; padding-left: 36px;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label for="req-room">Room / Block Address</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-location-dot"></i>
                <input type="text" id="req-room" value="${roomAndBlockStr}" placeholder="e.g. Room 15, Block X" required style="width: 100%; padding-left: 36px;">
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label for="req-text">What would you like us to add?</label>
              <textarea id="req-text" placeholder="e.g. Please add Oreo milkshakes, spicy peri peri fries, or instant ramen..." required style="width: 100%; height: 120px; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-light); color: var(--text-main); font-family: inherit; font-size: 14px; line-height: 1.5; resize: none;"></textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="req-submit-btn">
              <i class="fa-solid fa-paper-plane"></i> Submit Request
            </button>
          </form>
        </div>

        <!-- Placed Requests Section -->
        <div class="my-requests-section" style="margin-top: 40px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--secondary-color); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-history" style="color: var(--primary-color);"></i> My Placed Requests
          </h2>
          ${requestsHtml}
        </div>
      </div>
    `;

    // Bind Submit Event
    const form = document.getElementById('product-request-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('req-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin: 0;"></div> Submitting...';

      const name = document.getElementById('req-name').value.trim();
      const phone = document.getElementById('req-phone').value.trim();
      const roomNo = document.getElementById('req-room').value.trim();
      const requestText = document.getElementById('req-text').value.trim();

      const res = await apiCall('/api/requests', 'POST', { name, phone, roomNo, requestText });
      
      if (res.success) {
        showToast(res.message, 'success');
        
        // Dynamically refetch and re-render the list
        const updatedRequestsRes = await apiCall('/api/requests/my-requests');
        const updatedRequests = updatedRequestsRes.success ? updatedRequestsRes.data : [];
        renderPageHTML(updatedRequests);
      } else {
        showToast(res.message || 'Submission failed.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
      }
    });
  }
}

// 2.3 ABOUT VIEW
async function renderAbout() {
  const content = document.getElementById('app-content');

  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading details...</p>
      </div>
    </div>
  `;

  const res = await apiCall('/api/team');
  const team = res.success ? res.data : [];

  content.innerHTML = `
    <div class="container page-view">
      <!-- Story Section -->
      <section class="about-hero-section" style="text-align: center; padding: 40px 20px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <h1 style="color: var(--primary-color); font-size: 36px; font-weight: 800; margin-bottom: 16px;"><i class="fa-solid fa-utensils"></i> About Hostel Bites</h1>
        <p style="font-size: 16px; line-height: 1.6; max-width: 800px; margin: 0 auto 20px auto; color: var(--text-main);">
          Founded with a simple mission: **to combat late-night hunger in hostel dorm rooms**, Hostel Bites delivers fresh, piping-hot meals, beverages, and desserts directly to your block lobby or floor gates.
        </p>
        <p style="font-size: 14px; line-height: 1.6; max-width: 800px; margin: 0 auto; color: var(--text-muted);">
          No more boring mess food or expensive delivery fees from outside campus. We operate localized campus kitchens to serve you delicious comfort foods within 20 minutes of cooking approval. Fuel your late-night coding sessions, exam prep, and hostel gaming matches!
        </p>
      </section>

      <!-- Features Section -->
      <section class="home-features" style="margin-bottom: 40px; padding: 0;">
        <div class="section-header">
          <h2>Our Core Values</h2>
          <p>How we strive to build the ultimate campus ordering experience.</p>
        </div>
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon"><i class="fa-solid fa-kitchen-set"></i></div>
            <h3>Hygienic Preparation</h3>
            <p>Prepared instantly using premium quality fresh ingredients in a localized kitchen.</p>
          </div>
          <div class="feature-card accent-card">
            <div class="feature-icon"><i class="fa-solid fa-truck-ramp-box"></i></div>
            <h3>Free Gate Delivery</h3>
            <p>Every single order is delivered directly to your hostel block elevator or gate free of charge.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><i class="fa-solid fa-indian-rupee-sign"></i></div>
            <h3>Pocket Friendly</h3>
            <p>Super-economical pricing tailored to student budgets, with secure Cash on Delivery (COD).</p>
          </div>
        </div>
      </section>

      <!-- Team Section -->
      <section class="about-team-section">
        <div class="section-header">
          <h2>Meet Our Team</h2>
          <p>The students and foodies behind Hostel Bites.</p>
        </div>

        ${team.length === 0 ? `
          <div style="text-align: center; padding: 30px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <p style="color: var(--text-muted); margin: 0;">No team members added yet.</p>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;">
            ${team.map(member => `
              <div class="team-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 24px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background-color: var(--primary-light-color); color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; border: 2px solid var(--primary-color); box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                  <i class="fa-solid fa-user"></i>
                </div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px; color: var(--text-main);">${member.name}</h3>
                ${member.role ? `<h4 style="font-size: 13px; font-weight: 600; color: var(--primary-color); margin-bottom: 12px; letter-spacing: 0.5px; text-transform: uppercase;">${member.role}</h4>` : ''}
                ${member.bio ? `<p style="font-size: 13px; line-height: 1.5; color: var(--text-muted); margin: 0; text-align: center; font-style: italic;">"${member.bio}"</p>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </section>
    </div>
  `;
}

// 2B. CHANGE PASSWORD VIEW
async function renderChangePassword() {
  const content = document.getElementById('app-content');

  if (!state.user) {
    navigate('#/login');
    return;
  }

  content.innerHTML = `
    <div class="password-card-container">
      <div class="password-card">
        <div class="password-header">
          <div class="icon-container">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <h2>Change Password</h2>
          <p>Update your credentials to keep your account secure</p>
        </div>
        <div class="password-body">
          <form id="change-password-form" novalidate>
            <!-- Current Password -->
            <div class="form-group">
              <label for="current-password">Current Password</label>
              <div class="input-wrapper password-input-container">
                <i class="fa-solid fa-lock"></i>
                <input type="password" id="current-password" placeholder="Enter current password" required>
                <i class="fa-solid fa-eye password-toggle-btn" id="toggle-current-pass"></i>
              </div>
            </div>
            
            <!-- New Password -->
            <div class="form-group" style="margin-top: 20px;">
              <label for="new-password">New Password</label>
              <div class="input-wrapper password-input-container">
                <i class="fa-solid fa-key"></i>
                <input type="password" id="new-password" placeholder="Enter new password (min. 5 chars)" required>
                <i class="fa-solid fa-eye password-toggle-btn" id="toggle-new-pass"></i>
              </div>
              
              <!-- Strength Meter -->
              <div class="strength-meter">
                <div class="strength-bar-bg">
                  <div class="strength-bar-fill" id="strength-bar"></div>
                </div>
                <div class="strength-text">
                  <span>Strength: <span id="strength-label">None</span></span>
                  <span id="strength-percent">0%</span>
                </div>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="form-group" style="margin-top: 10px;">
              <label for="confirm-new-password">Confirm New Password</label>
              <div class="input-wrapper password-input-container">
                <i class="fa-solid fa-circle-check"></i>
                <input type="password" id="confirm-new-password" placeholder="Re-type new password" required>
                <i class="fa-solid fa-eye password-toggle-btn" id="toggle-confirm-pass"></i>
              </div>
            </div>

            <!-- Requirements Checklist -->
            <div class="password-rules">
              <h4>Security Guidelines</h4>
              <div class="rule-item" id="rule-length">
                <i class="fa-solid fa-circle"></i>
                <span>Minimum 5 characters</span>
              </div>
              <div class="rule-item" id="rule-number">
                <i class="fa-solid fa-circle"></i>
                <span>Contains a number or symbol</span>
              </div>
              <div class="rule-item" id="rule-match">
                <i class="fa-solid fa-circle"></i>
                <span>Passwords match</span>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-password-submit" style="margin-top: 24px;">
              <i class="fa-solid fa-arrows-rotate" style="margin-right: 8px;"></i> Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Visibility togglers
  const setupToggle = (btnId, inputId) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    btn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        btn.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        btn.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  };

  setupToggle('toggle-current-pass', 'current-password');
  setupToggle('toggle-new-pass', 'new-password');
  setupToggle('toggle-confirm-pass', 'confirm-new-password');

  const newPassInput = document.getElementById('new-password');
  const confirmPassInput = document.getElementById('confirm-new-password');

  const ruleLength = document.getElementById('rule-length');
  const ruleNumber = document.getElementById('rule-number');
  const ruleMatch = document.getElementById('rule-match');

  const strengthBar = document.getElementById('strength-bar');
  const strengthLabel = document.getElementById('strength-label');
  const strengthPercent = document.getElementById('strength-percent');

  // Password checkers
  const evaluatePassword = () => {
    const val = newPassInput.value;
    const confirmVal = confirmPassInput.value;

    let score = 0;
    
    // Rule 1: Length >= 5
    const hasLength = val.length >= 5;
    if (hasLength) {
      score += 1;
      ruleLength.classList.add('valid');
      ruleLength.querySelector('i').className = 'fa-solid fa-circle-check';
    } else {
      ruleLength.classList.remove('valid');
      ruleLength.querySelector('i').className = 'fa-solid fa-circle';
    }

    // Rule 2: Numbers or special character
    const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(val);
    if (hasNumberOrSpecial) {
      score += 1;
      ruleNumber.classList.add('valid');
      ruleNumber.querySelector('i').className = 'fa-solid fa-circle-check';
    } else {
      ruleNumber.classList.remove('valid');
      ruleNumber.querySelector('i').className = 'fa-solid fa-circle';
    }

    // Rule 3: Upper & lowercase mix (bonus strength)
    const hasMixedCase = /[a-z]/.test(val) && /[A-Z]/.test(val);
    if (hasMixedCase && val.length > 0) {
      score += 1;
    }

    // Rule 4: Match
    const matches = val === confirmVal && val.length > 0;
    if (matches) {
      ruleMatch.classList.add('valid');
      ruleMatch.querySelector('i').className = 'fa-solid fa-circle-check';
    } else {
      ruleMatch.classList.remove('valid');
      ruleMatch.querySelector('i').className = 'fa-solid fa-circle';
    }

    // Update Strength Meter
    let percent = 0;
    let label = 'None';
    let color = 'var(--border-color)';

    if (val.length > 0) {
      if (score === 1) {
        percent = 33;
        label = 'Weak';
        color = 'var(--danger-color)';
      } else if (score === 2) {
        percent = 66;
        label = 'Medium';
        color = 'var(--warning-color)';
      } else if (score >= 3) {
        percent = 100;
        label = 'Strong';
        color = 'var(--success-color)';
      }
    }

    strengthBar.style.width = `${percent}%`;
    strengthBar.style.backgroundColor = color;
    strengthLabel.textContent = label;
    strengthLabel.style.color = val.length > 0 ? color : 'var(--text-muted)';
    strengthPercent.textContent = `${percent}%`;
  };

  newPassInput.addEventListener('input', evaluatePassword);
  confirmPassInput.addEventListener('input', evaluatePassword);

  const form = document.getElementById('change-password-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = newPassInput.value;
    const confirmNewPassword = confirmPassInput.value;

    if (newPassword.length < 5) {
      showToast('New password must be at least 5 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Updating...';

    const res = await apiCall('/api/auth/change-password', 'PUT', { currentPassword, newPassword });

    if (res.success) {
      showToast(res.message, 'success');
      navigate('#/home');
    } else {
      showToast(res.message || 'Failed to update password.', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate" style="margin-right: 8px;"></i> Update Password';
    }
  });
}

// 3. MENU VIEW
async function renderMenu() {
  const content = document.getElementById('app-content');
  
  // Render skeleton loading
  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading hot menu items...</p>
      </div>
    </div>
  `;

  const res = await apiCall('/api/menu');
  if (!res.success) {
    content.innerHTML = `<div class="container page-view"><p class="text-danger">Failed to load menu: ${res.message}</p></div>`;
    return;
  }
  
  state.menu = res.data;

  // Filter menu items by category
  let filteredMenu = state.menu;
  if (state.activeCategory !== 'All') {
    filteredMenu = state.menu.filter(item => item.category === state.activeCategory);
  }

  // Filter by search query
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filteredMenu = filteredMenu.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }

  // Sort by stock descending, placing out-of-stock / unavailable items at the very end
  filteredMenu.sort((a, b) => {
    const aAvailable = a.isAvailable && a.stock > 0;
    const bAvailable = b.isAvailable && b.stock > 0;
    
    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;
    
    return b.stock - a.stock;
  });

  // Counts of categories
  const getCount = (cat) => {
    if (cat === 'All') return state.menu.length;
    return state.menu.filter(item => item.category === cat).length;
  };

  const categories = ['All', 'Kurkure', 'Chips', 'Instants', 'Drinks', 'Biscuits', 'Chocolates', 'Namkeen'];

  content.innerHTML = `
    <div class="container page-view">
      <div class="menu-layout">
        <!-- Sidebar Navigation -->
        <aside class="menu-sidebar">
          <div class="menu-sidebar-title">Categories</div>
          ${categories.map(cat => `
            <button class="category-filter-btn ${state.activeCategory === cat ? 'active' : ''}" data-cat="${cat}">
              <span>${cat}</span>
              <span class="category-count">${getCount(cat)}</span>
            </button>
          `).join('')}
        </aside>

        <!-- Menu Content Grid -->
        <div class="menu-content-area">
          <div class="search-filter-bar">
            <div class="search-input-wrapper input-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="menu-search-input" placeholder="Search for burger, fries, drinks..." value="${state.searchQuery}">
            </div>
          </div>

          ${filteredMenu.length === 0 ? `
            <div class="empty-cart-state">
              <i class="fa-solid fa-utensils"></i>
              <h3>No items found</h3>
              <p>Try searching for another snack or changing your category.</p>
            </div>
          ` : `
            <div class="menu-grid">
              ${filteredMenu.map(item => {
                const cartItem = state.cart.find(ci => ci._id === item._id);
                const quantityInCart = cartItem ? cartItem.quantity : 0;
                const isItemSoldOut = !item.isAvailable || item.stock <= 0;
                
                return `
                  <div class="menu-card ${isItemSoldOut ? 'unavailable' : ''}">
                    ${item.image ? `
                      <div class="menu-card-image">
                        <span class="category-badge">${item.category}</span>
                        <img src="${item.image}" alt="${item.name}">
                        ${isItemSoldOut ? '<span class="availability-label">Sold Out</span>' : ''}
                      </div>
                    ` : ''}
                    <div class="menu-card-details">
                      <h3>${item.name}</h3>
                      <div class="item-stock-badge ${item.stock === 0 ? 'out-of-stock' : item.stock <= 10 ? 'low-stock' : 'normal-stock'}" data-stock-id="${item._id}">
                        <i class="fa-solid ${item.stock === 0 ? 'fa-triangle-exclamation' : 'fa-boxes-stacked'}"></i>
                        <span>${item.stock === 0 ? 'Out of stock' : item.stock <= 10 ? `Only ${item.stock} left` : `${item.stock} in stock`}</span>
                      </div>
                      <p>${item.description || 'No description available.'}</p>
                      
                      <div class="menu-card-footer">
                        <span class="menu-item-price">Rs. ${item.price}</span>
                        
                        ${isItemSoldOut ? `
                          <button class="btn btn-secondary btn-sm" disabled>Sold Out</button>
                        ` : quantityInCart > 0 ? `
                          <div class="qty-selector">
                            <button class="qty-btn dec-qty" data-id="${item._id}">-</button>
                            <span class="qty-val">${quantityInCart}</span>
                            <button class="qty-btn inc-qty" data-id="${item._id}">+</button>
                          </div>
                        ` : `
                          <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${item._id}"><i class="fa-solid fa-plus"></i> Add</button>
                        `}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Bind Sidebar Events
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = btn.getAttribute('data-cat');
      state.activeCategory = cat;
      renderMenu();
    });
  });

  // Bind Search Event
  const searchInput = document.getElementById('menu-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      
      // Debounced-like updates
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        renderMenu();
      }, 300);
    });
  }

  // Bind Cart Add Events
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      const item = state.menu.find(m => m._id === itemId);
      if (item) {
        addToCart(item);
      }
    });
  });

  // Bind Qty Modify Events
  document.querySelectorAll('.inc-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      updateCartQty(itemId, 1);
    });
  });

  document.querySelectorAll('.dec-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      updateCartQty(itemId, -1);
    });
  });
}

// 4. CART VIEW
function renderCart() {
  const content = document.getElementById('app-content');

  if (state.cart.length === 0) {
    content.innerHTML = `
      <div class="container page-view">
        <div class="empty-cart-state">
          <i class="fa-solid fa-bag-shopping"></i>
          <h3>Your cart is empty</h3>
          <p>Add some delicious meals from the menu to satisfy your hunger.</p>
          <a href="#/menu" class="btn btn-primary">Go To Menu</a>
        </div>
      </div>
    `;
    return;
  }

  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  content.innerHTML = `
    <div class="container page-view">
      <h1 class="cart-title"><i class="fa-solid fa-basket-shopping"></i> Shopping Cart</h1>
      <div class="cart-layout">
        <!-- Cart Items List -->
        <div class="cart-items-panel">
          ${state.cart.map(item => `
            <div class="cart-item">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" class="cart-item-img">` : ''}
              <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>Rs. ${item.price} each</p>
              </div>
              <div class="qty-selector">
                <button class="qty-btn cart-dec-qty" data-id="${item._id}">-</button>
                <span class="qty-val">${item.quantity}</span>
                <button class="qty-btn cart-inc-qty" data-id="${item._id}">+</button>
              </div>
              <div class="cart-item-price">Rs. ${item.price * item.quantity}</div>
              <button class="cart-item-remove" data-id="${item._id}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          `).join('')}
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <a href="#/menu" class="btn btn-secondary btn-sm"><i class="fa-solid fa-arrow-left"></i> Add More Items</a>
            <button class="btn btn-danger btn-sm" id="clear-cart-btn"><i class="fa-solid fa-trash"></i> Empty Cart</button>
          </div>
        </div>

        <!-- Summary -->
        <div class="cart-summary-panel">
          <h3 class="cart-summary-title">Bill Details</h3>
          
          <div class="reward-redeem-card" style="background-color: var(--bg-light); border-color: var(--border-color); color: var(--text-main);">
            <div class="reward-redeem-header" style="color: var(--text-main);">
              <i class="fa-solid fa-hand-holding-dollar" style="color: var(--success-color);"></i>
              <h4 style="color: var(--text-main);">Payment: Cash on Delivery</h4>
            </div>
            <p style="font-size: 12px; margin-top: 4px; color: var(--text-muted);">You will pay cash or UPI to the runner upon receiving the food items at your hostel gate/lobby.</p>
          </div>

          <!-- Calculations -->
          <div class="bill-calculations" style="margin-top: 16px;">
            <div class="bill-row">
              <span>Cart Subtotal</span>
              <span>Rs. ${itemsTotal}</span>
            </div>
            <div class="bill-row">
              <span>Delivery Fee</span>
              <span style="color: var(--success-color); font-weight: 600;">FREE</span>
            </div>
            <hr class="bill-divider">
            <div class="bill-row total">
              <span>To Pay</span>
              <span>Rs. ${itemsTotal}</span>
            </div>
          </div>

          <!-- Place Order button -->
          ${state.user ? `
            <a href="#/checkout" class="btn btn-primary btn-block"><i class="fa-solid fa-circle-check"></i> Proceed to Checkout</a>
          ` : `
            <a href="#/login" class="btn btn-primary btn-block"><i class="fa-solid fa-arrow-right-to-bracket"></i> Login to Place Order</a>
          `}
        </div>
      </div>
    </div>
  `;

  // Bind Qty Events
  document.querySelectorAll('.cart-inc-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      updateCartQty(itemId, 1);
    });
  });

  document.querySelectorAll('.cart-dec-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      updateCartQty(itemId, -1);
    });
  });

  // Bind Remove Events
  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      removeFromCart(itemId);
    });
  });

  // Clear Cart
  document.getElementById('clear-cart-btn').addEventListener('click', () => {
    state.cart = [];
    saveCart();
    renderCart();
    showToast('Cart cleared.', 'info');
  });
}

// 5. CHECKOUT VIEW
async function renderCheckout() {
  const content = document.getElementById('app-content');

  if (!state.user) {
    navigate('#/login');
    return;
  }

  if (state.cart.length === 0) {
    navigate('#/cart');
    return;
  }

  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Preparing checkout...</p>
      </div>
    </div>
  `;

  const itemsTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Fetch user scratch cards
  const resCards = await apiCall('/api/rewards/my-cards');
  const allCards = resCards.success ? resCards.data : [];
  
  // Filter for scratched and unused cards, whose associated order is Completed (delivered) or doesn't exist
  const eligibleCards = allCards.filter(card => {
    const isReady = card.isScratched && !card.isUsed;
    if (!isReady) return false;
    
    // Check if card is expired (> 3 days old)
    const isExpired = (new Date() - new Date(card.createdAt)) > 259200000;
    if (isExpired) return false;

    if (card.order) {
      const status = typeof card.order === 'object' ? card.order.status : '';
      return status === 'Completed';
    }
    return true;
  });
  
  const validCards = eligibleCards.filter(card => {
    const thresholds = [30, 60, 90, 100, 200, 200, 0];
    const threshold = card.threshold !== undefined ? card.threshold : (thresholds[card.rewardIndex] || 0);
    return itemsTotal >= threshold;
  });

  // Calculate discount value for a specific card
  function getCardDiscountValue(card, total) {
    const idx = card.rewardIndex;
    if (idx === 0) return 1;
    if (idx === 1) return 2;
    if (idx === 2) return 3;
    if (idx === 3) return Math.floor(total * 0.05);
    if (idx === 4) return Math.floor(total * 0.10);
    if (idx === 5) {
      return Math.min(...state.cart.map(item => item.price));
    }
    return 0;
  }

  // Sort valid cards by discount value descending
  const sortedCards = validCards
    .map(card => ({ card, discount: getCardDiscountValue(card, itemsTotal) }))
    .sort((a, b) => b.discount - a.discount);

  // Auto-apply only the single best card
  const autoApplied = sortedCards.slice(0, 1);
  const autoAppliedCards = autoApplied.map(item => item.card);
  const autoAppliedCardIds = autoAppliedCards.map(card => card._id);
  const totalDiscount = autoApplied.reduce((sum, item) => sum + item.discount, 0);

  function renderCheckoutUI() {
    const finalTotal = Math.max(0, itemsTotal - totalDiscount);
    const defaultBlock = state.user.hostelBlock || 'X';
    const defaultRoom = state.user.roomNo || 1;

    content.innerHTML = `
      <div class="container page-view">
        <h1 class="cart-title"><i class="fa-solid fa-wallet"></i> Complete Checkout</h1>
        <div class="checkout-layout">
          <!-- Delivery Form -->
          <div class="checkout-delivery-panel">
            <h3 class="cart-summary-title">Delivery Details</h3>
            <form id="checkout-form">
              <!-- Hostel Block select -->
              <div class="form-group">
                <label for="address-block-select">Hostel Block</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-building"></i>
                  <select id="address-block-select" required style="width: 100%; padding-left: 36px; height: 42px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-light); color: var(--text-main);">
                    <option value="X" ${defaultBlock === 'X' ? 'selected' : ''}>Block X ${state.shop.isBlockXOpen ? '' : ' (Not accepting orders)'}</option>
                    <option value="Y" ${defaultBlock === 'Y' ? 'selected' : ''}>Block Y ${state.shop.isBlockYOpen ? '' : ' (Not accepting orders)'}</option>
                    <option value="Z" ${defaultBlock === 'Z' ? 'selected' : ''}>Block Z ${state.shop.isBlockZOpen ? '' : ' (Not accepting orders)'}</option>
                  </select>
                </div>
              </div>

              <!-- Room number select -->
              <div class="form-group" style="margin-top: 14px;">
                <label for="address-room-select">Room Number</label>
                <div class="input-wrapper">
                  <i class="fa-solid fa-door-closed"></i>
                  <select id="address-room-select" required style="width: 100%; padding-left: 36px; height: 42px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-light); color: var(--text-main);">
                    ${Array.from({ length: 20 }, (_, i) => i + 1).map(num => `
                      <option value="${num}" ${Number(defaultRoom) === num ? 'selected' : ''}>Room ${num}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
              
              <!-- Applied Rewards (Auto-selected) -->
              <div class="form-group" style="margin-top: 16px; margin-bottom: 14px;">
                <label style="font-weight: 600;"><i class="fa-solid fa-ticket"></i> Applied Rewards (Auto-selected)</label>
                ${autoAppliedCards.length > 0 ? `
                  <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
                    ${autoApplied.map(item => `
                      <div class="reward-pill" style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-light); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px;">
                        <span><i class="fa-solid fa-gift" style="color: var(--primary-color); margin-right: 6px;"></i> ${item.card.description}</span>
                        <strong style="color: var(--success-color);">-Rs. ${item.discount}</strong>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div style="background-color: var(--bg-light); border: 1px dashed var(--border-color); padding: 12px; border-radius: var(--radius-sm); font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                    <i class="fa-solid fa-circle-info"></i> No eligible rewards to auto-apply.
                  </div>
                `}
              </div>

              <!-- Payment Method (COD) -->
              <div class="form-group" style="margin-top: 14px; margin-bottom: 20px;">
                <label><i class="fa-solid fa-money-bill-1-wave"></i> Payment Method</label>
                <div style="background-color: var(--bg-light); border: 1px dashed var(--border-color); padding: 12px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--success-color);">
                  <i class="fa-solid fa-hand-holding-dollar"></i> Cash on Delivery (COD)
                </div>
              </div>

              <div class="reward-redeem-card" style="background-color: var(--bg-light); border-color: var(--border-color); color: var(--text-main); margin-bottom: 16px;">
                <h4 style="font-size: 14px; margin-bottom: 6px;"><i class="fa-solid fa-truck-fast"></i> Campus Delivery Notice</h4>
                <p style="font-size: 12px; color: var(--text-muted);">Orders are delivered by runner staff directly inside the hostel lobby or floor gates within 20 mins of cooking approval.</p>
              </div>

              <button type="submit" class="btn btn-primary btn-block" id="place-order-submit-btn">
                <i class="fa-solid fa-fire"></i> Confirm & Place Order (${finalTotal} Rs)
              </button>
            </form>
          </div>

          <!-- Summary bill snapshot -->
          <div class="cart-summary-panel">
            <h3 class="cart-summary-title">Order Summary</h3>
            <div class="checkout-summary-items" style="display: flex; flex-direction: column; gap: 12px; max-height: 180px; overflow-y: auto;">
              ${state.cart.map(item => `
                <div style="display: flex; justify-content: space-between; font-size: 14px;">
                  <span>${item.name} <strong>x${item.quantity}</strong></span>
                  <span>Rs. ${item.price * item.quantity}</span>
                </div>
              `).join('')}
            </div>
            <hr class="bill-divider">
            
            <div class="bill-calculations">
              <div class="bill-row">
                <span>Items Total</span>
                <span>Rs. ${itemsTotal}</span>
              </div>
              <div class="bill-row" id="bill-discount-row" style="${totalDiscount > 0 ? 'display: flex;' : 'display: none;'} justify-content: space-between;">
                <span>Discount</span>
                <span class="discount-val" style="color: var(--danger-color); font-weight: 600;">-Rs. ${totalDiscount}</span>
              </div>
              <div class="bill-row">
                <span>Delivery Fee</span>
                <span style="color: var(--success-color); font-weight: 600;">FREE</span>
              </div>
              <hr class="bill-divider">
              <div class="bill-row total">
                <span>Final Total</span>
                <span id="bill-final-total">Rs. ${finalTotal}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Submit Order Event
    const form = document.getElementById('checkout-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('place-order-submit-btn');
        const hostelBlock = document.getElementById('address-block-select').value;
        const roomNo = document.getElementById('address-room-select').value;
        const deliveryAddress = `Room ${roomNo}, Block ${hostelBlock}`;

        // Client-side Block Acceptance Check
        const isBlockOpen = 
          hostelBlock === 'X' ? state.shop.isBlockXOpen :
          hostelBlock === 'Y' ? state.shop.isBlockYOpen :
          hostelBlock === 'Z' ? state.shop.isBlockZOpen : true;

        if (!isBlockOpen) {
          showToast(`Sorry, currently we are not accepting orders for your block (Block ${hostelBlock}).`, 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin: 0;"></div> Booking...';

        // Restructure cart items for backend
        const itemsPayload = state.cart.map(item => ({
          menuItemId: item._id,
          quantity: item.quantity
        }));

        const payload = {
          items: itemsPayload,
          deliveryAddress,
          scratchCardIds: autoAppliedCardIds
        };

        const res = await apiCall('/api/orders', 'POST', payload);
        
        if (res.success) {
          showToast(res.message, 'success');
          
          // Clear cart
          state.cart = [];
          saveCart();
          
          // Refresh User profile
          await fetchUserProfile();
          
          if (res.scratchCard) {
            showScratchCardPopup(res.scratchCard);
          } else {
            navigate('#/orders');
          }
        } else {
          showToast(res.message || 'Order failed.', 'error');
          submitBtn.disabled = false;
          renderCheckoutUI();
          
          if (res.shopClosed) {
            navigate('#/shop-closed');
          }
        }
      });
    }
  }

  // Initial draw
  renderCheckoutUI();
}

// --- Dynamic Scratch Card Popup Manager ---
function showScratchCardPopup(card) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  const closeBtn = document.getElementById('modal-close-btn');

  if (!modal || !title || !body) return;

  // Clone close button to remove default close listeners
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

  // Set close behavior: navigate to orders page
  const closeModal = () => {
    modal.classList.remove('open');
    restoreDefaultModalClose();
    navigate('#/orders');
  };

  newCloseBtn.addEventListener('click', closeModal);
  
  // Custom click-outside modal close listener
  const outsideClickListener = (e) => {
    if (e.target === modal) {
      modal.removeEventListener('click', outsideClickListener);
      closeModal();
    }
  };
  modal.addEventListener('click', outsideClickListener);

  title.textContent = "You Earned a Scratch Card!";

  body.innerHTML = `
    <div style="text-align: center; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px;">
      <p style="color: var(--text-muted); font-size: 14px; margin: 0;">Scratch the card below to reveal your potential reward for this order!</p>
      
      <div class="scratch-card-box unscratched" id="popup-scratch-card" style="width: 280px; height: 160px; margin: 0 auto;">
        <div class="scratch-cover">
          <i class="fa-solid fa-gift"></i>
          <span>Scratch Me!</span>
        </div>
      </div>
      
      <div id="popup-scratch-result" style="display: none; width: 100%; text-align: center; margin-top: 10px;">
        <!-- Filled after scratching -->
      </div>
      
      <button class="btn btn-secondary btn-block" id="popup-close-btn" style="margin-top: 10px; display: none;">View My Orders</button>
    </div>
  `;

  modal.classList.add('open');

  const cardBox = document.getElementById('popup-scratch-card');
  if (cardBox) {
    cardBox.addEventListener('click', async () => {
      if (cardBox.classList.contains('scratching')) return;
      cardBox.classList.add('scratching');

      setTimeout(async () => {
        const res = await apiCall(`/api/rewards/scratch/${card._id}`, 'PUT');
        if (res.success) {
          const isBetterLuck = (res.data && res.data.isDeleted) || card.rewardIndex === 6;
          
          cardBox.style.display = 'none';
          const resultDiv = document.getElementById('popup-scratch-result');
          const finalCloseBtn = document.getElementById('popup-close-btn');
          
          if (resultDiv) {
            resultDiv.style.display = 'block';
            if (isBetterLuck) {
              resultDiv.innerHTML = `
                <div style="padding: 16px; background-color: var(--bg-light); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                  <i class="fa-solid fa-face-frown" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
                  <h3 style="color: var(--text-main); font-weight: 700; margin-bottom: 6px;">Better luck next time!</h3>
                  <p style="color: var(--text-muted); font-size: 13px; margin: 0;">This scratch card yielded no rewards. Try again with your next order!</p>
                </div>
              `;
            } else {
              resultDiv.innerHTML = `
                <div style="padding: 16px; background-color: hsl(142, 70%, 95%); border-radius: var(--radius-md); border: 1px solid hsl(142, 70%, 80%);">
                  <i class="fa-solid fa-award" style="font-size: 40px; color: hsl(142, 76%, 25%); margin-bottom: 12px; display: block;"></i>
                  <h3 style="color: hsl(142, 76%, 20%); font-weight: 800; margin-bottom: 6px;">Reward Won!</h3>
                  <h4 style="color: var(--text-main); font-weight: 700; margin-bottom: 12px;">${card.description}</h4>
                  <p style="color: hsl(142, 76%, 25%); font-size: 12px; font-weight: 600; margin: 0; line-height: 1.4;">
                    * Reward will be added after delivering the items or products.
                  </p>
                </div>
              `;
            }
          }
          
          if (finalCloseBtn) {
            finalCloseBtn.style.display = 'block';
            finalCloseBtn.addEventListener('click', closeModal);
          }
          
          await fetchUserProfile();
        } else {
          showToast(res.message || 'Scratch failed.', 'error');
          cardBox.classList.remove('scratching');
        }
      }, 700);
    });
  }
}

function restoreDefaultModalClose() {
  const closeBtn = document.getElementById('modal-close-btn');
  if (!closeBtn) return;
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  
  newCloseBtn.addEventListener('click', () => {
    const modal = document.getElementById('app-modal');
    if (modal) modal.classList.remove('open');
  });
}

// 6. ORDERS HISTORY VIEW
async function renderOrders() {
  const content = document.getElementById('app-content');

  if (!state.user) {
    navigate('#/login');
    return;
  }

  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading your food order logs...</p>
      </div>
    </div>
  `;

  const res = await apiCall('/api/orders/my-orders');
  if (!res.success) {
    content.innerHTML = `<div class="container page-view"><p class="text-danger">Failed: ${res.message}</p></div>`;
    return;
  }

  const orders = res.data;

  content.innerHTML = `
    <div class="container page-view">
      <div class="orders-container">
        <h1 class="cart-title" style="margin-bottom: 24px;"><i class="fa-solid fa-box-open"></i> Order History</h1>
        
        ${orders.length === 0 ? `
          <div class="empty-cart-state">
            <i class="fa-solid fa-box-open"></i>
            <h3>No orders found</h3>
            <p>You haven't ordered anything yet. Open the menu to choose snacks.</p>
            <a href="#/menu" class="btn btn-primary">Order Now</a>
          </div>
        ` : `
          ${orders.map(order => {
            const date = new Date(order.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return `
              <div class="order-history-card" data-order-card-id="${order._id}">
                <div class="order-card-header">
                  <div class="order-header-meta">
                    <div>
                      <span>Order ID</span>
                      <strong>${order.orderId}</strong>
                    </div>
                    <div>
                      <span>Date Ordered</span>
                      <strong>${date}</strong>
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <span class="status-badge ${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span>
                    ${!['Completed', 'Cancelled'].includes(order.status) ? `
                      <div class="delivery-timer" data-created="${order.createdAt}" data-amount-paid="${order.originalAmountPaid || order.amountPaid}" style="font-size: 11px; font-weight: 600;">
                        <!-- Populated by JS timer -->
                      </div>
                    ` : ''}
                  </div>
                </div>
                
                <div class="order-card-body">
                  ${order.items.map(item => `
                    <div class="order-item-row">
                      <div class="order-item-qty-name">
                        <span class="order-item-qty">${item.quantity}x</span>
                        <span class="order-item-name">${item.name}</span>
                      </div>
                      <span class="order-item-price">Rs. ${item.price * item.quantity}</span>
                    </div>
                  `).join('')}
                </div>
                
                <div class="order-card-footer">
                  <div class="order-totals-summary">
                    <span>Subtotal: <span>Rs. ${order.totalAmount}</span></span>
                    ${order.pointsRedeemed > 0 ? `<span>Discount Applied: <span>-Rs. ${order.pointsRedeemed}</span></span>` : ''}
                    ${order.pointsEarned > 0 ? `<span class="earned">Earned: <span>+Rs. ${order.pointsEarned}</span></span>` : ''}
                  </div>
                  <div class="total-price">
                    ${order.isLate ? `
                      Rs. ${order.amountPaid} <small style="text-decoration: line-through; color: var(--text-muted); font-size: 11px; font-weight: normal;">Rs. ${order.originalAmountPaid}</small>
                    ` : `
                      Rs. ${order.amountPaid}
                    `}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        `}
      </div>
    </div>
  `;
}

// 7. REWARDS VIEW
async function renderRewards() {
  const content = document.getElementById('app-content');

  if (!state.user) {
    navigate('#/login');
    return;
  }

  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading your rewards dashboard...</p>
      </div>
    </div>
  `;

  const res = await apiCall('/api/rewards/my-cards');
  const cards = res.success ? res.data : [];

  content.innerHTML = `
    <div class="container page-view">
      <!-- Header banner -->
      <div class="rewards-hero-card" style="background: linear-gradient(135deg, var(--primary-color), hsl(12, 80%, 45%));">
        <div class="rewards-hero-text" style="grid-column: 1 / -1;">
          <h1>Hostel Bites Scratch Cards Club</h1>
          <p>Order delicious bites to earn scratch cards instantly! Scratch the cards to win rewards like discount coupons, percentage cuts, or free menu items.</p>
        </div>
      </div>

      <!-- Scratch Cards Grid -->
      <section class="scratch-cards-section">
        <div class="section-header">
          <h2>Your Scratch Cards</h2>
          <p>Tap on any card with a gift box below to scratch and reveal your reward!</p>
        </div>
        ${cards.length === 0 ? `
          <div style="text-align: center; padding: 40px; background: var(--bg-card); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <i class="fa-solid fa-ticket" style="font-size: 32px; color: var(--text-muted); margin-bottom: 12px; display: block;"></i>
            <p style="color: var(--text-muted); margin: 0;">You don't have any scratch cards yet. Place an order to earn one!</p>
          </div>
        ` : `
          <div class="scratch-cards-grid">
            ${cards.map(card => {
              const isScratched = card.isScratched;
              const isUsed = card.isUsed;
              const isHighlighted = state.rewardedScratchCardId === card._id;
              
              // 3 days expiration check: 3 * 24 * 60 * 60 * 1000 = 259200000 ms
              const isExpired = !isUsed && (new Date() - new Date(card.createdAt)) > 259200000;
              
              let iconClass = 'fa-tags';
              if (card.rewardIndex === 3 || card.rewardIndex === 4) iconClass = 'fa-percent';
              if (card.rewardIndex === 5) iconClass = 'fa-pizza-slice';
              if (card.rewardIndex === 6) iconClass = 'fa-face-frown';

              let statusText = 'Available';
              let statusClass = 'status-available';
              if (isUsed) {
                statusText = 'Used';
                statusClass = 'status-used';
              } else if (isExpired) {
                statusText = 'Expired';
                statusClass = 'status-expired';
              } else if (card.order && card.order.status !== 'Completed') {
                statusText = 'Pending Delivery';
                statusClass = 'status-pending';
              }

              return `
                <div class="scratch-card-box ${isScratched ? 'scratched' : 'unscratched'} ${isUsed ? 'used' : ''} ${isHighlighted ? 'highlighted-award' : ''} ${isExpired ? 'expired' : ''}" data-id="${card._id}">
                  <!-- Delete button for unwanted/expired rewards -->
                  <button class="reward-delete-btn" data-id="${card._id}" title="Delete Reward">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>

                  ${!isScratched ? `
                    <div class="scratch-cover">
                      <i class="fa-solid fa-gift"></i>
                      <span>Scratch Me!</span>
                    </div>
                  ` : `
                    <div class="scratch-content">
                      <div class="scratch-reward-icon">
                        <i class="fa-solid ${iconClass}"></i>
                      </div>
                      <div class="scratch-reward-details">
                        <h4>${card.description}</h4>
                        <span class="scratch-card-status ${statusClass}">
                          ${statusText}
                        </span>
                      </div>
                    </div>
                  `}
                </div>
              `;
            }).join('')}
          </div>
        `}
      </section>

      <!-- Scratch Cards Guide -->
      <div class="section-header" style="margin-top: 40px;">
        <h2>Scratch Cards Guide</h2>
        <p>Order, scratch, win, and redeem. It's that simple!</p>
      </div>

      <div class="rewards-rules-list" style="grid-template-columns: 1fr; margin-bottom: 40px;">
        <div class="rewards-rule-item">
          <i class="fa-solid fa-gift"></i>
          <div>
            <h4>Earn on Every Order</h4>
            <p>Every time you place an order, you instantly receive a Scratch Card on your screen. Scratch it to find out which reward you won!</p>
          </div>
        </div>
        <div class="rewards-rule-item">
          <i class="fa-solid fa-truck-fast"></i>
          <div>
            <h4>Delivered Order Activation</h4>
            <p>Scratched rewards will be locked and automatically activated once the corresponding order is successfully delivered by our runner staff.</p>
          </div>
        </div>
        <div class="rewards-rule-item">
          <i class="fa-solid fa-trash-can"></i>
          <div>
            <h4>No Empty Hands</h4>
            <p>Lucky scratchers win discounts or free items. Cards showing "Better luck next time" are cleaned up automatically and immediately deleted.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Scratch Actions
  document.querySelectorAll('.scratch-card-box.unscratched').forEach(box => {
    box.addEventListener('click', async (e) => {
      // Prevent scratching if expired
      if (box.classList.contains('expired')) {
        showToast('This reward card has expired and cannot be scratched.', 'error');
        return;
      }

      const cardId = box.getAttribute('data-id');
      if (box.classList.contains('scratching')) return;

      box.classList.add('scratching');

      // Shaking animation effect before revealing card
      setTimeout(async () => {
        const res = await apiCall(`/api/rewards/scratch/${cardId}`, 'PUT');
        if (res.success) {
          const isDeleted = res.data && res.data.isDeleted || res.data === null;
          if (isDeleted) {
            showToast('Better luck next time!', 'info');
          } else {
            showToast('Congratulations! Coupon revealed.', 'success');
          }
          await fetchUserProfile();
          renderRewards();
        } else {
          showToast(res.message || 'Could not scratch card', 'error');
          box.classList.remove('scratching');
        }
      }, 700);
    });
  });

  // Bind Delete Actions
  document.querySelectorAll('.reward-delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent triggering scratch action
      const cardId = btn.getAttribute('data-id');
      
      if (confirm('Are you sure you want to delete this reward card?')) {
        const res = await apiCall(`/api/rewards/${cardId}`, 'DELETE');
        if (res.success) {
          showToast(res.message, 'success');
          renderRewards();
        } else {
          showToast(res.message || 'Failed to delete reward.', 'error');
        }
      }
    });
  });

  // Handle auto-scroll to highlighted award
  if (state.rewardedScratchCardId) {
    const highlightedCard = document.querySelector(`.scratch-card-box[data-id="${state.rewardedScratchCardId}"]`);
    if (highlightedCard) {
      setTimeout(() => {
        highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    // Remove the highlight after 5 seconds
    setTimeout(() => {
      state.rewardedScratchCardId = null;
      const el = document.querySelector('.highlighted-award');
      if (el) el.classList.remove('highlighted-award');
    }, 5000);
  }
}

// 8. LOGIN / SIGNUP VIEW
function renderLogin() {
  const content = document.getElementById('app-content');
  let isSignupActive = false;

  function updateAuthFormHTML() {
    content.innerHTML = `
      <div class="container page-view">
        <div class="auth-container">
          <div class="auth-card">
            <!-- Tabs -->
            <div class="auth-tabs">
              <button class="auth-tab-btn ${!isSignupActive ? 'active' : ''}" id="login-tab-trigger">Login</button>
              <button class="auth-tab-btn ${isSignupActive ? 'active' : ''}" id="signup-tab-trigger">Signup</button>
            </div>
            
            <div class="auth-body">
              <form id="auth-submit-form">
                ${isSignupActive ? `
                  <!-- Signup Field: Name -->
                  <div class="form-group">
                    <label for="signup-name">Full Name</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-signature"></i>
                      <input type="text" id="signup-name" placeholder="John Doe" required>
                    </div>
                  </div>
                  
                  <!-- Signup Field: Phone -->
                  <div class="form-group">
                    <label for="signup-phone">Phone Number</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-phone"></i>
                      <input type="tel" id="signup-phone" placeholder="8218325600" required>
                    </div>
                  </div>

                  <!-- Signup Field: Password -->
                  <div class="form-group">
                    <label for="signup-password">Password</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-lock"></i>
                      <input type="password" id="signup-password" placeholder="••••••" minlength="5" required>
                    </div>
                  </div>

                  <!-- Signup Field: Hostel Block -->
                  <div class="form-group">
                    <label for="signup-hostel-block">Hostel Block</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-building"></i>
                      <select id="signup-hostel-block" required>
                        <option value="" disabled selected>Select Block</option>
                        <option value="X">Block X</option>
                        <option value="Y">Block Y</option>
                        <option value="Z">Block Z</option>
                      </select>
                    </div>
                  </div>

                  <!-- Signup Field: Room No -->
                  <div class="form-group">
                    <label for="signup-room-no">Room Number (1-20 only)</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-door-closed"></i>
                      <input type="number" id="signup-room-no" min="1" max="20" placeholder="e.g. 15" required>
                    </div>
                  </div>

                  <!-- Signup Field: Register As -->
                  <div class="form-group">
                    <label for="signup-role">Register As</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-user-tag"></i>
                      <select id="signup-role" required>
                        <option value="customer">Customer (Instant Access)</option>
                        <option value="admin">Admin (Requires Approval)</option>
                      </select>
                    </div>
                  </div>
                ` : `
                  <!-- Login Field: Phone -->
                  <div class="form-group">
                    <label for="login-phone">Phone Number</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-phone"></i>
                      <input type="tel" id="login-phone" placeholder="e.g. 8218325600" required>
                    </div>
                  </div>

                  <!-- Login Field: Password -->
                  <div class="form-group">
                    <label for="login-password">Password</label>
                    <div class="input-wrapper">
                      <i class="fa-solid fa-lock"></i>
                      <input type="password" id="login-password" placeholder="••••••" required>
                    </div>
                  </div>
                `}

                <button type="submit" class="btn btn-primary btn-block" style="margin-top: 10px;" id="auth-submit-btn">
                  ${isSignupActive ? '<i class="fa-solid fa-user-plus"></i> Create Account' : '<i class="fa-solid fa-sign-in-alt"></i> Login'}
                </button>
              </form>
              
              <div class="auth-footer-note">
                ${isSignupActive ? `
                  Already have an account? <button id="auth-toggle-note-btn">Login here</button>
                ` : `
                  Don't have an account? <button id="auth-toggle-note-btn">Register here</button>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind tab switch triggers
    document.getElementById('login-tab-trigger').addEventListener('click', () => {
      isSignupActive = false;
      updateAuthFormHTML();
    });
    document.getElementById('signup-tab-trigger').addEventListener('click', () => {
      isSignupActive = true;
      updateAuthFormHTML();
    });

    const toggleNoteBtn = document.getElementById('auth-toggle-note-btn');
    if (toggleNoteBtn) {
      toggleNoteBtn.addEventListener('click', () => {
        isSignupActive = !isSignupActive;
        updateAuthFormHTML();
      });
    }

    // Submit form handler
    const form = document.getElementById('auth-submit-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('auth-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px; margin: 0;"></div> Submitting...';

        let res;
        if (isSignupActive) {
          const name = document.getElementById('signup-name').value;
          const phone = document.getElementById('signup-phone').value;
          const password = document.getElementById('signup-password').value;
          const hostelBlock = document.getElementById('signup-hostel-block').value;
          const roomNo = parseInt(document.getElementById('signup-room-no').value, 10);
          const role = document.getElementById('signup-role').value;

          res = await apiCall('/api/auth/signup', 'POST', { name, phone, password, hostelBlock, roomNo, role });
        } else {
          const phone = document.getElementById('login-phone').value;
          const password = document.getElementById('login-password').value;

          res = await apiCall('/api/auth/login', 'POST', { phone, password });
        }

        if (res.success) {
          if (isSignupActive && res.data.role === 'admin' && !res.data.isAdminApproved) {
            showToast('Admin registration request submitted. Please wait for approval from present admins.', 'info');
            isSignupActive = false;
            updateAuthFormHTML();
          } else {
            login(res.data, res.data.token);
            // Re-direct
            if (res.data.role === 'admin') {
              navigate('#/admin');
            } else {
              navigate('#/menu');
            }
          }
        } else {
          showToast(res.message || 'Authentication failed', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = isSignupActive ? 
            '<i class="fa-solid fa-user-plus"></i> Create Account' : 
            '<i class="fa-solid fa-sign-in-alt"></i> Login';
        }
      });
    }
  }

  updateAuthFormHTML();
}

// 9. ADMIN VIEW
async function renderAdmin() {
  const content = document.getElementById('app-content');

  if (!state.user || state.user.role !== 'admin') {
    showToast('Forbidden access.', 'error');
    navigate('#/home');
    return;
  }

  content.innerHTML = `
    <div class="container">
      <div class="initial-loader">
        <div class="spinner"></div>
        <p>Loading Admin Workspace...</p>
      </div>
    </div>
  `;

  // Fetch needed datasets based on active tab
  let ordersList = [];
  let menuList = [];
  let usersList = [];
  let requestsList = [];
  let teamList = [];
  
  if (state.adminActiveTab === 'orders') {
    const res = await apiCall('/api/admin/orders');
    if (res.success) {
      ordersList = res.data;
      if (!state.knownOrderIds) {
        state.knownOrderIds = ordersList.map(o => o._id);
      }
    }
  } else if (state.adminActiveTab === 'menu') {
    const res = await apiCall('/api/menu');
    if (res.success) menuList = res.data;
  } else if (state.adminActiveTab === 'users') {
    const res = await apiCall('/api/admin/users');
    if (res.success) usersList = res.data;
  } else if (state.adminActiveTab === 'requests') {
    const res = await apiCall('/api/requests/admin');
    if (res.success) requestsList = res.data;
  } else if (state.adminActiveTab === 'team') {
    const res = await apiCall('/api/team');
    if (res.success) teamList = res.data;
  }

  content.innerHTML = `
    <div class="container page-view">
      <div class="admin-layout">
        <div class="admin-header-row">
          <h1>Admin Dashboard Portal</h1>
          <div class="shop-badge-status ${state.shop.isOpen ? 'open' : 'closed'}">
            <span class="dot"></span>
            <span>Store is: <strong>${state.shop.isOpen ? 'OPEN' : 'CLOSED'}</strong></span>
          </div>
        </div>
 
        <!-- Dashboard Sub Navigation tabs -->
        <div class="admin-tabs">
          <button class="admin-tab-btn ${state.adminActiveTab === 'orders' ? 'active' : ''}" data-tab="orders"><i class="fa-solid fa-rectangle-list"></i> Customer Orders (${ordersList.length || 0})</button>
          <button class="admin-tab-btn ${state.adminActiveTab === 'menu' ? 'active' : ''}" data-tab="menu"><i class="fa-solid fa-ice-cream"></i> Manage Menu</button>
          <button class="admin-tab-btn ${state.adminActiveTab === 'requests' ? 'active' : ''}" data-tab="requests"><i class="fa-solid fa-clipboard-question"></i> Product Requests (${requestsList.length || 0})</button>
          <button class="admin-tab-btn ${state.adminActiveTab === 'team' ? 'active' : ''}" data-tab="team"><i class="fa-solid fa-people-group"></i> Manage Team</button>
          <button class="admin-tab-btn ${state.adminActiveTab === 'users' ? 'active' : ''}" data-tab="users"><i class="fa-solid fa-users"></i> Users & Rewards</button>
          <button class="admin-tab-btn ${state.adminActiveTab === 'shop' ? 'active' : ''}" data-tab="shop"><i class="fa-solid fa-sliders"></i> Shop Controls</button>
        </div>
 
        <div class="admin-panel-card">
          ${state.adminActiveTab === 'orders' ? renderAdminOrdersTab(ordersList) : ''}
          ${state.adminActiveTab === 'menu' ? renderAdminMenuTab(menuList) : ''}
          ${state.adminActiveTab === 'requests' ? renderAdminRequestsTab(requestsList) : ''}
          ${state.adminActiveTab === 'team' ? renderAdminTeamTab(teamList) : ''}
          ${state.adminActiveTab === 'users' ? renderAdminUsersTab(usersList) : ''}
          ${state.adminActiveTab === 'shop' ? renderAdminShopTab() : ''}
        </div>
      </div>
    </div>
  `;

  // Bind Admin Tabs
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.adminActiveTab = btn.getAttribute('data-tab');
      renderAdmin();
    });
  });

  // Bind events specific to active tab
  if (state.adminActiveTab === 'orders') {
    bindAdminOrdersEvents();
  } else if (state.adminActiveTab === 'menu') {
    bindAdminMenuEvents();
  } else if (state.adminActiveTab === 'requests') {
    bindAdminRequestsEvents();
  } else if (state.adminActiveTab === 'team') {
    bindAdminTeamEvents();
  } else if (state.adminActiveTab === 'users') {
    bindAdminUsersEvents();
  } else if (state.adminActiveTab === 'shop') {
    bindAdminShopEvents();
  }
}

// Admin Sub-views & event bindings
function renderAdminOrdersTab(orders) {
  if (orders.length === 0) {
    return `<div style="text-align: center; padding: 40px;"><p style="color: var(--text-muted);">No orders submitted yet.</p></div>`;
  }

  const statuses = ['Pending', 'Confirmed', 'Unpaid', 'Preparing', 'Out for Delivery', 'Completed', 'Cancelled'];

  return `
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer info</th>
            <th>Delivery Address</th>
            <th>Items details</th>
            <th>Amount Paid</th>
            <th>Progress Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => {
            const customerName = order.user ? order.user.name : 'Unknown User';
            const customerPhone = order.user ? order.user.phone : '';
            const itemsSummary = order.items.map(it => `${it.name} <strong>x${it.quantity}</strong>`).join(', ');

            return `
              <tr data-order-row-id="${order._id}">
                <td>
                  ${order.status === 'Pending' ? `<span class="pending-indicator-dot" title="Pending / New Order"></span>` : ''}
                  <strong>${order.orderId}</strong>
                  <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${new Date(order.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td>
                  <div>${customerName}</div>
                  <small style="color: var(--text-muted); font-size: 11px;">${customerPhone}</small>
                </td>
                <td>${order.deliveryAddress}</td>
                <td>${itemsSummary}</td>
                <td class="admin-amount-cell" data-amount="${order.originalAmountPaid || order.amountPaid}">
                  <strong>Rs. ${order.amountPaid}</strong>
                  ${order.isLate ? `<br><small style="text-decoration: line-through; color: var(--text-muted); font-size: 10px;">Rs. ${order.originalAmountPaid}</small>` : ''}
                </td>
                <td>
                  <select class="admin-status-select order-status-updater" data-id="${order._id}">
                    ${statuses.map(st => `
                      <option value="${st}" ${order.status === st ? 'selected' : ''}>${st}</option>
                    `).join('')}
                  </select>
                  ${!['Completed', 'Cancelled'].includes(order.status) ? `
                    <div class="delivery-timer" data-created="${order.createdAt}" data-amount-paid="${order.originalAmountPaid || order.amountPaid}" style="font-size: 10px; font-weight: 600; margin-top: 4px;">
                      <!-- Populated by JS timer -->
                    </div>
                  ` : ''}
                </td>
                <td>
                  <div class="admin-table-actions">
                    <button class="btn-delete btn-delete-order" data-id="${order._id}" title="Delete Order"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindAdminOrdersEvents() {
  document.querySelectorAll('.order-status-updater').forEach(select => {
    select.addEventListener('change', async (e) => {
      const orderId = select.getAttribute('data-id');
      const newStatus = e.target.value;
      
      const res = await apiCall(`/api/admin/orders/${orderId}`, 'PUT', { status: newStatus });
      if (res.success) {
        showToast(`Order status updated to ${newStatus}`, 'success');
      } else {
        showToast(res.message || 'Status update failed.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-delete-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orderId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
        const res = await apiCall(`/api/admin/orders/${orderId}`, 'DELETE');
        if (res.success) {
          showToast('Order deleted successfully.', 'success');
          renderAdmin();
        } else {
          showToast(res.message || 'Failed to delete order.', 'error');
        }
      }
    });
  });
}

function renderAdminMenuTab(menuItems) {
  return `
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center;">
      <h3 style="font-size: 20px; font-weight: 700;">Menu Listings</h3>
      <button class="btn btn-primary btn-sm" id="admin-add-item-btn"><i class="fa-solid fa-plus"></i> Add Menu Item</button>
    </div>
    
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Item Details</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${menuItems.map(item => `
            <tr data-item-row-id="${item._id}">
              <td>
                <div class="admin-table-item-info">
                  ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
                  <div>
                    <h5>${item.name}</h5>
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 2px;">${item.description || 'No description'}</p>
                  </div>
                </div>
              </td>
              <td><span class="category-count" style="background-color: var(--bg-light);">${item.category}</span></td>
              <td><strong>Rs. ${item.price}</strong></td>
              <td><strong class="item-stock-qty">${item.stock}</strong> left</td>
              <td>
                <span class="status-badge ${item.isAvailable ? 'completed' : 'cancelled'}" style="font-size: 10px; padding: 4px 8px;">
                  ${item.isAvailable ? 'Available' : 'Sold Out'}
                </span>
              </td>
              <td>
                <div class="admin-table-actions">
                  <button class="btn-edit" data-id="${item._id}" title="Edit Item"><i class="fa-solid fa-pen"></i></button>
                  <button class="btn-delete" data-id="${item._id}" title="Delete Item"><i class="fa-solid fa-trash"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindAdminMenuEvents() {
  // Add item button
  const addBtn = document.getElementById('admin-add-item-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openMenuModal(null); // Null triggers empty create form
    });
  }

  // Edit item button
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-id');
      const item = state.menu.find(m => m._id === itemId);
      if (item) {
        openMenuModal(item);
      }
    });
  });

  // Delete item button
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const itemId = btn.getAttribute('data-id');
      const item = state.menu.find(m => m._id === itemId);
      if (!item) return;

      if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
        const res = await apiCall(`/api/menu/${itemId}`, 'DELETE');
        if (res.success) {
          showToast(res.message, 'success');
          renderAdmin();
        } else {
          showToast(res.message || 'Deletion failed', 'error');
        }
      }
    });
  });
}

function renderAdminUsersTab(users) {
  if (users.length === 0) {
    return `<p>No registered users found.</p>`;
  }

  const loggedInUserPhone = state.user ? state.user.phone : '';

  return `
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Room & Block</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Approval Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isTargetSuperadmin = u.phone === '8218325600';
            const isTargetAdmin = u.role === 'admin';
            const isCallerSuperadmin = loggedInUserPhone === '8218325600';
            const isSelf = state.user && state.user._id === u._id;

            // Determine if Delete is allowed
            let showDeleteBtn = false;
            if (!isTargetSuperadmin && !isSelf) {
              if (!isTargetAdmin) {
                showDeleteBtn = true; // Any admin can delete customer
              } else if (isCallerSuperadmin) {
                showDeleteBtn = true; // Only superadmin can delete other admins
              }
            }

            // Determine if Approve is allowed
            const showApproveBtn = isTargetAdmin && !u.isAdminApproved;

            return `
              <tr data-user-row-id="${u._id}">
                <td><strong>${u.name}</strong></td>
                <td>Room ${u.roomNo || 'N/A'}, Block ${u.hostelBlock || 'N/A'}</td>
                <td>${u.phone}</td>
                <td>
                  <span class="status-badge ${u.role === 'admin' ? 'confirmed' : 'pending'}" style="font-size: 11px; padding: 4px 10px;">
                    ${u.role === 'admin' ? 'Admin' : 'Customer'}
                  </span>
                </td>
                <td>
                  <span class="status-badge ${u.isAdminApproved ? 'completed' : 'cancelled'}" style="font-size: 11px; padding: 4px 10px;">
                    ${u.isAdminApproved ? 'Approved' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div class="admin-table-actions">
                    ${showApproveBtn ? `
                      <button class="btn btn-primary btn-sm btn-approve-user" data-id="${u._id}" style="padding: 4px 8px; font-size: 11px; margin-right: 6px;">
                        <i class="fa-solid fa-check"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-warning btn-sm btn-reset-password" data-id="${u._id}" data-name="${u.name}" style="padding: 4px 8px; font-size: 11px; margin-right: 6px;" title="Reset Password to 12345">
                      <i class="fa-solid fa-key"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm btn-award-card" data-id="${u._id}" data-name="${u.name}" style="padding: 4px 8px; font-size: 11px; margin-right: 6px;" title="Award Scratch Card">
                      <i class="fa-solid fa-gift"></i>
                    </button>
                    ${showDeleteBtn ? `
                      <button class="btn-delete btn-delete-user" data-id="${u._id}" title="Delete User">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindAdminUsersEvents() {
  // Approve user action
  document.querySelectorAll('.btn-approve-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-id');
      const submitBtn = btn;
      submitBtn.disabled = true;
      
      const res = await apiCall(`/api/admin/approve-admin/${userId}`, 'PUT');
      if (res.success) {
        showToast('Admin account approved successfully!', 'success');
        renderAdmin();
      } else {
        showToast(res.message || 'Failed to approve admin.', 'error');
        submitBtn.disabled = false;
      }
    });
  });

  // Award scratch card action
  document.querySelectorAll('.btn-award-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id');
      const userName = btn.getAttribute('data-name');
      openAwardModal(userId, userName);
    });
  });

  // Delete user action
  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this user account? This cannot be undone.')) {
        const res = await apiCall(`/api/admin/users/${userId}`, 'DELETE');
        if (res.success) {
          showToast('User deleted successfully.', 'success');
          renderAdmin();
        } else {
          showToast(res.message || 'Failed to delete user.', 'error');
        }
      }
    });
  });

  // Reset password action
  document.querySelectorAll('.btn-reset-password').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-id');
      const userName = btn.getAttribute('data-name');
      if (confirm(`Are you sure you want to reset the password for ${userName} to "12345"?`)) {
        const res = await apiCall(`/api/admin/users/${userId}/reset-password`, 'PUT');
        if (res.success) {
          showToast(res.message, 'success');
        } else {
          showToast(res.message || 'Failed to reset password.', 'error');
        }
      }
    });
  });
}

function renderAdminRequestsTab(requests) {
  if (requests.length === 0) {
    return `<div style="text-align: center; padding: 40px;"><p style="color: var(--text-muted);">No product requests submitted yet.</p></div>`;
  }

  const statuses = ['Pending', 'Reviewed', 'Added', 'Rejected'];

  return `
    <div class="table-responsive">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Room / Block</th>
            <th>Phone</th>
            <th>Requested Details</th>
            <th>Date Submitted</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(req => {
            const date = new Date(req.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return `
              <tr data-req-row-id="${req._id}">
                <td><strong>${req.name}</strong></td>
                <td>${req.roomNo}</td>
                <td>${req.phone}</td>
                <td><div style="max-width: 250px; white-space: pre-wrap; font-size: 13px;">${req.requestText}</div></td>
                <td>${date}</td>
                <td>
                  <select class="admin-status-select req-status-updater" data-id="${req._id}" style="padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-light); color: var(--text-main); font-size: 12px; font-weight: 600;">
                    ${statuses.map(st => `
                      <option value="${st}" ${req.status === st ? 'selected' : ''}>${st}</option>
                    `).join('')}
                  </select>
                </td>
                <td>
                  <div class="admin-table-actions">
                    <button class="btn-delete btn-delete-request" data-id="${req._id}" title="Delete Request"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindAdminRequestsEvents() {
  document.querySelectorAll('.req-status-updater').forEach(select => {
    select.addEventListener('change', async () => {
      const requestId = select.getAttribute('data-id');
      const newStatus = select.value;
      
      const res = await apiCall(`/api/requests/admin/${requestId}`, 'PUT', { status: newStatus });
      if (res.success) {
        showToast('Request status updated successfully.', 'success');
        renderAdmin();
      } else {
        showToast(res.message || 'Failed to update request status.', 'error');
      }
    });
  });

  document.querySelectorAll('.btn-delete-request').forEach(btn => {
    btn.addEventListener('click', async () => {
      const requestId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this product request? This cannot be undone.')) {
        const res = await apiCall(`/api/requests/admin/${requestId}`, 'DELETE');
        if (res.success) {
          showToast('Product request deleted successfully.', 'success');
          renderAdmin();
        } else {
          showToast(res.message || 'Failed to delete request.', 'error');
        }
      }
    });
  });
}

function renderAdminTeamTab(team) {
  return `
    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">Hostel Bites Team Roster</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);">Add or remove cards displayed on the public About Us page.</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-team-member" style="padding: 8px 16px; font-size: 12px;"><i class="fa-solid fa-plus"></i> Add Team Member</button>
    </div>

    ${team.length === 0 ? `
      <div style="text-align: center; padding: 40px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);"><p style="color: var(--text-muted); margin: 0;">No team members added yet. Click the button to add the first one.</p></div>
    ` : `
      <div class="table-responsive">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Avatar</th>
              <th>Name</th>
              <th>Role</th>
              <th>Bio</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${team.map(member => `
              <tr data-team-row-id="${member._id}">
                <td>
                  <div style="width: 40px; height: 40px; border-radius: 50%; background-color: var(--primary-light-color); color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 16px; border: 1px solid var(--primary-color);">
                    <i class="fa-solid fa-user"></i>
                  </div>
                </td>
                <td><strong>${member.name}</strong></td>
                <td><span class="category-count" style="background-color: var(--bg-light); color: var(--primary-color); font-weight: 600;">${member.role || 'N/A'}</span></td>
                <td><div style="max-width: 300px; white-space: pre-wrap; font-size: 13px; font-style: italic; color: var(--text-muted);">${member.bio || 'No bio provided'}</div></td>
                <td>
                  <div class="admin-table-actions">
                    <button class="btn-delete btn-delete-team-member" data-id="${member._id}" title="Remove Member"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

function bindAdminTeamEvents() {
  const addBtn = document.getElementById('btn-add-team-member');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openAddTeamMemberModal();
    });
  }

  document.querySelectorAll('.btn-delete-team-member').forEach(btn => {
    btn.addEventListener('click', async () => {
      const memberId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to remove this team member?')) {
        const res = await apiCall(`/api/team/admin/${memberId}`, 'DELETE');
        if (res.success) {
          showToast('Team member removed successfully.', 'success');
          renderAdmin();
        } else {
          showToast(res.message || 'Failed to remove team member.', 'error');
        }
      }
    });
  });
}

function openAddTeamMemberModal() {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (!modal || !title || !body) return;

  title.textContent = 'Add New Team Member';
  body.innerHTML = `
    <form id="modal-team-member-form">
      <div class="form-group" style="margin-bottom: 14px;">
        <label>Name (Required)</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-user"></i>
          <input type="text" id="modal-team-name" placeholder="e.g. Ankit Singh" required>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Role (Optional)</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-briefcase"></i>
          <input type="text" id="modal-team-role" placeholder="e.g. Co-Founder / Lead Developer">
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 20px;">
        <label>Bio (Optional)</label>
        <textarea id="modal-team-bio" placeholder="e.g. Loves building clean food platforms and late night coffee..." style="width: 100%; height: 80px; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-light); color: var(--text-main); font-family: inherit; font-size: 14px; resize: none;"></textarea>
      </div>

      <button type="submit" class="btn btn-primary btn-block"><i class="fa-solid fa-check"></i> Add Member</button>
    </form>
  `;

  restoreDefaultModalClose();
  modal.classList.add('open');

  const form = document.getElementById('modal-team-member-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('modal-team-name').value.trim();
    const role = document.getElementById('modal-team-role').value.trim();
    const bio = document.getElementById('modal-team-bio').value.trim();

    const res = await apiCall('/api/team/admin', 'POST', { name, role, bio });
    if (res.success) {
      showToast('Team member added successfully!', 'success');
      modal.classList.remove('open');
      renderAdmin();
    } else {
      showToast(res.message || 'Failed to add team member.', 'error');
    }
  });
}

function renderAdminShopTab() {
  return `
    <div class="admin-shop-config-grid">
      <!-- Manual Override Toggles -->
      <div class="admin-config-card">
        <h3>Manual Operating Control</h3>
        <p style="font-size: 13px; color: var(--text-muted);">Override the automatic schedule. Forcing closed blocks all customer order submissions.</p>
        
        <div class="admin-toggle-wrapper">
          <button class="admin-toggle-btn ${state.shop.isManuallyClosed ? 'active' : ''}" id="toggle-manual-closed">
            <span>Force Closed</span>
            <i class="fa-solid ${state.shop.isManuallyClosed ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size: 20px;"></i>
          </button>
 
          <button class="admin-toggle-btn ${state.shop.isManuallyOpened ? 'active' : ''}" id="toggle-manual-opened">
            <span>Force Opened</span>
            <i class="fa-solid ${state.shop.isManuallyOpened ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size: 20px;"></i>
          </button>
        </div>
      </div>

      <!-- Hostel Block Controls -->
      <div class="admin-config-card">
        <h3>Hostel Block Controls</h3>
        <p style="font-size: 13px; color: var(--text-muted);">Enable or disable order taking for specific hostel blocks.</p>
        
        <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 12px;">
          <!-- Block X Toggle -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-light); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">Block X Orders</span>
              <span style="font-size: 11px; color: ${state.shop.isBlockXOpen ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">
                ${state.shop.isBlockXOpen ? 'Accepting Orders' : 'Blocked'}
              </span>
            </div>
            <button class="admin-toggle-btn-small" id="toggle-block-x" style="font-size: 24px; color: ${state.shop.isBlockXOpen ? 'var(--success-color)' : 'var(--text-muted)'}; background: none; border: none; cursor: pointer;">
              <i class="fa-solid ${state.shop.isBlockXOpen ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
            </button>
          </div>

          <!-- Block Y Toggle -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-light); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">Block Y Orders</span>
              <span style="font-size: 11px; color: ${state.shop.isBlockYOpen ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">
                ${state.shop.isBlockYOpen ? 'Accepting Orders' : 'Blocked'}
              </span>
            </div>
            <button class="admin-toggle-btn-small" id="toggle-block-y" style="font-size: 24px; color: ${state.shop.isBlockYOpen ? 'var(--success-color)' : 'var(--text-muted)'}; background: none; border: none; cursor: pointer;">
              <i class="fa-solid ${state.shop.isBlockYOpen ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
            </button>
          </div>

          <!-- Block Z Toggle -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-light); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; font-size: 14px; color: var(--text-main);">Block Z Orders</span>
              <span style="font-size: 11px; color: ${state.shop.isBlockZOpen ? 'var(--success-color)' : 'var(--danger-color)'}; font-weight: 600;">
                ${state.shop.isBlockZOpen ? 'Accepting Orders' : 'Blocked'}
              </span>
            </div>
            <button class="admin-toggle-btn-small" id="toggle-block-z" style="font-size: 24px; color: ${state.shop.isBlockZOpen ? 'var(--success-color)' : 'var(--text-muted)'}; background: none; border: none; cursor: pointer;">
              <i class="fa-solid ${state.shop.isBlockZOpen ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Schedule Adjustment -->
      <div class="admin-config-card">
        <h3>Automatic Operating Hours</h3>
        <p style="font-size: 13px; color: var(--text-muted);">Set the hours when the Store is open for customers. Format: 24h clock.</p>
        
        <form id="admin-shop-hours-form">
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 12px;">Opening Hour (0-23)</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-clock"></i>
              <input type="number" id="opening-hour" min="0" max="23" value="${state.shop.openHour}" required>
            </div>
          </div>
 
          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-size: 12px;">Closing Hour (1-24)</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-moon"></i>
              <input type="number" id="closing-hour" min="1" max="24" value="${state.shop.closeHour}" required>
            </div>
          </div>
 
          <button type="submit" class="btn btn-primary btn-sm btn-block">Apply Schedule Hours</button>
        </form>
      </div>
    </div>
  `;
}

function bindAdminShopEvents() {
  const closedBtn = document.getElementById('toggle-manual-closed');
  if (closedBtn) {
    closedBtn.addEventListener('click', async () => {
      const active = !state.shop.isManuallyClosed;
      
      const payload = {
        isManuallyClosed: active,
        isManuallyOpened: false // Mutually exclusive override
      };

      const res = await apiCall('/api/admin/shop/status', 'POST', payload);
      if (res.success) {
        showToast(res.message, 'success');
        
        // Refresh Shop config
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Config update failed.', 'error');
      }
    });
  }

  const openedBtn = document.getElementById('toggle-manual-opened');
  if (openedBtn) {
    openedBtn.addEventListener('click', async () => {
      const active = !state.shop.isManuallyOpened;
      
      const payload = {
        isManuallyOpened: active,
        isManuallyClosed: false // Mutually exclusive override
      };

      const res = await apiCall('/api/admin/shop/status', 'POST', payload);
      if (res.success) {
        showToast(res.message, 'success');
        
        // Refresh Shop config
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Config update failed.', 'error');
      }
    });
  }

  // Block X Toggle Action
  const toggleBlockX = document.getElementById('toggle-block-x');
  if (toggleBlockX) {
    toggleBlockX.addEventListener('click', async () => {
      const active = !state.shop.isBlockXOpen;
      const res = await apiCall('/api/admin/shop/status', 'POST', { isBlockXOpen: active });
      if (res.success) {
        showToast(`Block X ordering ${active ? 'enabled' : 'disabled'}.`, 'success');
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Config update failed.', 'error');
      }
    });
  }

  // Block Y Toggle Action
  const toggleBlockY = document.getElementById('toggle-block-y');
  if (toggleBlockY) {
    toggleBlockY.addEventListener('click', async () => {
      const active = !state.shop.isBlockYOpen;
      const res = await apiCall('/api/admin/shop/status', 'POST', { isBlockYOpen: active });
      if (res.success) {
        showToast(`Block Y ordering ${active ? 'enabled' : 'disabled'}.`, 'success');
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Config update failed.', 'error');
      }
    });
  }

  // Block Z Toggle Action
  const toggleBlockZ = document.getElementById('toggle-block-z');
  if (toggleBlockZ) {
    toggleBlockZ.addEventListener('click', async () => {
      const active = !state.shop.isBlockZOpen;
      const res = await apiCall('/api/admin/shop/status', 'POST', { isBlockZOpen: active });
      if (res.success) {
        showToast(`Block Z ordering ${active ? 'enabled' : 'disabled'}.`, 'success');
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Config update failed.', 'error');
      }
    });
  }

  // Update schedule hours form
  const form = document.getElementById('admin-shop-hours-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const openHour = parseInt(document.getElementById('opening-hour').value);
      const closeHour = parseInt(document.getElementById('closing-hour').value);

      if (openHour >= closeHour) {
        showToast('Opening hour must be before closing hour.', 'error');
        return;
      }

      const res = await apiCall('/api/admin/shop/status', 'POST', { openHour, closeHour });
      if (res.success) {
        showToast('Operating schedule updated.', 'success');
        await checkShopStatus();
        renderAdmin();
      } else {
        showToast(res.message || 'Failed updating schedule.', 'error');
      }
    });
  }
}

// --- Menu CRUD Modal Manager ---
function openMenuModal(item = null) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (!modal || !title || !body) return;

  const isEdit = !!item;
  title.textContent = isEdit ? `Edit Menu Item: ${item.name}` : 'Add Menu Item';

  const categories = ['Kurkure', 'Chips', 'Instants', 'Drinks', 'Biscuits', 'Chocolates', 'Namkeen'];

  body.innerHTML = `
    <form id="modal-menu-form">
      <div class="form-group" style="margin-bottom: 14px;">
        <label>Name</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-tag"></i>
          <input type="text" id="modal-item-name" value="${isEdit ? item.name : ''}" required>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Price (Rs.)</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-indian-rupee-sign"></i>
          <input type="number" id="modal-item-price" step="1" min="0" value="${isEdit ? item.price : ''}" required>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Stock Level</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-boxes-stacked"></i>
          <input type="number" id="modal-item-stock" step="1" min="0" value="${isEdit ? item.stock : 50}" required>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Category</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-list-ul"></i>
          <select id="modal-item-category" required>
            <option value="" disabled ${!isEdit ? 'selected' : ''}>Select Category</option>
            ${categories.map(cat => `
              <option value="${cat}" ${isEdit && item.category === cat ? 'selected' : ''}>${cat}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Image URL (Unsplash or direct link)</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-image"></i>
          <input type="url" id="modal-item-image" value="${isEdit ? item.image : ''}" placeholder="https://images.unsplash.com/...">
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 14px;">
        <label>Description</label>
        <div class="input-wrapper">
          <i class="fa-solid fa-align-left" style="top: 18px;"></i>
          <textarea id="modal-item-description" rows="2" style="padding-left: 46px;">${isEdit ? item.description : ''}</textarea>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 20px;">
        <label class="redeem-checkbox-wrapper">
          <input type="checkbox" id="modal-item-available" ${!isEdit || item.isAvailable ? 'checked' : ''}>
          Item is available for ordering
        </label>
      </div>

      <button type="submit" class="btn btn-primary btn-block">${isEdit ? 'Save Changes' : 'Create Item'}</button>
    </form>
  `;

  modal.classList.add('open');

  // Bind Submit event
  const form = document.getElementById('modal-menu-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('modal-item-name').value;
      const price = parseInt(document.getElementById('modal-item-price').value, 10);
      const stock = parseInt(document.getElementById('modal-item-stock').value, 10);
      const category = document.getElementById('modal-item-category').value;
      const image = document.getElementById('modal-item-image').value;
      const description = document.getElementById('modal-item-description').value;
      const isAvailable = document.getElementById('modal-item-available').checked;

      const payload = { name, price, stock, category, image, description, isAvailable };

      let res;
      if (isEdit) {
        res = await apiCall(`/api/menu/${item._id}`, 'PUT', payload);
      } else {
        res = await apiCall('/api/menu', 'POST', payload);
      }

      if (res.success) {
        showToast(isEdit ? 'Menu item updated!' : 'Menu item created!', 'success');
        modal.classList.remove('open');
        renderAdmin();
      } else {
        showToast(res.message || 'Operation failed', 'error');
      }
    });
  }
}

// --- Admin Award Scratch Card Modal Manager ---
function openAwardModal(userId, userName) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  if (!modal || !title || !body) return;

  title.textContent = `Award Scratch Card to ${userName}`;

  const rewards = [
    { index: 0, desc: '1 Rs off on order above 30' },
    { index: 1, desc: '2 Rs off on order above 60' },
    { index: 2, desc: '3 Rs off on order above 90' },
    { index: 3, desc: '5% off on order above 100' },
    { index: 4, desc: '10% off on order above 200' },
    { index: 5, desc: 'One item free on order above 200' },
    { index: 6, desc: 'Better luck next time' }
  ];

  body.innerHTML = `
    <form id="modal-award-form">
      <div class="form-group" style="margin-bottom: 20px;">
        <label for="modal-reward-select">Select Reward Type</label>
        <div class="input-wrapper" style="margin-top: 8px;">
          <i class="fa-solid fa-gift" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--primary-color);"></i>
          <select id="modal-reward-select" required style="width: 100%; padding-left: 46px; height: 42px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-light); color: var(--text-main);">
            <option value="" disabled selected>Select a reward to award</option>
            ${rewards.map(r => `
              <option value="${r.index}">${r.desc}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <button type="submit" class="btn btn-primary btn-block"><i class="fa-solid fa-paper-plane"></i> Send Scratch Card</button>
    </form>
  `;

  modal.classList.add('open');

  const form = document.getElementById('modal-award-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rewardIndex = parseInt(document.getElementById('modal-reward-select').value, 10);

      const res = await apiCall('/api/rewards/admin/give', 'POST', {
        userId,
        rewardIndex
      });

      if (res.success) {
        showToast(res.message, 'success');
        modal.classList.remove('open');
        renderAdmin();
      } else {
        showToast(res.message || 'Failed to award card', 'error');
      }
    });
  }
}

// Close Modal Bindings
const closeModalElements = [
  document.getElementById('modal-close-btn'),
  document.getElementById('app-modal')
];

closeModalElements.forEach(el => {
  if (el) {
    el.addEventListener('click', (e) => {
      // If modal overlay is clicked or close btn is clicked
      if (e.target === el || el.id === 'modal-close-btn') {
        const modal = document.getElementById('app-modal');
        if (modal) modal.classList.remove('open');
      }
    });
  }
});

// --- General App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initTheme();

  // Bind theme toggle
  const themeToggle = document.getElementById('theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      toggleTheme();
    });
  }

  // Bind Drawer menu controls
  const trigger = document.getElementById('mobile-menu-trigger');
  const close = document.getElementById('mobile-drawer-close');
  const drawer = document.getElementById('mobile-drawer');
  const overlay = document.getElementById('drawer-overlay');

  if (trigger && drawer && overlay) {
    trigger.addEventListener('click', () => {
      drawer.classList.add('open');
      overlay.classList.add('open');
    });
  }

  if (close && drawer && overlay) {
    close.addEventListener('click', () => {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
    });
    overlay.addEventListener('click', () => {
      drawer.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Bind navbar profile dropdown toggle
  const profileTriggerBtn = document.getElementById('profile-dropdown-btn');
  const profileDropdown = document.getElementById('user-profile-menu');
  if (profileTriggerBtn && profileDropdown) {
    profileTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('open');
    });
    
    // Close dropdown on click elsewhere
    document.addEventListener('click', () => {
      profileDropdown.classList.remove('open');
    });
  }

  // Bind logout action
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logout();
    });
  }

  // Load state items
  updateCartCounter();
  updateAuthNavbar();
  
  // Refresh user data & points on start if token exists
  if (state.token) {
    fetchUserProfile();
  }

  // Initial shop status check
  checkShopStatus();

  // Router listeners
  window.addEventListener('hashchange', handleRouting);
  
  // Trigger initial routing
  handleRouting();

  // Start background polling
  startBackgroundPolling();

  // Start real-time countdown timer loop for active orders
  startRealtimeTimerLoop();
});

function startRealtimeTimerLoop() {
  setInterval(() => {
    document.querySelectorAll('.delivery-timer').forEach(el => {
      const createdAtStr = el.getAttribute('data-created');
      const createdAt = new Date(createdAtStr);
      const elapsedMs = new Date() - createdAt;
      const totalDurationMs = 7 * 60 * 1000;
      const remainingMs = totalDurationMs - elapsedMs;
      
      if (remainingMs > 0) {
        const totalSecs = Math.floor(remainingMs / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        el.innerHTML = `<i class="fa-solid fa-clock"></i> Deliver in: <strong style="color: var(--warning-color);">${timeStr}</strong>`;
      } else {
        el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <strong style="color: var(--danger-color);">Late Delivery (10% Penalty Applied)</strong>`;
        
        // Proactively update prices in DOM
        const card = el.closest('.order-history-card') || el.closest('tr');
        if (card) {
          const totalEl = card.querySelector('.total-price') || card.querySelector('.admin-amount-cell');
          const origVal = parseFloat(el.getAttribute('data-amount-paid'));
          if (totalEl && origVal) {
            const penalty = Math.floor(origVal / 10);
            const discounted = Math.max(0, origVal - penalty);
            if (!totalEl.querySelector('small')) {
              totalEl.innerHTML = `Rs. ${discounted} <small style="text-decoration: line-through; color: var(--text-muted); font-size: 11px;">Rs. ${origVal}</small>`;
            }
          }
        }
      }
    });
  }, 1000);
}

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Play a premium high-pitched pleasant chime (double-note ding-dong)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(830.61, now); // Ab5
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.1); // C6
    gain2.gain.setValueAtTime(0.2, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.error('Notification sound error:', err);
  }
}

let pollingIntervalId = null;

function startBackgroundPolling() {
  if (pollingIntervalId) clearInterval(pollingIntervalId);

  pollingIntervalId = setInterval(async () => {
    try {
      // 1. Always poll shop status to keep the open/closed banner and state in sync
      const shopRes = await apiCall('/api/shop/status');
      if (shopRes.success) {
        state.shop = shopRes.data;
        updateShopUI();
        
        const hash = window.location.hash || '#/home';
        // Auto-navigate user to shop-closed if shop closes, or back to menu if shop opens
        if (!state.shop.isOpen && hash !== '#/shop-closed' && hash !== '#/login' && hash !== '#/home' && hash !== '#/admin') {
          const isAdmin = state.user && state.user.role === 'admin';
          if (!isAdmin) {
            navigate('#/shop-closed');
          }
        } else if (state.shop.isOpen && hash === '#/shop-closed') {
          navigate('#/menu');
        }
      }

      // 2. Poll menu data to update stocks dynamically
      const menuRes = await apiCall('/api/menu');
      if (menuRes.success) {
        state.menu = menuRes.data;
        
        const hash = window.location.hash || '#/home';
        // If we are on the menu view, update menu card stock badges and footer controls inline
        if (hash === '#/menu') {
          state.menu.forEach(item => {
            syncMenuCardDOM(item._id);
          });
        }
        
        // If we are on the admin page, under the "menu" tab, update stocks/availability in the table inline
        if (hash === '#/admin' && state.adminActiveTab === 'menu') {
          state.menu.forEach(item => {
            const row = document.querySelector(`tr[data-item-row-id="${item._id}"]`);
            if (row) {
              const stockQtyEl = row.querySelector('.item-stock-qty');
              if (stockQtyEl) {
                stockQtyEl.textContent = item.stock;
              }
              const statusEl = row.querySelector('.status-badge');
              if (statusEl) {
                statusEl.className = `status-badge ${item.isAvailable ? 'completed' : 'cancelled'}`;
                statusEl.textContent = item.isAvailable ? 'Available' : 'Sold Out';
              }
              const priceEl = row.querySelector('td:nth-child(3) strong');
              if (priceEl) {
                priceEl.textContent = `Rs. ${item.price}`;
              }
            }
          });
        }
      }

      // 3. Poll user orders / admin orders
      if (state.token && state.user) {
        const hash = window.location.hash || '#/home';
        
        // A. Admin order log polling
        if (state.user.role === 'admin') {
          const adminOrdersRes = await apiCall('/api/admin/orders');
          if (adminOrdersRes.success) {
            const orders = adminOrdersRes.data;

            // Check for new pending orders to trigger notification sound
            if (!state.knownOrderIds) {
              // Initial load: record existing orders
              state.knownOrderIds = orders.map(o => o._id);
            } else {
              let hasNewPendingOrder = false;
              orders.forEach(order => {
                if (!state.knownOrderIds.includes(order._id)) {
                  state.knownOrderIds.push(order._id);
                  if (order.status === 'Pending') {
                    hasNewPendingOrder = true;
                  }
                }
              });
              if (hasNewPendingOrder) {
                playNotificationSound();
                showToast('New customer order received!', 'success');
              }
            }

            // Update DOM if currently on Admin page and Orders tab
            if (hash === '#/admin' && state.adminActiveTab === 'orders') {
              const existingRows = document.querySelectorAll('tr[data-order-row-id]');
              const fetchedIds = orders.map(o => o._id);
              const existingIds = Array.from(existingRows).map(row => row.getAttribute('data-order-row-id'));
              const existingStatuses = Array.from(existingRows).map(row => {
                const sel = row.querySelector('.order-status-updater');
                return sel ? sel.value : '';
              });
              
              const statusesMatch = orders.every((o, idx) => o.status === existingStatuses[idx]);
              const listsMatch = fetchedIds.length === existingIds.length && 
                                 fetchedIds.every((id, idx) => id === existingIds[idx]) &&
                                 statusesMatch;
              
              if (!listsMatch) {
                const panel = document.querySelector('.admin-panel-card');
                if (panel) {
                  const scrollY = window.scrollY;
                  panel.innerHTML = renderAdminOrdersTab(orders);
                  bindAdminOrdersEvents();
                  window.scrollTo(0, scrollY);
                }
              } else {
                orders.forEach(order => {
                  const row = document.querySelector(`tr[data-order-row-id="${order._id}"]`);
                  if (row) {
                    const select = row.querySelector('.order-status-updater');
                    if (select && document.activeElement !== select) {
                      select.value = order.status;
                    }
                  }
                });
              }

              // Update badge text on Admin tab
              const ordersTabBtn = document.querySelector('.admin-tab-btn[data-tab="orders"]');
              if (ordersTabBtn) {
                ordersTabBtn.innerHTML = `<i class="fa-solid fa-rectangle-list"></i> Customer Orders (${orders.length})`;
              }
            }
          }
        }

        // B. Customer order tracking polling
        if (hash === '#/orders') {
          const myOrdersRes = await apiCall('/api/orders/my-orders');
          if (myOrdersRes.success) {
            const orders = myOrdersRes.data;
            orders.forEach(order => {
              const card = document.querySelector(`div[data-order-card-id="${order._id}"]`);
              if (card) {
                const badge = card.querySelector('.status-badge');
                if (badge) {
                  const normalizedStatusClass = order.status.toLowerCase().replace(/ /g, '-');
                  badge.className = `status-badge ${normalizedStatusClass}`;
                  badge.textContent = order.status;
                }
                
                // Hide/remove timer if completed/cancelled
                if (['Completed', 'Cancelled'].includes(order.status)) {
                  const timerEl = card.querySelector('.delivery-timer');
                  if (timerEl) {
                    timerEl.remove();
                  }
                  
                  // Also ensure amountPaid is correctly formatted
                  const totalEl = card.querySelector('.total-price');
                  if (totalEl) {
                    if (order.isLate) {
                      totalEl.innerHTML = `Rs. ${order.amountPaid} <small style="text-decoration: line-through; color: var(--text-muted); font-size: 11px; font-weight: normal;">Rs. ${order.originalAmountPaid}</small>`;
                    } else {
                      totalEl.innerHTML = `Rs. ${order.amountPaid}`;
                    }
                  }
                }
              }
            });
          }
        }

        // C. Customer admin-award scratch card polling
        if (state.user) {
          checkUnnotifiedAdminRewards();
        }
      }
    } catch (err) {
      console.error('Background polling error:', err);
    }
  }, 6000);
}
