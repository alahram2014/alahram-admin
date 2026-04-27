const CONFIG = {
  baseUrl: 'https://upzuslyqfcvpbkqyzyxp.supabase.co/rest/v1',
  apiKey: 'sb_publishable_vpqJxVuMbYbm0y3VvVhuJw_FBQkLvYg',
  whatsapp: localStorage.getItem('support_whatsapp') || '201552670465',
};

const STATUSES = ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'paid'];
const DASHBOARD_USERS_KEY = 'dashboard_users';
const SUPPORT_WA_KEY = 'support_whatsapp';

let currentUser = null;

const DEFAULT_DASHBOARD_USERS = [
  {
    username: 'admin',
    password: 'Aa2020',
    role: 'admin',
    name: 'Admin',
    permissions: { orders: true, users: true, products: true, reports: true },
    active: true,
  },
  {
    username: 'manager',
    password: 'manager123',
    role: 'manager',
    name: 'Manager',
    permissions: { orders: true, users: false, products: false, reports: true },
    active: true,
  },
  {
    username: 'viewer',
    password: 'viewer123',
    role: 'viewer',
    name: 'Viewer',
    permissions: { orders: false, users: false, products: false, reports: true },
    active: true,
  },
];

const state = {
  section: 'home',
  tab: 'customers',
  search: '',
  reportStart: '',
  reportEnd: '',
  edit: null,
  dashboardUsers: [],
  repDetail: null,
  records: {
    companies: [],
    customers: [],
    salesReps: [],
    products: [],
    pricesCarton: [],
    pricesPack: [],
    orders: [],
    orderItems: [],
    vProducts: [],
    vTopProducts: [],
    vTopCompanies: [],
    vSalesDaily: [],
    vTopCustomers: [],
    vRepsPerformance: [],
    vDailyDeals: [],
    vFlashOffers: [],
  },
  maps: {
    company: new Map(),
    customer: new Map(),
    rep: new Map(),
    product: new Map(),
    carton: new Map(),
    pack: new Map(),
    itemsByOrder: new Map(),
  },
  orders: [],
};

const els = {};
[
  'menuBtn', 'notifBtn', 'menuFab', 'pageTitle', 'pageSub', 'sectionPill',
  'roleBadge', 'userBadge', 'statOrders', 'statSales', 'statCustomers', 'statProducts',
  'quickRail', 'latestOrders', 'latestCount', 'topProducts', 'topCompanies',
  'ordersBody', 'usersBody', 'dashUsersBody', 'productsBody', 'companiesBody',
  'dailySales', 'statusBreakdown', 'topCustomers', 'repPerformance', 'salesRange', 'statusTotal',
  'statusFilter', 'startDate', 'endDate', 'applyFilter', 'waInput', 'saveWa',
  'loginModal', 'loginModalBackdrop', 'loginUser', 'loginPass', 'loginBtn',
  'detailsModal', 'detailsModalBackdrop', 'detailsTitle', 'detailsSub', 'detailsBody',
  'editModal', 'editModalBackdrop', 'editTitle', 'editSub', 'editForm', 'saveEdit',
  'dashUserModal', 'dashUserModalBackdrop', 'dashUserForm', 'createDashUser', 'addDashUser',
  'menuSheet', 'menuSheetBackdrop', 'toast'
].forEach((id) => { els[id] = document.getElementById(id); });

const SHEETS = [
  ['menuSheet', 'menuSheetBackdrop'],
  ['loginModal', 'loginModalBackdrop'],
  ['detailsModal', 'detailsModalBackdrop'],
  ['editModal', 'editModalBackdrop'],
  ['dashUserModal', 'dashUserModalBackdrop'],
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function int(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function money(value) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value ?? 0))} EGP`;
}

function fmtDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function toast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add('hidden'), 2200);
}

function emptyCard(message = 'لا توجد بيانات') {
  return `
    <div class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(message)}</strong>
          <span>—</span>
        </div>
        <span class="badge neutral">—</span>
      </div>
    </div>
  `;
}

function svgPlaceholder(label) {
  const init = String(label || 'A').trim().slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" rx="120" fill="#111"/><circle cx="400" cy="400" r="250" fill="#d8b35a" opacity="0.16"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#d8b35a" font-size="220" font-family="Arial" font-weight="700">${init}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function rolePermissions(role) {
  if (role === 'admin') return { orders: true, users: true, products: true, reports: true };
  if (role === 'manager') return { orders: true, users: false, products: false, reports: true };
  return { orders: false, users: false, products: false, reports: true };
}

function normalizeDashboardUser(user) {
  const role = String(user?.role || 'viewer');
  const permissions = user?.permissions && typeof user.permissions === 'object'
    ? {
        orders: !!user.permissions.orders,
        users: !!user.permissions.users,
        products: !!user.permissions.products,
        reports: !!user.permissions.reports,
      }
    : rolePermissions(role);
  return {
    username: String(user?.username || '').trim(),
    password: String(user?.password || '').trim(),
    role,
    name: String(user?.name || user?.username || '').trim(),
    permissions,
    active: user?.active !== false,
  };
}

function seedDashboardUsers() {
  const existing = loadJSON(DASHBOARD_USERS_KEY, null);
  const list = Array.isArray(existing) && existing.length ? existing : DEFAULT_DASHBOARD_USERS;
  state.dashboardUsers = list.map(normalizeDashboardUser);
  saveJSON(DASHBOARD_USERS_KEY, state.dashboardUsers);
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

function permissions() {
  return currentUser?.permissions || { orders: false, users: false, products: false, reports: false };
}

function canAccessSection(section) {
  if (!currentUser) return false;
  if (section === 'home') return true;
  if (section === 'settings') return isAdmin();
  if (section === 'companies') return isAdmin();
  if (section === 'orders') return !!permissions().orders;
  if (section === 'users') return !!permissions().users;
  if (section === 'products') return !!permissions().products;
  if (section === 'reports') return !!permissions().reports;
  return true;
}

function sectionMeta(section) {
  const map = {
    home: ['الرئيسية', 'مراقبة تشغيلية سريعة'],
    orders: ['الطلبات', 'فتح التفاصيل وتغيير الحالة'],
    users: ['المستخدمون', 'العملاء والمناديب'],
    products: ['المنتجات', 'تعديل الاسم والسعر والظهور'],
    companies: ['الشركات', 'تحكم باللوجو والظهور'],
    reports: ['التقارير', 'المؤشرات والمناديب'],
    settings: ['الإعدادات', 'الاتصال والصلاحيات'],
  };
  return map[section] || map.home;
}

function setSheet(id, show) {
  const sheet = els[id];
  const backdropId = `${id}Backdrop`;
  const backdrop = els[backdropId];
  if (sheet) sheet.classList.toggle('hidden', !show);
  if (backdrop) backdrop.classList.toggle('hidden', !show);
}

function hideAllSheets() {
  SHEETS.forEach(([id]) => setSheet(id, false));
}

function setSection(section) {
  const target = canAccessSection(section) ? section : (['home', 'orders', 'users', 'products', 'companies', 'reports', 'settings'].find(canAccessSection) || 'home');
  state.section = target;
  const [title, subtitle] = sectionMeta(target);
  els.pageTitle.textContent = title;
  els.pageSub.textContent = subtitle;
  els.sectionPill.textContent = target;

  document.querySelectorAll('.section').forEach((sec) => {
    sec.classList.toggle('active', sec.dataset.sec === target);
  });

  document.querySelectorAll('[data-sec]').forEach((btn) => {
    const allowed = canAccessSection(btn.dataset.sec);
    if (btn.classList.contains('dock__item') || btn.classList.contains('sheet-link')) {
      btn.classList.toggle('active', btn.dataset.sec === target);
    }
    if (!allowed && (btn.classList.contains('dock__item') || btn.classList.contains('sheet-link'))) {
      btn.style.display = 'none';
    } else if (btn.classList.contains('dock__item') || btn.classList.contains('sheet-link')) {
      btn.style.display = '';
    }
  });

  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.style.display = canAccessSection(btn.dataset.go) ? '' : 'none';
  });
}

function renderAuthState() {
  if (!currentUser) {
    els.roleBadge.textContent = '-';
    els.userBadge.textContent = '-';
    document.body.classList.add('locked');
    setSheet('loginModal', true);
    return;
  }
  document.body.classList.remove('locked');
  document.body.classList.toggle('admin', isAdmin());
  els.roleBadge.textContent = currentUser.role;
  els.userBadge.textContent = currentUser.name || currentUser.username || '-';
  setSheet('loginModal', false);
}

function login() {
  const username = els.loginUser.value.trim();
  const password = els.loginPass.value.trim();
  if (!username || !password) return toast('أدخل اسم المستخدم وكلمة المرور');

  if (username === 'admin' && password === 'Aa2020') {
    currentUser = { username: 'admin', name: 'Admin', role: 'admin', permissions: rolePermissions('admin') };
    renderAuthState();
    renderAll();
    setSection('home');
    toast('مرحبًا Admin');
    return;
  }

  const found = state.dashboardUsers.find((u) => u.active !== false && u.username === username && u.password === password);
  if (!found) return toast('بيانات الدخول غير صحيحة');

  currentUser = {
    username: found.username,
    name: found.name || found.username,
    role: found.role,
    permissions: found.permissions || rolePermissions(found.role),
  };
  renderAuthState();
  renderAll();
  setSection('home');
  toast(`مرحبًا ${currentUser.name}`);
}

function logout() {
  currentUser = null;
  state.repDetail = null;
  renderAuthState();
  setSection('home');
  hideAllSheets();
  setSheet('loginModal', true);
}

function apiQuery(table, params = {}) {
  const url = new URL(`${CONFIG.baseUrl}/${table}`);
  Object.keys(params).forEach((k) => {
    if (params[k]) url.searchParams.append(k, params[k]);
  });
  return fetch(url, {
    method: 'GET',
    headers: {
      apikey: CONFIG.apiKey,
      Authorization: `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    }
  }).then((res) => res.json());
}

async function apiMutate(table, params = {}, body = {}) {
  const url = new URL(`${CONFIG.baseUrl}/${table}`);
  Object.keys(params).forEach((k) => {
    if (params[k]) url.searchParams.append(k, params[k]);
  });
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: CONFIG.apiKey,
      Authorization: `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

function normalizeRows(value) {
  return Array.isArray(value) ? value : [];
}

function searchValue(value) {
  const q = state.search.trim().toLowerCase();
  if (!q) return true;
  return String(value ?? '').toLowerCase().includes(q);
}

function statusClass(status) {
  if (['paid', 'delivered', 'confirmed'].includes(status)) return 'good';
  if (['processing', 'shipped'].includes(status)) return 'warn';
  return 'bad';
}

function filteredSalesDaily() {
  const start = state.reportStart ? new Date(state.reportStart) : null;
  const end = state.reportEnd ? new Date(new Date(state.reportEnd).getTime() + 24 * 60 * 60 * 1000 - 1) : null;
  return state.records.vSalesDaily.filter((row) => {
    if (!row.day) return true;
    const d = new Date(row.day);
    if (Number.isNaN(d.getTime())) return true;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

function rebuildIndexes() {
  state.maps.company = new Map(state.records.companies.map((row) => [row.company_id, row]));
  state.maps.customer = new Map(state.records.customers.map((row) => [row.id, row]));
  state.maps.rep = new Map(state.records.salesReps.map((row) => [row.id, row]));
  state.maps.product = new Map();

  state.records.products.forEach((row) => state.maps.product.set(row.product_id, { ...row }));
  state.records.vProducts.forEach((row) => {
    const existing = state.maps.product.get(row.product_id) || {};
    state.maps.product.set(row.product_id, {
      ...existing,
      ...row,
      status: existing.status ?? row.status,
      visible: existing.visible ?? row.visible,
      has_carton: existing.has_carton ?? row.has_carton,
      has_pack: existing.has_pack ?? row.has_pack,
    });
  });

  state.maps.carton = new Map(state.records.pricesCarton.map((row) => [`${row.product_id}::${row.tier_name}`, row]));
  state.maps.pack = new Map(state.records.pricesPack.map((row) => [`${row.product_id}::${row.tier_name}`, row]));
  state.maps.itemsByOrder = state.records.orderItems.reduce((map, item) => {
    const list = map.get(item.order_id) || [];
    list.push(item);
    map.set(item.order_id, list);
    return map;
  }, new Map());
}

function rebuildOrders() {
  state.orders = state.records.orders.map((order) => {
    const customer = order.customer_id ? state.maps.customer.get(order.customer_id) : null;
    const rep = order.user_id ? state.maps.rep.get(order.user_id) : null;
    const actor = order.user_type === 'rep' ? rep : (customer || rep);
    const items = state.maps.itemsByOrder.get(order.id) || [];
    return {
      ...order,
      customerName: actor?.name || '—',
      customerPhone: actor?.phone || '—',
      customerAddress: actor?.address || actor?.region || '—',
      customerLocation: actor?.location || '—',
      items: items.map((item) => {
        const product = state.maps.product.get(item.product_id);
        const company = product?.company_id ? state.maps.company.get(product.company_id) : null;
        const title = item.type === 'product'
          ? (product?.product_name || item.product_id)
          : item.type === 'deal'
            ? `صفقة ${item.product_id}`
            : item.type === 'flash'
              ? `عرض ${item.product_id}`
              : item.product_id;
        return { ...item, title, companyName: company?.company_name || '' };
      }),
    };
  });
}

async function loadData() {
  const jobs = {
    companies: apiQuery('companies', { select: '*', order: 'company_name.asc' }),
    customers: apiQuery('customers', { select: '*', order: 'created_at.desc' }),
    salesReps: apiQuery('sales_reps', { select: '*', order: 'created_at.desc' }),
    products: apiQuery('products', { select: '*', order: 'product_name.asc' }),
    pricesCarton: apiQuery('prices_carton', { select: '*' }),
    pricesPack: apiQuery('prices_pack', { select: '*' }),
    orders: apiQuery('orders', { select: '*', order: 'created_at.desc' }),
    orderItems: apiQuery('order_items', { select: '*', order: 'created_at.desc' }),
    vProducts: apiQuery('v_products', { select: '*', order: 'product_name.asc' }),
    vTopProducts: apiQuery('v_top_products', { select: '*' }),
    vTopCompanies: apiQuery('v_top_companies', { select: '*' }),
    vSalesDaily: apiQuery('v_sales_daily', { select: '*' }),
    vTopCustomers: apiQuery('v_top_customers', { select: '*' }),
    vRepsPerformance: apiQuery('v_reps_performance', { select: '*' }),
    vDailyDeals: apiQuery('v_daily_deals', { select: '*' }),
    vFlashOffers: apiQuery('v_flash_offers', { select: '*' }),
  };

  const results = await Promise.allSettled(
    Object.entries(jobs).map(async ([key, promise]) => [key, normalizeRows(await promise)])
  );

  const next = {};
  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      const [key, rows] = res.value;
      next[key] = rows;
    }
  });
  Object.keys(jobs).forEach((key) => { if (!next[key]) next[key] = []; });
  state.records = next;
  rebuildIndexes();
  rebuildOrders();
  renderAll();
  toast('تم تحميل البيانات');
}

function renderHome() {
  els.statOrders.textContent = int(state.orders.length);
  const totalSales = state.orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  els.statSales.textContent = money(totalSales);
  els.statCustomers.textContent = int(state.records.customers.length);
  els.statProducts.textContent = int(state.records.products.length);

  const latest = state.orders.slice(0, 8);
  els.latestCount.textContent = int(latest.length);
  els.latestOrders.innerHTML = latest.length ? latest.map((order) => `
    <article class="order-card item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(order.order_number)}</strong>
          <span>${esc(order.customerName)}</span>
        </div>
        <span class="badge ${statusClass(order.status)}">${esc(order.status || 'draft')}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>القيمة</span><strong>${money(order.total_amount)}</strong></div>
        <div class="meta-box"><span>التاريخ</span><strong>${fmtDate(order.created_at)}</strong></div>
      </div>
      <div class="actions">
        <button class="ghost-btn" data-act="view-order" data-id="${esc(order.id)}">عرض</button>
      </div>
    </article>
  `).join('') : emptyCard('لا توجد طلبات');

  const topProductsSource = state.records.vTopProducts.length ? state.records.vTopProducts : [...state.maps.product.values()].slice(0, 6).map((p) => ({
    product_name: p.product_name,
    product_id: p.product_id,
    total_qty: 0,
  }));
  els.topProducts.innerHTML = topProductsSource.length ? topProductsSource.map((row, index) => `
    <article class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.product_name || row.product_id || '—')}</strong>
          <span>${esc(row.product_id || '')}</span>
        </div>
        <span class="badge neutral">#${index + 1}</span>
      </div>
      <div class="progress"><span style="width:${Math.max(12, 100 - index * 12)}%"></span></div>
      <div class="meta-line">${int(row.total_qty ?? 0)} قطعة</div>
    </article>
  `).join('') : emptyCard('لا توجد بيانات');

  const topCompaniesSource = state.records.vTopCompanies.length ? state.records.vTopCompanies : state.records.companies.slice(0, 6).map((c) => ({
    company_name: c.company_name,
    company_id: c.company_id,
    total_sales: 0,
  }));
  els.topCompanies.innerHTML = topCompaniesSource.length ? topCompaniesSource.map((row, index) => `
    <article class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.company_name || row.company_id || '—')}</strong>
          <span>${esc(row.company_id || '')}</span>
        </div>
        <span class="badge neutral">#${index + 1}</span>
      </div>
      <div class="progress"><span style="width:${Math.max(12, 100 - index * 12)}%"></span></div>
      <div class="meta-line">${money(row.total_sales || 0)}</div>
    </article>
  `).join('') : emptyCard('لا توجد بيانات');
}

function renderOrders() {
  if (!canAccessSection('orders')) {
    els.ordersBody.innerHTML = emptyCard('لا توجد صلاحية');
    return;
  }
  const filter = els.statusFilter.value;
  const rows = state.orders.filter((order) => (!filter || order.status === filter) && (
    searchValue(order.order_number) || searchValue(order.customerName) || searchValue(order.customerPhone)
  ));
  els.ordersBody.innerHTML = rows.length ? rows.map((order) => `
    <article class="order-card item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(order.order_number)}</strong>
          <span>${esc(order.customerName)}</span>
        </div>
        <span class="badge ${statusClass(order.status)}">${esc(order.status || 'draft')}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>الهاتف</span><strong>${esc(order.customerPhone)}</strong></div>
        <div class="meta-box"><span>القيمة</span><strong>${money(order.total_amount)}</strong></div>
        <div class="meta-box"><span>التاريخ</span><strong>${fmtDate(order.created_at)}</strong></div>
        <div class="meta-box"><span>العناصر</span><strong>${int(order.items?.length || 0)}</strong></div>
      </div>
      <div class="actions">
        <button class="ghost-btn" data-act="view-order" data-id="${esc(order.id)}">عرض التفاصيل</button>
        <button class="primary-btn" data-act="order-status" data-id="${esc(order.id)}">تغيير الحالة</button>
      </div>
    </article>
  `).join('') : emptyCard('لا توجد طلبات مطابقة');
}

function renderUsers() {
  if (!canAccessSection('users')) {
    els.usersBody.innerHTML = emptyCard('لا توجد صلاحية');
    return;
  }
  const source = state.tab === 'customers' ? state.records.customers : state.records.salesReps;
  const rows = source.filter((row) => (
    searchValue(row.name) || searchValue(row.phone) || searchValue(row.username) || searchValue(row.address) || searchValue(row.region) || searchValue(row.location)
  ));
  els.usersBody.innerHTML = rows.length ? rows.map((row) => `
    <article class="user-card item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.name || '')}</strong>
          <span>${esc(row.phone || '')}</span>
        </div>
        <span class="badge neutral">${esc(state.tab === 'customers' ? 'عميل' : 'مندوب')}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>العنوان / المنطقة</span><strong>${esc(row.address || row.region || '—')}</strong></div>
        <div class="meta-box"><span>اللوكيشن</span><strong>${esc(row.location || '—')}</strong></div>
        <div class="meta-box"><span>اسم المستخدم</span><strong>${esc(row.username || '—')}</strong></div>
        <div class="meta-box"><span>النوع</span><strong>${esc(state.tab === 'customers' ? 'customer' : 'sales_rep')}</strong></div>
      </div>
      <div class="actions">
        <button class="ghost-btn" data-act="view-user" data-type="${esc(state.tab)}" data-id="${esc(row.id)}">عرض</button>
        ${isAdmin() ? `<button class="primary-btn" data-act="edit-user" data-type="${esc(state.tab)}" data-id="${esc(row.id)}">تعديل</button>` : ''}
      </div>
    </article>
  `).join('') : emptyCard('لا توجد بيانات مطابقة');
}

function renderDashUsers() {
  if (!isAdmin()) {
    els.dashUsersBody.innerHTML = '';
    document.querySelectorAll('.admin-only').forEach((node) => { node.style.display = 'none'; });
    return;
  }
  document.querySelectorAll('.admin-only').forEach((node) => { node.style.display = ''; });
  els.dashUsersBody.innerHTML = state.dashboardUsers.length ? state.dashboardUsers.map((user, index) => `
    <article class="dash-user-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(user.username)}</strong>
          <span>${esc(user.name || user.username)}</span>
        </div>
        <span class="badge ${user.active ? 'good' : 'bad'}">${user.active ? 'active' : 'disabled'}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>الدور</span><strong>${esc(user.role)}</strong></div>
        <div class="meta-box"><span>الصلاحيات</span><strong>${user.permissions.orders || user.permissions.reports || user.permissions.products || user.permissions.users ? 'enabled' : 'none'}</strong></div>
      </div>
      <div class="actions">
        <button class="ghost-btn" data-act="toggle-dash-user" data-i="${index}">${user.active ? 'تعطيل' : 'تفعيل'}</button>
        <button class="primary-btn" data-act="delete-dash-user" data-i="${index}">حذف</button>
      </div>
    </article>
  `).join('') : emptyCard('لا توجد حسابات');
}

function renderProducts() {
  if (!canAccessSection('products')) {
    els.productsBody.innerHTML = emptyCard('لا توجد صلاحية');
    return;
  }
  const rows = [...state.maps.product.values()].filter((row) => (
    searchValue(row.product_name) || searchValue(row.product_id) || searchValue(row.company_id) || searchValue(state.maps.company.get(row.company_id)?.company_name)
  ));
  els.productsBody.innerHTML = rows.length ? rows.map((row) => {
    const company = state.maps.company.get(row.company_id);
    const carton = state.maps.carton.get(`${row.product_id}::base`);
    const pack = state.maps.pack.get(`${row.product_id}::base`);
    return `
      <article class="product-card item-card">
        <div class="item-head">
          <div class="item-title">
            <strong>${esc(row.product_name || '')}</strong>
            <span>${esc(row.product_id || '')}</span>
          </div>
          <span class="badge ${String(row.status || 'active') === 'active' ? 'good' : 'bad'}">${esc(row.status || 'active')}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-box"><span>الشركة</span><strong>${esc(company?.company_name || '—')}</strong></div>
          <div class="meta-box"><span>الظهور</span><strong>${row.visible ? 'visible' : 'hidden'}</strong></div>
          <div class="meta-box"><span>سعر الكرتون</span><strong>${money(carton?.price ?? row.carton_price ?? 0)}</strong></div>
          <div class="meta-box"><span>سعر القطعة</span><strong>${money(pack?.price ?? row.pack_price ?? 0)}</strong></div>
        </div>
        <div class="actions">
          ${isAdmin() ? `<button class="primary-btn" data-act="edit-product" data-id="${esc(row.product_id)}">تعديل</button>` : ''}
        </div>
      </article>
    `;
  }).join('') : emptyCard('لا توجد منتجات مطابقة');
}

function renderCompanies() {
  if (!canAccessSection('companies')) {
    els.companiesBody.innerHTML = emptyCard('لا توجد صلاحية');
    return;
  }
  const rows = state.records.companies.filter((row) => searchValue(row.company_name) || searchValue(row.company_id));
  els.companiesBody.innerHTML = rows.length ? rows.map((row) => `
    <article class="company-card item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.company_name)}</strong>
          <span>${esc(row.company_id)}</span>
        </div>
        <span class="badge ${row.visible ? 'good' : 'bad'}">${row.visible ? 'visible' : 'hidden'}</span>
      </div>
      <div class="meta-grid">
        <div class="meta-box"><span>اللوجو</span><strong>${row.company_logo ? 'linked' : 'default'}</strong></div>
        <div class="meta-box"><span>الخصم</span><strong>${row.allow_discount ? 'allow' : 'no'}</strong></div>
      </div>
      <div class="actions">
        <img class="company-thumb" alt="${esc(row.company_name)}" src="${esc(row.company_logo || '') || svgPlaceholder(row.company_name)}" />
        ${isAdmin() ? `<button class="primary-btn" data-act="edit-company" data-id="${esc(row.company_id)}">تعديل</button>` : ''}
      </div>
    </article>
  `).join('') : emptyCard('لا توجد شركات مطابقة');
}

function renderReports() {
  if (!canAccessSection('reports')) {
    els.dailySales.innerHTML = '';
    els.statusBreakdown.innerHTML = '';
    els.topCustomers.innerHTML = '';
    els.repPerformance.innerHTML = '';
    return;
  }

  const daily = filteredSalesDaily();
  const totalSales = daily.reduce((sum, row) => sum + Number(row.total_sales || 0), 0);
  els.salesRange.textContent = money(totalSales);
  els.statusTotal.textContent = int(state.orders.length);

  els.dailySales.innerHTML = daily.length ? daily.map((row, index) => `
    <article class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.day || '—')}</strong>
          <span>${int(row.orders_count || 0)} طلب</span>
        </div>
        <span class="badge neutral">${index + 1}</span>
      </div>
      <div class="progress"><span style="width:${Math.max(12, 100 - index * 8)}%"></span></div>
      <div class="meta-line">${money(row.total_sales || 0)}</div>
    </article>
  `).join('') : emptyCard('لا يوجد نطاق بيانات');

  const statusRows = STATUSES.map((status) => {
    const orders = state.orders.filter((row) => (row.status || 'draft') === status);
    return { status, count: orders.length, total: orders.reduce((sum, row) => sum + Number(row.total_amount || 0), 0) };
  }).filter((row) => row.count > 0 || row.status === 'draft');

  els.statusBreakdown.innerHTML = statusRows.length ? statusRows.map((row) => `
    <article class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.status)}</strong>
          <span>${int(row.count)} طلب</span>
        </div>
        <span class="badge ${statusClass(row.status)}">${esc(row.status)}</span>
      </div>
      <div class="progress"><span style="width:${Math.max(12, (row.count / Math.max(1, state.orders.length)) * 100)}%"></span></div>
      <div class="meta-line">${money(row.total)}</div>
    </article>
  `).join('') : emptyCard('لا توجد حالات');

  els.topCustomers.innerHTML = state.records.vTopCustomers.length ? state.records.vTopCustomers.map((row, index) => `
    <article class="item-card">
      <div class="item-head">
        <div class="item-title">
          <strong>${esc(row.name || '—')}</strong>
          <span>${esc(row.phone || '')} · ${int(row.total_orders || 0)} طلب</span>
        </div>
        <span class="badge neutral">#${index + 1}</span>
      </div>
      <div class="progress"><span style="width:${Math.max(12, 100 - index * 10)}%"></span></div>
      <div class="meta-line">${money(row.total_spent || 0)}</div>
    </article>
  `).join('') : emptyCard('لا توجد بيانات');

  const repsSource = state.records.vRepsPerformance.length ? state.records.vRepsPerformance : state.records.salesReps.map((rep) => {
    const repOrders = state.orders.filter((order) => order.user_id === rep.id);
    const total = repOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    return {
      id: rep.id,
      name: rep.name,
      region: rep.region,
      total_orders: repOrders.length,
      total_sales: total,
    };
  });

  els.repPerformance.innerHTML = repsSource.length ? repsSource.map((row, index) => {
    const pct = Math.max(10, 100 - index * 12);
    return `
      <article class="rep-card item-card" data-act="open-rep" data-id="${esc(row.id || row.name || '')}">
        <div class="item-head">
          <div class="item-title">
            <strong>${esc(row.name || '—')}</strong>
            <span>${esc(row.region || '—')}</span>
          </div>
          <span class="badge neutral">${int(row.total_orders || 0)} طلب</span>
        </div>
        <div class="meta-grid">
          <div class="meta-box"><span>إجمالي المبيعات</span><strong>${money(row.total_sales || 0)}</strong></div>
          <div class="meta-box"><span>متوسط الطلب</span><strong>${money((Number(row.total_sales || 0) / Math.max(1, Number(row.total_orders || 0))) || 0)}</strong></div>
        </div>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </article>
    `;
  }).join('') : emptyCard('لا توجد بيانات');
}

function renderSettings() {
  els.waInput.value = localStorage.getItem(SUPPORT_WA_KEY) || CONFIG.whatsapp || '';
}

function renderQuickRail() {
  document.querySelectorAll('[data-go]').forEach((btn) => {
    btn.style.display = canAccessSection(btn.dataset.go) ? '' : 'none';
  });
}

function renderAll() {
  renderQuickRail();
  renderHome();
  renderOrders();
  renderUsers();
  renderDashUsers();
  renderProducts();
  renderCompanies();
  renderReports();
  renderSettings();
  setSection(state.section);
  renderAuthState();
}

function openOrder(order) {
  state.repDetail = null;
  els.detailsTitle.textContent = `تفاصيل الطلب ${order.order_number}`;
  els.detailsSub.textContent = `${order.customerName} · ${fmtDate(order.created_at)}`;
  const statusHtml = canAccessSection('orders')
    ? `
      <label class="field"><span>تغيير الحالة</span><select id="orderStatusSel">${STATUSES.map((status) => `<option value="${status}" ${status === (order.status || 'draft') ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
      <button id="saveOrderStatus" class="primary-btn full" type="button">حفظ الحالة</button>
    `
    : `<div class="row-item"><strong>صلاحية قراءة فقط</strong><span>هذا الدور لا يسمح بتغيير الحالة</span></div>`;

  els.detailsBody.innerHTML = `
    <div class="item-card">
      <div class="meta-grid">
        <div class="meta-box"><span>رقم الطلب</span><strong>${esc(order.order_number)}</strong></div>
        <div class="meta-box"><span>العميل</span><strong>${esc(order.customerName)}</strong></div>
        <div class="meta-box"><span>الهاتف</span><strong>${esc(order.customerPhone)}</strong></div>
        <div class="meta-box"><span>العنوان</span><strong>${esc(order.customerAddress)}</strong></div>
        <div class="meta-box"><span>القيمة</span><strong>${money(order.total_amount)}</strong></div>
        <div class="meta-box"><span>الحالة</span><strong><span class="badge ${statusClass(order.status)}">${esc(order.status || 'draft')}</span></strong></div>
      </div>
    </div>
    <div class="item-card">
      <div class="section-head"><strong>العناصر</strong><span class="pill">${int(order.items.length)}</span></div>
      <div class="stack">
        ${order.items.length ? order.items.map((item) => `
          <div class="row-item">
            <div>
              <strong>${esc(item.title)}</strong>
              <span>${esc(item.type)} · ${esc(item.unit || 'single')}</span>
            </div>
            <strong>${int(item.qty)} × ${money(item.price)}</strong>
          </div>
        `).join('') : '<div class="row-item"><strong>لا توجد عناصر</strong><span>—</span></div>'}
      </div>
    </div>
    <div class="item-card">${statusHtml}</div>
  `;

  setSheet('detailsModal', true);

  const saveBtn = document.getElementById('saveOrderStatus');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        await apiMutate('orders', { id: `eq.${encodeURIComponent(order.id)}` }, { status: document.getElementById('orderStatusSel').value });
        toast('تم تحديث حالة الطلب');
        setSheet('detailsModal', false);
        await loadData();
      } catch (error) {
        console.error(error);
        toast('تعذر تحديث الحالة');
      }
    };
  }
}

function renderRepDetails(rep) {
  state.repDetail = rep;
  const repOrders = state.orders.filter((order) => order.user_id === rep.id && (!state.reportStart || new Date(order.created_at) >= new Date(state.reportStart)) && (!state.reportEnd || new Date(order.created_at) <= new Date(new Date(state.reportEnd).getTime() + 24 * 60 * 60 * 1000 - 1)));
  const totalSales = repOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const avgOrder = totalSales / Math.max(1, repOrders.length);

  els.detailsTitle.textContent = `تقرير المندوب ${rep.name || '—'}`;
  els.detailsSub.textContent = `${rep.region || '—'} · ${int(repOrders.length)} طلب`;
  els.detailsBody.innerHTML = `
    <div class="item-card">
      <div class="meta-grid">
        <div class="meta-box"><span>الاسم</span><strong>${esc(rep.name || '—')}</strong></div>
        <div class="meta-box"><span>المنطقة</span><strong>${esc(rep.region || '—')}</strong></div>
        <div class="meta-box"><span>إجمالي المبيعات</span><strong>${money(totalSales)}</strong></div>
        <div class="meta-box"><span>متوسط الطلب</span><strong>${money(avgOrder)}</strong></div>
      </div>
    </div>
    <div class="item-card">
      <div class="section-head">
        <strong>فلترة حسب التاريخ</strong>
        <span class="pill">${int(repOrders.length)}</span>
      </div>
      <div class="filter-row">
        <input id="repStart" type="date" class="select-pill" value="${esc(state.reportStart)}" />
        <input id="repEnd" type="date" class="select-pill" value="${esc(state.reportEnd)}" />
        <button id="applyRepFilter" class="primary-btn" type="button">تحديث</button>
      </div>
    </div>
    <div class="item-card">
      <div class="section-head"><strong>الطلبات</strong><span class="pill">${int(repOrders.length)}</span></div>
      <div class="stack">
        ${repOrders.length ? repOrders.map((order) => `
          <div class="row-item">
            <div>
              <strong>${esc(order.order_number)}</strong>
              <span>${fmtDate(order.created_at)} · ${esc(order.status || 'draft')}</span>
            </div>
            <strong>${money(order.total_amount || 0)}</strong>
          </div>
        `).join('') : '<div class="row-item"><strong>لا توجد طلبات داخل هذا النطاق</strong><span>—</span></div>'}
      </div>
    </div>
  `;
  setSheet('detailsModal', true);

  const applyBtn = document.getElementById('applyRepFilter');
  if (applyBtn) {
    applyBtn.onclick = () => {
      state.reportStart = document.getElementById('repStart').value;
      state.reportEnd = document.getElementById('repEnd').value;
      renderReports();
      renderRepDetails(rep);
    };
  }
}

function openUser(kind, row) {
  els.detailsTitle.textContent = kind === 'customers' ? 'تفاصيل العميل' : 'تفاصيل المندوب';
  els.detailsSub.textContent = row.name || '';
  els.detailsBody.innerHTML = `
    <div class="item-card">
      <div class="meta-grid">
        <div class="meta-box"><span>الاسم</span><strong>${esc(row.name || '')}</strong></div>
        <div class="meta-box"><span>الهاتف</span><strong>${esc(row.phone || '')}</strong></div>
        <div class="meta-box"><span>العنوان</span><strong>${esc(row.address || row.region || '')}</strong></div>
        <div class="meta-box"><span>اللوكيشن</span><strong>${esc(row.location || '—')}</strong></div>
        <div class="meta-box"><span>اسم المستخدم</span><strong>${esc(row.username || '—')}</strong></div>
        <div class="meta-box"><span>النوع</span><strong>${esc(kind)}</strong></div>
      </div>
    </div>
  `;
  setSheet('detailsModal', true);
}

function openEdit(kind, row) {
  if (!isAdmin()) return toast('هذه الصلاحية للـ admin فقط');
  state.edit = { kind, row };
  els.editTitle.textContent = kind === 'customer' ? 'تعديل عميل' : kind === 'sales_rep' ? 'تعديل مندوب' : kind === 'product' ? 'تعديل منتج' : 'تعديل شركة';
  els.editSub.textContent = row.name || row.company_name || row.product_name || row.username || '';
  els.editForm.innerHTML = '';

  const fields = [];
  if (kind === 'customer') {
    fields.push(
      ['name', 'الاسم', row.name || ''],
      ['phone', 'رقم الهاتف', row.phone || ''],
      ['address', 'العنوان', row.address || ''],
      ['location', 'اللوكيشن', row.location || ''],
      ['password', 'كلمة المرور', row.password || '']
    );
  } else if (kind === 'sales_rep') {
    fields.push(
      ['name', 'الاسم', row.name || ''],
      ['phone', 'رقم الهاتف', row.phone || ''],
      ['region', 'المنطقة / العنوان', row.region || ''],
      ['username', 'اسم المستخدم', row.username || ''],
      ['password', 'كلمة المرور', row.password || '']
    );
  } else if (kind === 'product') {
    const carton = state.maps.carton.get(`${row.product_id}::base`);
    const pack = state.maps.pack.get(`${row.product_id}::base`);
    fields.push(
      ['product_name', 'اسم المنتج', row.product_name || ''],
      ['status', 'الحالة', row.status || 'active', ['active', 'inactive']],
      ['visible', 'الظهور', String(!!row.visible), ['true', 'false']],
      ['carton_price', 'سعر الكرتون', carton?.price ?? row.carton_price ?? 0],
      ['pack_price', 'سعر القطعة', pack?.price ?? row.pack_price ?? 0],
    );
  } else if (kind === 'company') {
    fields.push(
      ['company_name', 'اسم الشركة', row.company_name || ''],
      ['company_logo', 'رابط اللوجو', row.company_logo || ''],
      ['visible', 'الظهور', String(!!row.visible), ['true', 'false']],
      ['allow_discount', 'تفعيل الخصم', String(!!row.allow_discount), ['true', 'false']],
    );
  }

  fields.forEach(([name, label, value, options]) => {
    const wrap = document.createElement('label');
    wrap.className = 'field';
    wrap.innerHTML = `<span>${label}</span>`;
    let input;
    if (Array.isArray(options)) {
      input = document.createElement('select');
      input.name = name;
      options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === String(value)) option.selected = true;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.name = name;
      input.value = value ?? '';
      input.type = name.includes('price') ? 'number' : 'text';
      if (name.includes('price')) input.step = '0.01';
    }
    wrap.appendChild(input);
    els.editForm.appendChild(wrap);
  });

  setSheet('editModal', true);
}

async function saveEdit() {
  if (!state.edit || !isAdmin()) return;
  const fd = new FormData(els.editForm);
  const data = Object.fromEntries(fd.entries());
  const { kind, row } = state.edit;

  try {
    if (kind === 'customer') {
      const payload = {
        name: String(data.name || '').trim(),
        phone: String(data.phone || '').trim() || null,
        address: String(data.address || '').trim() || null,
        location: String(data.location || '').trim() || null,
      };
      if (String(data.password || '').trim()) payload.password = String(data.password || '').trim();
      await apiMutate('customers', { id: `eq.${encodeURIComponent(row.id)}` }, payload);
    } else if (kind === 'sales_rep') {
      const payload = {
        name: String(data.name || '').trim(),
        phone: String(data.phone || '').trim() || null,
        region: String(data.region || '').trim() || null,
        username: String(data.username || '').trim() || null,
      };
      if (String(data.password || '').trim()) payload.password = String(data.password || '').trim();
      await apiMutate('sales_reps', { id: `eq.${encodeURIComponent(row.id)}` }, payload);
    } else if (kind === 'product') {
      await apiMutate('products', { product_id: `eq.${encodeURIComponent(row.product_id)}` }, {
        product_name: String(data.product_name || '').trim(),
        status: String(data.status || 'active'),
        visible: String(data.visible) === 'true',
      });
      await apiMutate('prices_carton', { product_id: `eq.${encodeURIComponent(row.product_id)}`, tier_name: 'eq.base' }, {
        price: Number(data.carton_price || 0),
        visible: true,
      }).catch(() => {});
      await apiMutate('prices_pack', { product_id: `eq.${encodeURIComponent(row.product_id)}`, tier_name: 'eq.base' }, {
        price: Number(data.pack_price || 0),
        visible: true,
      }).catch(() => {});
    } else if (kind === 'company') {
      await apiMutate('companies', { company_id: `eq.${encodeURIComponent(row.company_id)}` }, {
        company_name: String(data.company_name || '').trim(),
        company_logo: String(data.company_logo || '').trim(),
        visible: String(data.visible) === 'true',
        allow_discount: String(data.allow_discount) === 'true',
      });
    }
    setSheet('editModal', false);
    state.edit = null;
    toast('تم الحفظ');
    await loadData();
  } catch (error) {
    console.error(error);
    toast('تعذر الحفظ');
  }
}

function saveWa() {
  localStorage.setItem(SUPPORT_WA_KEY, els.waInput.value.trim());
  CONFIG.whatsapp = localStorage.getItem(SUPPORT_WA_KEY) || CONFIG.whatsapp;
  toast('تم حفظ الرقم');
}

function addDashUser() {
  if (!isAdmin()) return toast('هذه الصلاحية للـ admin فقط');
  els.dashUserForm.reset();
  setSheet('dashUserModal', true);
}

function createDashUser() {
  if (!isAdmin()) return toast('هذه الصلاحية للـ admin فقط');
  const fd = new FormData(els.dashUserForm);
  const data = Object.fromEntries(fd.entries());
  const username = String(data.username || '').trim();
  const password = String(data.password || '').trim();
  const role = String(data.role || 'viewer');
  if (!username || !password) return toast('أكمل البيانات');
  if (state.dashboardUsers.some((user) => user.username === username)) return toast('اسم المستخدم موجود');

  state.dashboardUsers.push(normalizeDashboardUser({
    username,
    password,
    role,
    name: username,
    permissions: rolePermissions(role),
    active: true,
  }));
  saveJSON(DASHBOARD_USERS_KEY, state.dashboardUsers);
  renderDashUsers();
  setSheet('dashUserModal', false);
  toast('تمت الإضافة');
}

function toggleDashUser(index) {
  if (!isAdmin()) return toast('هذه الصلاحية للـ admin فقط');
  const user = state.dashboardUsers[index];
  if (!user) return;
  user.active = !user.active;
  saveJSON(DASHBOARD_USERS_KEY, state.dashboardUsers);
  renderDashUsers();
}

function deleteDashUser(index) {
  if (!isAdmin()) return toast('هذه الصلاحية للـ admin فقط');
  const user = state.dashboardUsers[index];
  if (!user) return;
  if (!confirm(`حذف ${user.username}؟`)) return;
  state.dashboardUsers.splice(index, 1);
  saveJSON(DASHBOARD_USERS_KEY, state.dashboardUsers);
  renderDashUsers();
}

function initDates() {
  const now = new Date();
  const week = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (els.endDate) els.endDate.value = now.toISOString().slice(0, 10);
  if (els.startDate) els.startDate.value = week.toISOString().slice(0, 10);
  state.reportStart = els.startDate.value;
  state.reportEnd = els.endDate.value;
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close]')?.dataset.close;
    if (close) {
      setSheet(close, false);
      return;
    }

    const sheetLink = event.target.closest('.sheet-link');
    if (sheetLink) {
      const sec = sheetLink.dataset.sec;
      setSection(sec);
      hideAllSheets();
      return;
    }

    const nav = event.target.closest('.dock__item');
    if (nav) {
      setSection(nav.dataset.sec);
      return;
    }

    const rail = event.target.closest('.rail-card');
    if (rail) {
      setSection(rail.dataset.go);
      return;
    }

    const tab = event.target.closest('.tab');
    if (tab) {
      state.tab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((node) => node.classList.toggle('active', node.dataset.tab === state.tab));
      renderUsers();
      return;
    }

    const action = event.target.closest('[data-act]');
    if (!action) return;
    const act = action.dataset.act;
    const id = action.dataset.id;
    const index = Number(action.dataset.i);
    const type = action.dataset.type;

    if (act === 'view-order' || act === 'order-status') {
      const order = state.orders.find((row) => row.id === id);
      if (order) openOrder(order);
      return;
    }

    if (act === 'view-user') {
      const row = type === 'customers'
        ? state.records.customers.find((item) => item.id === id)
        : state.records.salesReps.find((item) => item.id === id);
      if (row) openUser(type, row);
      return;
    }

    if (act === 'edit-user') {
      const row = type === 'customers'
        ? state.records.customers.find((item) => item.id === id)
        : state.records.salesReps.find((item) => item.id === id);
      if (row) openEdit(type === 'customers' ? 'customer' : 'sales_rep', row);
      return;
    }

    if (act === 'edit-product') {
      const row = state.maps.product.get(id);
      if (row) openEdit('product', row);
      return;
    }

    if (act === 'edit-company') {
      const row = state.records.companies.find((item) => item.company_id === id);
      if (row) openEdit('company', row);
      return;
    }

    if (act === 'toggle-dash-user') {
      toggleDashUser(index);
      return;
    }

    if (act === 'delete-dash-user') {
      deleteDashUser(index);
      return;
    }

    if (act === 'open-rep') {
      const rep = state.records.salesReps.find((item) => item.id === id) || state.records.vRepsPerformance.find((item) => (item.id || item.name) === id) || { id, name: id, region: '' };
      if (rep) renderRepDetails(rep);
      return;
    }
  });

  els.menuBtn.onclick = () => setSheet('menuSheet', !els.menuSheet || els.menuSheet.classList.contains('hidden'));
  els.menuFab.onclick = () => setSheet('menuSheet', true);
  els.notifBtn.onclick = () => toast('لا توجد تنبيهات جديدة');
  els.menuSheetBackdrop.onclick = () => setSheet('menuSheet', false);
  els.loginModalBackdrop.onclick = () => {};
  els.logoutBtn = null;

  if (document.getElementById('logoutBtn')) document.getElementById('logoutBtn').onclick = logout;
  if (document.getElementById('refreshBtn')) document.getElementById('refreshBtn').onclick = loadData;
  els.globalSearch = document.getElementById('globalSearch');
  els.clearSearch = document.getElementById('clearSearch');
  if (els.globalSearch) els.globalSearch.oninput = () => { state.search = els.globalSearch.value.trim(); renderAll(); };
  if (els.clearSearch) els.clearSearch.onclick = () => { els.globalSearch.value = ''; state.search = ''; renderAll(); };

  els.loginBtn.onclick = login;
  els.loginPass.onkeydown = (event) => { if (event.key === 'Enter') login(); };
  els.statusFilter.onchange = renderOrders;
  els.applyFilter.onclick = () => {
    state.reportStart = els.startDate.value;
    state.reportEnd = els.endDate.value;
    renderReports();
  };
  els.saveWa.onclick = saveWa;
  els.addDashUser.onclick = addDashUser;
  els.createDashUser.onclick = createDashUser;
  els.saveEdit.onclick = saveEdit;

  document.querySelectorAll('[data-close="detailsModal"]').forEach((btn) => { btn.onclick = () => setSheet('detailsModal', false); });
  document.querySelectorAll('[data-close="editModal"]').forEach((btn) => { btn.onclick = () => setSheet('editModal', false); });
  document.querySelectorAll('[data-close="dashUserModal"]').forEach((btn) => { btn.onclick = () => setSheet('dashUserModal', false); });

  document.getElementById('detailsModalBackdrop').onclick = () => setSheet('detailsModal', false);
  document.getElementById('editModalBackdrop').onclick = () => setSheet('editModal', false);
  document.getElementById('dashUserModalBackdrop').onclick = () => setSheet('dashUserModal', false);
  document.getElementById('loginModalBackdrop').onclick = () => setSheet('loginModal', true);
}

function renderRepDetailIfOpen() {
  if (state.repDetail) renderRepDetails(state.repDetail);
}

function renderAll() {
  renderQuickRail();
  renderHome();
  renderOrders();
  renderUsers();
  renderDashUsers();
  renderProducts();
  renderCompanies();
  renderReports();
  renderSettings();
  setSection(state.section);
  renderAuthState();
  renderRepDetailIfOpen();
}

function init() {
  seedDashboardUsers();
  bindEvents();
  initDates();
  renderSettings();
  renderAuthState();
  setSection('home');
  renderDashUsers();
  loadData();
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideAllSheets();
    if (!currentUser) setSheet('loginModal', true);
  }
});

init();
