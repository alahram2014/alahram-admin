
const CONFIG = {
  baseUrl: 'https://upzuslyqfcvpbkqyzyxp.supabase.co/rest/v1',
  apiKey: 'sb_publishable_vpqJxVuMbYbm0y3VvVhuJw_FBQkLvYg',
};

const STORAGE = {
  auth: 'admin_auth_local',
  users: 'admin_users_local',
};

const LOCAL_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Administrator',
    permissions: { dashboard: true, orders: true, customers: true, reps: true, companies: true, products: true, tiers: true, deals: true, flash: true, reports: true, users: true },
  },
  {
    username: 'manager',
    password: 'manager123',
    name: 'Manager',
    permissions: { dashboard: true, orders: true, customers: true, reps: true, companies: true, products: true, tiers: true, deals: true, flash: true, reports: true, users: false },
  },
];

const AR_STATUS = ['قيد التنفيذ', 'جاري التجهيز', 'تم الشحن', 'تم التوصيل', 'ملغي'];
const STATUS_TO_DB = {
  'قيد التنفيذ': 'pending',
  'جاري التجهيز': 'pending',
  'تم الشحن': 'confirmed',
  'تم التوصيل': 'confirmed',
  'ملغي': 'cancelled',
};
const DB_TO_AR = {
  draft: 'قيد التنفيذ',
  pending: 'جاري التجهيز',
  confirmed: 'تم الشحن',
  cancelled: 'ملغي',
};

const PAGE_META = {
  dashboard: 'الرئيسية',
  orders: 'الطلبات',
  customers: 'العملاء',
  reps: 'المناديب',
  companies: 'الشركات',
  products: 'المنتجات',
  tiers: 'الشرائح',
  deals: 'صفقة اليوم',
  flash: 'عرض الساعة',
  reports: 'التقارير',
  users: 'إدارة المستخدمين',
};

const DEFAULT_PAGE = 'dashboard';
const app = document.getElementById('app');

const state = {
  user: loadJSON(STORAGE.auth, null),
  users: loadJSON(STORAGE.users, LOCAL_USERS),
  page: 'dashboard',
  loading: true,
  customers: [],
  reps: [],
  orders: [],
  orderItems: [],
  companies: [],
  products: [],
  tiers: [],
  dailyDeals: [],
  flashOffers: [],
  customerAssignments: [],
  views: {},
  stats: {},
  selected: {
    orderId: null,
    customerId: null,
    repId: null,
    companyId: null,
    productId: null,
    tierName: null,
    dealId: null,
    flashId: null,
  },
  filters: {
    orderType: 'all',
    status: 'all',
    q: '',
    from: '',
    to: '',
  },
  forms: {
    addCustomer: false,
    addRep: false,
    addCompany: false,
    addProduct: false,
    addTier: false,
    addDeal: false,
    addFlash: false,
    addUser: false,
  },
};

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

function num(value, digits = 2) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: n % 1 === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function integer(value) {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function formatDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 16);
}

function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

function canUsePage(page) {
  if (!state.user) return false;
  const perms = state.user.permissions || {};
  if (page === 'dashboard') return !!perms.dashboard;
  if (page === 'orders') return !!perms.orders;
  if (page === 'customers') return !!perms.customers;
  if (page === 'reps') return !!perms.reps;
  if (page === 'companies') return !!perms.companies;
  if (page === 'products') return !!perms.products;
  if (page === 'tiers') return !!perms.tiers;
  if (page === 'deals' || page === 'flash') return !!perms[page];
  if (page === 'reports') return !!perms.reports;
  if (page === 'users') return !!perms.users;
  return true;
}

async function apiGet(path, params = {}) {
  const url = new URL(`${CONFIG.baseUrl}/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    headers: {
      apikey: CONFIG.apiKey,
      Authorization: `Bearer ${CONFIG.apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

async function apiMut(method, path, body, params = {}) {
  const url = new URL(`${CONFIG.baseUrl}/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), {
    method,
    headers: {
      apikey: CONFIG.apiKey,
      Authorization: `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${method} ${path} failed: ${res.status} ${txt}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : [];
}

function authUsers() {
  return Array.isArray(state.users) ? state.users : [];
}

function localLogin(username, password) {
  const found = authUsers().find((u) => String(u.username).trim() === String(username).trim() && String(u.password).trim() === String(password).trim());
  if (!found) throw new Error('بيانات الدخول غير صحيحة');
  state.user = found;
  saveJSON(STORAGE.auth, state.user);
}

function logout() {
  state.user = null;
  saveJSON(STORAGE.auth, null);
  state.page = DEFAULT_PAGE;
  render();
}

function navigate(page, push = true) {
  const target = PAGE_META[page] ? page : DEFAULT_PAGE;
  if (!canUsePage(target)) {
    toast('ليس لديك صلاحية الوصول إلى هذه الصفحة');
    return;
  }
  const hash = `#${target}`;
  if (push && location.hash !== hash) location.hash = hash;
  state.page = target;
  render();
}

function syncRouteFromHash() {
  const raw = (location.hash || `#${DEFAULT_PAGE}`).replace(/^#/, '');
  const page = PAGE_META[raw] ? raw : DEFAULT_PAGE;
  if (state.page !== page) state.page = page;
  if (state.user && !canUsePage(page)) {
    state.page = DEFAULT_PAGE;
    location.hash = `#${DEFAULT_PAGE}`;
  }
  render();
}

function statusLabel(value) {
  if (!value) return 'قيد التنفيذ';
  if (AR_STATUS.includes(value)) return value;
  return DB_TO_AR[String(value)] || 'قيد التنفيذ';
}

function statusDb(value) {
  return STATUS_TO_DB[String(value)] || 'pending';
}

function statusClass(value) {
  if (value === 'ملغي') return 'red';
  if (value === 'تم الشحن' || value === 'تم التوصيل') return 'green';
  return 'gold';
}

function companyById(id) {
  return state.companies.find((row) => String(row.company_id) === String(id)) || null;
}

function productById(id) {
  return state.products.find((row) => String(row.product_id) === String(id)) || null;
}

function customerById(id) {
  return state.customers.find((row) => String(row.id) === String(id)) || null;
}

function repById(id) {
  return state.reps.find((row) => String(row.id) === String(id)) || null;
}

function tierByName(name) {
  return state.tiers.find((row) => String(row.tier_name) === String(name)) || null;
}

function dealById(id) {
  return state.dailyDeals.find((row) => String(row.id) === String(id)) || null;
}

function flashById(id) {
  return state.flashOffers.find((row) => String(row.id) === String(id)) || null;
}

function orderItemsFor(orderId) {
  return (state.orderItems || []).filter((item) => String(item.order_id) === String(orderId));
}

function lookupItemName(item) {
  if (!item) return '';
  if (item.type === 'deal') return dealById(item.product_id)?.title || item.product_id;
  if (item.type === 'flash') return flashById(item.product_id)?.title || item.product_id;
  return productById(item.product_id)?.product_name || item.product_id;
}

function lookupItemCode(item) {
  if (!item) return '—';
  if (item.type === 'deal' || item.type === 'flash') return String(item.product_id || '—');
  return String(item.product_id || '—');
}

function buildInvoiceText(order) {
  if (!order) return 'لا توجد فاتورة';
  const customer = customerById(order.customer_id) || {};
  const rep = repById(order.rep_id || order.sales_rep_id) || {};
  const items = orderItemsFor(order.id).map((item) => {
    const total = Number(item.qty || 0) * Number(item.price || 0);
    return [
      `- ${lookupItemName(item)}`,
      `  كود الصنف: ${lookupItemCode(item)}`,
      `  الوحدة: ${item.unit || '—'}`,
      `  سعر الوحدة: ${num(item.price || 0)} جنيه`,
      `  الكمية: ${integer(item.qty || 0)}`,
      `  الإجمالي: ${num(total)} جنيه`,
    ].join('\n');
  }).join('\n');

  const lines = [
    '🧾 فاتورة طلب شراء',
    `رقم الفاتورة: ${order.invoice_number || order.order_number || order.id}`,
    '━━━━━━━━━━━━━━',
    `👤 نوع العميل: ${order.customer_type === 'rep' ? 'مندوب' : 'عميل مباشر'}`,
  ];
  if (order.customer_type === 'rep') {
    lines.push(
      '👨‍💼 بيانات المندوب',
      `الاسم: ${rep.name || '—'}`,
      `الهاتف: ${rep.phone || '—'}`,
      `المنطقة: ${rep.region || rep.location || '—'}`,
      '━━━━━━━━━━━━━━'
    );
  }
  lines.push(
    '👤 بيانات العميل',
    `الاسم: ${customer.name || '—'}`,
    `الهاتف: ${customer.phone || '—'}`,
    `العنوان: ${customer.address || customer.location || '—'}`,
    '━━━━━━━━━━━━━━',
    `📦 الشريحة: ${order.tier_name || 'الشريحة الأساسية'}`,
    '━━━━━━━━━━━━━━',
    '📋 تفاصيل الطلب:',
    items || '- لا توجد عناصر',
    '━━━━━━━━━━━━━━',
    `💰 الإجمالي: ${num(order.total_amount || 0)} جنيه`,
    '━━━━━━━━━━━━━━'
  );
  return lines.join('\n');
}

function orderPartyInfo(order) {
  const customer = customerById(order.customer_id) || {};
  const rep = repById(order.rep_id || order.sales_rep_id) || {};
  return { customer, rep };
}

function rawOrdersFilteredByRange() {
  const from = state.filters.from ? new Date(state.filters.from) : null;
  const to = state.filters.to ? new Date(state.filters.to) : null;
  return (state.orders || []).filter((order) => {
    const d = new Date(order.created_at || order.updated_at || Date.now());
    if (from && d < from) return false;
    if (to) {
      const end = new Date(to.getTime());
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });
}

function computeOrdersStatusFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    const label = statusLabel(order.workflow_status || order.status);
    const prev = map.get(label) || { count: 0, total: 0 };
    prev.count += 1;
    prev.total += Number(order.total_amount || 0);
    map.set(label, prev);
  });
  return Object.fromEntries(map.entries());
}

function computeTopCompaniesFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    orderItemsFor(order.id).forEach((item) => {
      const product = productById(item.product_id);
      const company = companyById(product?.company_id || item.company_id);
      const key = company?.company_id || product?.company_id || '—';
      const prev = map.get(key) || {
        company_id: key,
        company_name: company?.company_name || key,
        total_items: 0,
        total_sales: 0,
      };
      prev.total_items += Number(item.qty || 0);
      prev.total_sales += Number(item.qty || 0) * Number(item.price || 0);
      map.set(key, prev);
    });
  });
  return [...map.values()].sort((a, b) => b.total_sales - a.total_sales);
}

function computeTopProductsFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    orderItemsFor(order.id).forEach((item) => {
      if (String(item.type) !== 'product') return;
      const key = String(item.product_id);
      const prev = map.get(key) || {
        product_id: key,
        product_name: productById(key)?.product_name || key,
        total_qty: 0,
        total_sales: 0,
      };
      prev.total_qty += Number(item.qty || 0);
      prev.total_sales += Number(item.qty || 0) * Number(item.price || 0);
      map.set(key, prev);
    });
  });
  return [...map.values()].sort((a, b) => b.total_qty - a.total_qty);
}

function computeTopCustomersFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    const customer = customerById(order.customer_id);
    const key = String(order.customer_id || '');
    if (!key) return;
    const prev = map.get(key) || {
      id: key,
      name: customer?.name || key,
      phone: customer?.phone || '',
      total_orders: 0,
      total_spent: 0,
    };
    prev.total_orders += 1;
    prev.total_spent += Number(order.total_amount || 0);
    map.set(key, prev);
  });
  return [...map.values()].sort((a, b) => b.total_spent - a.total_spent);
}

function computeRepsPerformanceFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    const rep = repById(order.rep_id || order.sales_rep_id);
    const key = String(order.rep_id || order.sales_rep_id || '');
    if (!key) return;
    const prev = map.get(key) || {
      id: key,
      name: rep?.name || key,
      region: rep?.region || '',
      total_orders: 0,
      total_sales: 0,
    };
    prev.total_orders += 1;
    prev.total_sales += Number(order.total_amount || 0);
    map.set(key, prev);
  });
  return [...map.values()].sort((a, b) => b.total_sales - a.total_sales);
}

function computeDailySalesFromRaw() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    const key = String(order.created_at || '').slice(0, 10);
    const prev = map.get(key) || { day: key, orders_count: 0, total_sales: 0 };
    prev.orders_count += 1;
    prev.total_sales += Number(order.total_amount || 0);
    map.set(key, prev);
  });
  return [...map.values()].sort((a, b) => String(b.day).localeCompare(String(a.day)));
}

function buildDealStats() {
  const map = new Map();
  rawOrdersFilteredByRange().forEach((order) => {
    orderItemsFor(order.id).forEach((item) => {
      if (item.type !== 'deal' && item.type !== 'flash') return;
      const source = item.type === 'deal' ? dealById(item.product_id) : flashById(item.product_id);
      const key = `${item.type}:${item.product_id}`;
      const prev = map.get(key) || {
        key,
        type: item.type,
        id: item.product_id,
        title: source?.title || lookupItemName(item),
        purchases: 0,
        total_amount: 0,
      };
      prev.purchases += Number(item.qty || 0);
      prev.total_amount += Number(item.qty || 0) * Number(item.price || 0);
      map.set(key, prev);
    });
  });
  return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
}

function ratingForRep(repId) {
  const orders = (state.orders || []).filter((o) => String(o.rep_id || o.sales_rep_id || '') === String(repId));
  if (!orders.length) return '0.0';
  const score = Math.min(5, 2 + orders.length / 10 + orders.reduce((s, o) => s + Number(o.total_amount || 0), 0) / 50000);
  return score.toFixed(1);
}

function renderLogin() {
  return `
    <section class="login-wrap">
      <div class="login-card">
        <div class="brand">
          <div>
            <div class="badge">Administrator</div>
            <h1 style="margin:12px 0 4px">لوحة تحكم متعددة الصفحات</h1>
            <div class="small">تعمل عبر قاعدة البيانات الحالية مع مستخدمين محليين فقط</div>
          </div>
        </div>
        <div class="field"><span>اسم المستخدم</span><input id="loginUsername" type="text" placeholder="admin" /></div>
        <div class="field"><span>كلمة المرور</span><input id="loginPassword" type="password" placeholder="••••••••" /></div>
        <div class="toolbar">
          <button class="btn primary" id="loginBtn" type="button">دخول</button>
          <button class="btn" id="resetUsersBtn" type="button">استعادة المستخدمين المحليين</button>
        </div>
        <div class="small">المستخدمون المحليون: admin / admin123 أو manager / manager123</div>
      </div>
    </section>
  `;
}

function renderShell() {
  if (!state.user) {
    app.innerHTML = renderLogin();
    bindLogin();
    return;
  }

  const navItems = Object.entries(PAGE_META)
    .filter(([key]) => canUsePage(key))
    .map(([key, label]) => `<button class="${state.page === key ? 'active' : ''}" data-page="${key}" type="button">${label}</button>`)
    .join('');

  app.innerHTML = `
    <div class="header">
      <div>
        <div class="badge">${escapeHtml(state.user.name || state.user.username || 'مستخدم')}</div>
        <h2 style="margin:8px 0 0">لوحة تحكم ERP</h2>
        <div class="small">قاعدة البيانات هي المصدر الوحيد للحقيقة</div>
      </div>
      <div class="toolbar">
        <button class="btn" id="backBtn" type="button">رجوع</button>
        <button class="btn" id="homeBtn" type="button">الرئيسية</button>
        <button class="btn" id="logoutBtn" type="button">تسجيل الخروج</button>
      </div>
    </div>

    <div class="split">
      <aside class="sidebar card">
        <div class="nav">
          ${navItems}
        </div>
        <div class="small">زر الرجوع يعمل عبر history.back على الجوال والكمبيوتر.</div>
      </aside>
      <main class="panel">${renderPage()}</main>
    </div>

    <footer>لوحة تحكم عربية مرتبطة مباشرة بقاعدة البيانات الحالية.</footer>
  `;

  bindShell();
}

function renderPage() {
  switch (state.page) {
    case 'orders': return ordersPage();
    case 'customers': return customersPage();
    case 'reps': return repsPage();
    case 'companies': return companiesPage();
    case 'products': return productsPage();
    case 'tiers': return tiersPage();
    case 'deals': return dealsPage();
    case 'flash': return flashPage();
    case 'reports': return reportsPage();
    case 'users': return usersPage();
    default: return dashboardHome();
  }
}


function ordersPage() {
  const selected = state.orders.find((o) => String(o.id) === String(state.selected.orderId)) || filterOrders(rawOrdersFilteredByRange())[0] || state.orders[0] || null;
  const allOrders = rawOrdersFilteredByRange();
  const directOrders = allOrders.filter((o) => String(o.customer_type || (o.user_type === 'rep' ? 'rep' : 'direct')) === 'direct');
  const repOrders = allOrders.filter((o) => String(o.customer_type || (o.user_type === 'rep' ? 'rep' : 'direct')) === 'rep');
  const filtered = filterOrders(allOrders);
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">الطلبات</h3>
          <div class="small">طلبات عميل مباشر وطلبات مندوب، مع تفاصيل الفاتورة الكاملة وتحديث الحالة والحذف</div>
        </div>
        <div class="toolbar">
          <button class="btn ${state.filters.orderType === 'all' ? 'primary' : ''}" data-action="set-order-type" data-value="all" type="button">الكل</button>
          <button class="btn ${state.filters.orderType === 'direct' ? 'primary' : ''}" data-action="set-order-type" data-value="direct" type="button">طلبات عميل مباشر</button>
          <button class="btn ${state.filters.orderType === 'rep' ? 'primary' : ''}" data-action="set-order-type" data-value="rep" type="button">طلبات مندوب</button>
          <button class="btn" data-action="clear-order-filters" type="button">إعادة ضبط</button>
        </div>
      </div>

      <div class="grid cols-3">
        <div class="stat"><div class="label">طلبات عميل مباشر</div><div class="value">${integer(directOrders.length)}</div></div>
        <div class="stat"><div class="label">طلبات مندوب</div><div class="value">${integer(repOrders.length)}</div></div>
        <div class="stat"><div class="label">إجمالي الطلبات</div><div class="value">${integer(allOrders.length)}</div></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="search-row" style="margin-bottom:10px">
            <input id="orderSearch" type="search" placeholder="بحث برقم الفاتورة أو العميل أو المندوب" value="${escapeHtml(state.filters.q)}" />
            <select id="statusFilter">
              <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>كل الحالات</option>
              ${AR_STATUS.map((st) => `<option value="${escapeHtml(st)}" ${state.filters.status === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
          </div>
          <div class="list">
            ${filtered.length ? filtered.map((o) => orderCard(o, true)).join('') : '<div class="empty-state">لا توجد طلبات مطابقة</div>'}
          </div>
        </div>
        <div>${selected ? orderDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر طلبًا لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function dashboardHome() {
  const s = state.stats || {};
  const latestOrders = [...(state.orders || [])].slice(0, 6);
  return `
    <div class="grid cols-3">
      <div class="stat"><div class="label">الطلبات</div><div class="value">${integer(s.orders || 0)}</div></div>
      <div class="stat"><div class="label">العملاء</div><div class="value">${integer(s.customers || 0)}</div></div>
      <div class="stat"><div class="label">المناديب</div><div class="value">${integer(s.reps || 0)}</div></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>إجمالي المبيعات</h3>
        <div class="kpi">${num(s.sales || 0)} جنيه</div>
        <div class="small">محسوب من الطلبات الحالية</div>
      </div>
      <div class="card">
        <h3>إجراءات سريعة</h3>
        <div class="toolbar">
          <button class="btn primary" data-page="orders" type="button">مراجعة الطلبات</button>
          <button class="btn" data-page="customers" type="button">العملاء</button>
          <button class="btn" data-page="reps" type="button">المناديب</button>
          <button class="btn" data-page="companies" type="button">الشركات</button>
          <button class="btn" data-page="products" type="button">المنتجات</button>
          <button class="btn" data-page="tiers" type="button">الشرائح</button>
          <button class="btn" data-page="deals" type="button">صفقة اليوم</button>
          <button class="btn" data-page="flash" type="button">عرض الساعة</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="header" style="margin:0"><div><h3 style="margin:0">آخر الطلبات</h3><div class="small">اختصار للمتابعة السريعة</div></div></div>
      <div class="list">
        ${latestOrders.length ? latestOrders.map((o) => orderCard(o, true)).join('') : '<div class="item">لا توجد طلبات حتى الآن</div>'}
      </div>
    </div>
  `;
}

function filterOrders(list) {
  let out = [...(list || [])];
  if (state.filters.orderType !== 'all') {
    out = out.filter((o) => String(o.customer_type || (o.user_type === 'rep' ? 'rep' : 'direct')) === state.filters.orderType);
  }
  if (state.filters.status !== 'all') {
    out = out.filter((o) => statusLabel(o.workflow_status || o.status) === state.filters.status);
  }
  const q = String(state.filters.q || '').trim().toLowerCase();
  if (q) {
    out = out.filter((o) => [o.order_number, o.invoice_number, o.customer_id, o.rep_id, o.tier_name, o.total_amount].join(' ').toLowerCase().includes(q));
  }
  return out;
}

function orderCard(order, compact = false) {
  const { customer, rep } = orderPartyInfo(order);
  const st = statusLabel(order.workflow_status || order.status);
  return `
    <div class="item ${compact ? 'compact' : ''}" data-action="select-order" data-id="${escapeHtml(order.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">فاتورة ${escapeHtml(order.invoice_number || order.order_number || order.id)}</div>
          <div class="item-meta">${escapeHtml(order.customer_type === 'rep' ? 'مندوب' : 'عميل مباشر')} · ${escapeHtml(customer.name || order.customer_id || '—')}</div>
          <div class="item-meta">${escapeHtml(rep.name || '—')} · ${formatDateTime(order.created_at)}</div>
        </div>
        <span class="status ${statusClass(st)}">${escapeHtml(st)}</span>
      </div>
      <div class="item-meta">الإجمالي: ${num(order.total_amount || 0)} جنيه</div>
      <div class="toolbar">
        <button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>
        <button class="btn" data-action="delete-order" data-id="${escapeHtml(order.id)}" type="button">حذف</button>
      </div>
    </div>
  `;
}

function orderDetailsCard(order) {
  if (!order) return '<div class="card"><div class="empty-state">اختر طلبًا لعرض التفاصيل</div></div>';
  const invoiceText = buildInvoiceText(order);
  const { customer, rep } = orderPartyInfo(order);
  const items = orderItemsFor(order.id);
  const status = statusLabel(order.workflow_status || order.status);
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل الفاتورة</h3>
          <div class="small">نفس البيانات المعروضة في واتساب والداشبورد</div>
        </div>
        <div class="toolbar">
          <select id="orderStatusSelect">
            ${AR_STATUS.map((st) => `<option value="${escapeHtml(st)}" ${st === status ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
          </select>
          <button class="btn primary" data-action="save-order-status" data-id="${escapeHtml(order.id)}" type="button">تحديث الحالة</button>
        </div>
      </div>
      <div class="card" style="background:#fff7e0;border-color:rgba(212,175,55,.26)">
        <pre class="invoice-pre">${escapeHtml(invoiceText)}</pre>
      </div>
      <div class="grid cols-2">
        <div class="item">
          <div class="item-title">بيانات المندوب</div>
          <div class="item-meta">الاسم: ${escapeHtml(rep.name || '—')}<br/>الهاتف: ${escapeHtml(rep.phone || '—')}<br/>المنطقة: ${escapeHtml(rep.region || rep.location || '—')}</div>
        </div>
        <div class="item">
          <div class="item-title">بيانات العميل</div>
          <div class="item-meta">الاسم: ${escapeHtml(customer.name || '—')}<br/>الهاتف: ${escapeHtml(customer.phone || '—')}<br/>العنوان: ${escapeHtml(customer.address || customer.location || '—')}</div>
        </div>
      </div>
      <div class="item">
        <div class="item-title">تفاصيل الطلب</div>
        <div class="list">
          ${items.length ? items.map((item) => `
            <div class="item">
              <div class="item-head">
                <div>
                  <div class="item-title">${escapeHtml(lookupItemName(item))}</div>
                  <div class="item-meta">كود الصنف: ${escapeHtml(lookupItemCode(item))}</div>
                </div>
                <span class="status">${integer(item.qty || 1)} × ${num(item.price || 0)}</span>
              </div>
              <div class="item-meta">الوحدة: ${escapeHtml(item.unit || '—')} · الإجمالي: ${num((Number(item.qty || 0) * Number(item.price || 0)))} جنيه</div>
            </div>
          `).join('') : '<div class="empty-state">لا توجد عناصر لهذا الطلب</div>'}
        </div>
      </div>
      <div class="toolbar">
        <button class="btn" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ الفاتورة</button>
      </div>
    </div>
  `;
}

function customersPage() {
  const selected = customerById(state.selected.customerId) || state.customers[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">العملاء</h3>
          <div class="small">إضافة عميل مباشر جديد، تعديل البيانات، تعديل كلمة المرور، وإعادة الربط بمندوب</div>
        </div>
        <div class="toolbar">
          <button class="btn primary" data-action="toggle-add-customer" type="button">➕ إضافة عميل مباشر جديد</button>
        </div>
      </div>
      ${state.forms.addCustomer ? customerFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          <div class="search-row"><input id="customerSearch" type="search" placeholder="بحث بالاسم أو الهاتف" value="${escapeHtml(state.filters.q)}" /></div>
          ${(state.customers || []).filter((c) => !state.filters.q || [c.name, c.phone, c.address, c.location].join(' ').toLowerCase().includes(state.filters.q.toLowerCase())).map(customerListCard).join('') || '<div class="item">لا يوجد عملاء</div>'}
        </div>
        <div>${selected ? customerDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر عميلاً لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function customerListCard(customer) {
  const rep = repById(customer.sales_rep_id);
  return `
    <div class="item" data-action="select-customer" data-id="${escapeHtml(customer.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(customer.name)}</div>
          <div class="item-meta">${escapeHtml(customer.phone || '—')} · ${escapeHtml(customer.address || customer.location || '—')}</div>
        </div>
        <span class="status ${customer.is_active === false ? 'red' : 'green'}">${customer.is_active === false ? 'محظور' : 'نشط'}</span>
      </div>
      <div class="item-meta">مندوبه: ${escapeHtml(rep?.name || 'بدون مندوب')} · تاريخ التسجيل: ${formatDateTime(customer.created_at)}</div>
    </div>
  `;
}

function customerFormHtml(customer) {
  const c = customer || {};
  return `
    <div class="card">
      <h4>${customer ? 'تعديل العميل' : 'إضافة عميل مباشر جديد'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="custName" type="text" value="${escapeHtml(c.name || '')}" /></label>
        <label class="field"><span>الهاتف</span><input id="custPhone" type="text" value="${escapeHtml(c.phone || '')}" /></label>
        <label class="field"><span>العنوان</span><input id="custAddress" type="text" value="${escapeHtml(c.address || '')}" /></label>
        <label class="field"><span>اسم المستخدم</span><input id="custUsername" type="text" value="${escapeHtml(c.username || '')}" /></label>
        <label class="field"><span>كلمة المرور</span><input id="custPassword" type="password" value="${escapeHtml(c.password || '')}" /></label>
        <label class="field"><span>المنطقة / الموقع</span><input id="custLocation" type="text" value="${escapeHtml(c.location || '')}" /></label>
        <label class="field"><span>المندوب المرتبط</span>
          <select id="custRepId">
            <option value="">بدون مندوب</option>
            ${state.reps.map((r) => `<option value="${escapeHtml(r.id)}" ${(String(c.sales_rep_id) === String(r.id)) ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>الحالة</span>
          <select id="custActive">
            <option value="true" ${c.is_active !== false ? 'selected' : ''}>نشط</option>
            <option value="false" ${c.is_active === false ? 'selected' : ''}>محظور</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-customer" data-id="${escapeHtml(c.id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-customer" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function customerDetailsCard(customer) {
  const rep = repById(customer.sales_rep_id);
  const orders = (state.orders || []).filter((o) => String(o.customer_id) === String(customer.id));
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل العميل</h3>
          <div class="small">تعديل البيانات، كلمة المرور، المندوب، والفواتير</div>
        </div>
        <span class="badge">${escapeHtml(customer.customer_type === 'rep' ? 'عميل مندوب' : 'عميل مباشر')}</span>
      </div>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="editCustName" type="text" value="${escapeHtml(customer.name || '')}" /></label>
        <label class="field"><span>الهاتف</span><input id="editCustPhone" type="text" value="${escapeHtml(customer.phone || '')}" /></label>
        <label class="field"><span>العنوان</span><input id="editCustAddress" type="text" value="${escapeHtml(customer.address || '')}" /></label>
        <label class="field"><span>الموقع</span><input id="editCustLocation" type="text" value="${escapeHtml(customer.location || '')}" /></label>
        <label class="field"><span>اسم المستخدم</span><input id="editCustUsername" type="text" value="${escapeHtml(customer.username || '')}" /></label>
        <label class="field"><span>كلمة المرور</span><input id="editCustPassword" type="password" value="${escapeHtml(customer.password || '')}" /></label>
        <label class="field"><span>المندوب</span>
          <select id="editCustRepId">
            <option value="">بدون مندوب</option>
            ${state.reps.map((r) => `<option value="${escapeHtml(r.id)}" ${String(customer.sales_rep_id) === String(r.id) ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>الحالة</span>
          <select id="editCustActive">
            <option value="true" ${customer.is_active !== false ? 'selected' : ''}>نشط</option>
            <option value="false" ${customer.is_active === false ? 'selected' : ''}>محظور</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-customer-edit" data-id="${escapeHtml(customer.id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="toggle-customer" data-id="${escapeHtml(customer.id)}" type="button">${customer.is_active === false ? 'إلغاء الحظر' : 'حظر'}</button>
        <button class="btn" data-action="delete-customer" data-id="${escapeHtml(customer.id)}" type="button">حذف</button>
      </div>
      <div class="item">
        <div class="item-title">بيانات المندوب المرتبط</div>
        <div class="item-meta">الاسم: ${escapeHtml(rep?.name || 'بدون مندوب')}<br/>الهاتف: ${escapeHtml(rep?.phone || '—')}<br/>المنطقة: ${escapeHtml(rep?.region || '—')}</div>
      </div>
      <div class="item">
        <div class="item-title">فواتير العميل</div>
        <div class="list">
          ${orders.length ? orders.map((order) => orderInvoiceMini(order)).join('') : '<div class="empty-state">لا توجد فواتير لهذا العميل</div>'}
        </div>
      </div>
    </div>
  `;
}

function orderInvoiceMini(order) {
  return `
    <div class="item" data-action="select-order" data-id="${escapeHtml(order.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">فاتورة ${escapeHtml(order.invoice_number || order.order_number || order.id)}</div>
          <div class="item-meta">${escapeHtml(statusLabel(order.workflow_status || order.status))} · ${formatDateTime(order.created_at)}</div>
        </div>
        <span class="status">${num(order.total_amount || 0)} جنيه</span>
      </div>
      <div class="toolbar"><button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">عرض التفاصيل</button></div>
    </div>
  `;
}

function repsPage() {
  const selected = repById(state.selected.repId) || state.reps[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">المناديب</h3>
          <div class="small">إضافة مندوب جديد، تقييم الأداء، الفواتير، وربط العملاء</div>
        </div>
        <button class="btn primary" data-action="toggle-add-rep" type="button">➕ إضافة مندوب جديد</button>
      </div>
      ${state.forms.addRep ? repFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${(state.reps || []).map(repListCard).join('') || '<div class="item">لا يوجد مناديب</div>'}
        </div>
        <div>${selected ? repDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر مندوبًا لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function repListCard(rep) {
  const orders = (state.orders || []).filter((o) => String(o.rep_id || o.sales_rep_id || '') === String(rep.id));
  const sales = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const customers = (state.customers || []).filter((c) => String(c.sales_rep_id || '') === String(rep.id));
  return `
    <div class="item" data-action="select-rep" data-id="${escapeHtml(rep.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(rep.name)}</div>
          <div class="item-meta">${escapeHtml(rep.phone || '—')} · ${escapeHtml(rep.region || '—')}</div>
        </div>
        <span class="status gold">${ratingForRep(rep.id)} / 5</span>
      </div>
      <div class="item-meta">عدد الفواتير: ${integer(orders.length)} · إجمالي الفواتير: ${num(sales)} جنيه · العملاء: ${integer(customers.length)}</div>
    </div>
  `;
}

function repFormHtml(rep) {
  const r = rep || {};
  return `
    <div class="card">
      <h4>${rep ? 'تعديل مندوب' : 'إضافة مندوب جديد'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="repName" type="text" value="${escapeHtml(r.name || '')}" /></label>
        <label class="field"><span>الهاتف</span><input id="repPhone" type="text" value="${escapeHtml(r.phone || '')}" /></label>
        <label class="field"><span>المنطقة</span><input id="repRegion" type="text" value="${escapeHtml(r.region || '')}" /></label>
        <label class="field"><span>اسم المستخدم</span><input id="repUsername" type="text" value="${escapeHtml(r.username || '')}" /></label>
        <label class="field"><span>كلمة المرور</span><input id="repPassword" type="password" value="${escapeHtml(r.password || '')}" /></label>
        <label class="field"><span>الحالة</span>
          <select id="repActive">
            <option value="true" ${r.is_active !== false ? 'selected' : ''}>نشط</option>
            <option value="false" ${r.is_active === false ? 'selected' : ''}>غير نشط</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-rep" data-id="${escapeHtml(r.id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-rep" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function repDetailsCard(rep) {
  const orders = (state.orders || []).filter((o) => String(o.rep_id || o.sales_rep_id || '') === String(rep.id));
  const customers = (state.customers || []).filter((c) => String(c.sales_rep_id || '') === String(rep.id));
  const availableCustomers = (state.customers || []).filter((c) => String(c.sales_rep_id || '') !== String(rep.id));
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل المندوب</h3>
          <div class="small">فواتير، عملاء مرتبطون، وإعادة ربط مباشر</div>
        </div>
        <span class="badge">${ratingForRep(rep.id)} / 5</span>
      </div>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="editRepName" type="text" value="${escapeHtml(rep.name || '')}" /></label>
        <label class="field"><span>الهاتف</span><input id="editRepPhone" type="text" value="${escapeHtml(rep.phone || '')}" /></label>
        <label class="field"><span>المنطقة</span><input id="editRepRegion" type="text" value="${escapeHtml(rep.region || '')}" /></label>
        <label class="field"><span>اسم المستخدم</span><input id="editRepUsername" type="text" value="${escapeHtml(rep.username || '')}" /></label>
        <label class="field"><span>كلمة المرور</span><input id="editRepPassword" type="password" value="${escapeHtml(rep.password || '')}" /></label>
        <label class="field"><span>الحالة</span>
          <select id="editRepActive">
            <option value="true" ${rep.is_active !== false ? 'selected' : ''}>نشط</option>
            <option value="false" ${rep.is_active === false ? 'selected' : ''}>غير نشط</option>
          </select>
        </label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-rep-edit" data-id="${escapeHtml(rep.id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-rep" data-id="${escapeHtml(rep.id)}" type="button">حذف</button>
      </div>
      <div class="item">
        <div class="item-title">تقييم وأداء المندوب</div>
        <div class="item-meta">عدد الفواتير: ${integer(orders.length)}<br/>إجمالي الفواتير: ${num(orders.reduce((s, o) => s + Number(o.total_amount || 0), 0))} جنيه<br/>عدد العملاء: ${integer(customers.length)}</div>
      </div>
      <div class="item">
        <div class="item-title">ربط العملاء الحاليين</div>
        <div class="toolbar">
          <select id="repCustomerSelect">
            <option value="">اختر عميلاً</option>
            ${availableCustomers.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} - ${escapeHtml(c.phone || '')}</option>`).join('')}
          </select>
          <button class="btn primary" data-action="link-customer-to-rep" data-id="${escapeHtml(rep.id)}" type="button">ربط عميل</button>
        </div>
        <div class="list">
          ${customers.length ? customers.map((c) => `
            <div class="item">
              <div class="item-head">
                <div>
                  <div class="item-title">${escapeHtml(c.name)}</div>
                  <div class="item-meta">${escapeHtml(c.phone || '—')} · ${escapeHtml(c.address || c.location || '—')}</div>
                </div>
                <span class="status">${formatDateTime(c.created_at)}</span>
              </div>
              <div class="toolbar">
                <button class="btn" data-action="unlink-customer-from-rep" data-id="${escapeHtml(c.id)}" type="button">إزالة العميل</button>
              </div>
            </div>
          `).join('') : '<div class="empty-state">لا يوجد عملاء مرتبطون</div>'}
        </div>
      </div>
      <div class="item">
        <div class="item-title">فواتير المندوب</div>
        <div class="list">
          ${orders.length ? orders.map((order) => orderInvoiceMini(order)).join('') : '<div class="empty-state">لا توجد فواتير للمندوب</div>'}
        </div>
      </div>
    </div>
  `;
}

function companiesPage() {
  const selected = companyById(state.selected.companyId) || state.companies[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">الشركات</h3>
          <div class="small">تعديل الاسم أو الكود أو الصورة أو الإخفاء</div>
        </div>
        <button class="btn primary" data-action="toggle-add-company" type="button">➕ إضافة شركة</button>
      </div>
      ${state.forms.addCompany ? companyFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${(state.companies || []).map(companyListCard).join('') || '<div class="item">لا توجد شركات</div>'}
        </div>
        <div>${selected ? companyDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر شركة لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function companyListCard(company) {
  return `
    <div class="item" data-action="select-company" data-id="${escapeHtml(company.company_id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(company.company_name)}</div>
          <div class="item-meta">الكود: ${escapeHtml(company.company_id)} · الخصم: ${company.allow_discount === false ? 'معطل' : 'مفعل'}</div>
        </div>
        <span class="status ${company.visible === false ? 'red' : 'green'}">${company.visible === false ? 'مخفي' : 'ظاهر'}</span>
      </div>
    </div>
  `;
}

function companyFormHtml(company) {
  const c = company || {};
  return `
    <div class="card">
      <h4>${company ? 'تعديل شركة' : 'إضافة شركة'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>كود الشركة</span><input id="companyCode" type="text" value="${escapeHtml(c.company_id || '')}" /></label>
        <label class="field"><span>اسم الشركة</span><input id="companyName" type="text" value="${escapeHtml(c.company_name || '')}" /></label>
        <label class="field"><span>صورة / لوجو</span><input id="companyLogo" type="text" value="${escapeHtml(c.company_logo || '')}" /></label>
        <label class="field"><span>الظهور</span>
          <select id="companyVisible"><option value="true" ${c.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${c.visible === false ? 'selected' : ''}>مخفي</option></select>
        </label>
        <label class="field"><span>السماح بالخصم</span>
          <select id="companyDiscount"><option value="true" ${c.allow_discount !== false ? 'selected' : ''}>مفعل</option><option value="false" ${c.allow_discount === false ? 'selected' : ''}>معطل</option></select>
        </label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-company" data-id="${escapeHtml(c.company_id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-company" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function companyDetailsCard(company) {
  const products = (state.products || []).filter((p) => String(p.company_id) === String(company.company_id));
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل الشركة</h3>
          <div class="small">تعديل الاسم أو الكود أو الصورة أو الإخفاء</div>
        </div>
      </div>
      <div class="grid cols-2">
        <label class="field"><span>الكود</span><input id="editCompanyCode" type="text" value="${escapeHtml(company.company_id || '')}" /></label>
        <label class="field"><span>الاسم</span><input id="editCompanyName" type="text" value="${escapeHtml(company.company_name || '')}" /></label>
        <label class="field"><span>الصورة</span><input id="editCompanyLogo" type="text" value="${escapeHtml(company.company_logo || '')}" /></label>
        <label class="field"><span>الظهور</span><select id="editCompanyVisible"><option value="true" ${company.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${company.visible === false ? 'selected' : ''}>مخفي</option></select></label>
        <label class="field"><span>السماح بالخصم</span><select id="editCompanyDiscount"><option value="true" ${company.allow_discount !== false ? 'selected' : ''}>مفعل</option><option value="false" ${company.allow_discount === false ? 'selected' : ''}>معطل</option></select></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-company-edit" data-id="${escapeHtml(company.company_id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-company" data-id="${escapeHtml(company.company_id)}" type="button">حذف</button>
      </div>
      <div class="item">
        <div class="item-title">المنتجات المرتبطة</div>
        <div class="list">
          ${products.length ? products.map((p) => `
            <div class="item">
              <div class="item-head">
                <div>
                  <div class="item-title">${escapeHtml(p.product_name)}</div>
                  <div class="item-meta">الكود: ${escapeHtml(p.product_id)} · الحالة: ${escapeHtml(p.status || '—')}</div>
                </div>
                <span class="status ${p.visible === false ? 'red' : 'green'}">${p.visible === false ? 'مخفي' : 'ظاهر'}</span>
              </div>
            </div>
          `).join('') : '<div class="empty-state">لا توجد منتجات مرتبطة</div>'}
        </div>
      </div>
    </div>
  `;
}

function productsPage() {
  const selected = productById(state.selected.productId) || state.products[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">المنتجات</h3>
          <div class="small">إضافة منتج، تعديل الكود والصورة والأسعار والوحدات والخصم والظهور</div>
        </div>
        <button class="btn primary" data-action="toggle-add-product" type="button">➕ إضافة منتج جديد</button>
      </div>
      ${state.forms.addProduct ? productFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          <div class="search-row"><input id="productSearch" type="search" placeholder="بحث بالاسم أو الكود" value="${escapeHtml(state.filters.q)}" /></div>
          ${(state.products || []).filter((p) => !state.filters.q || [p.product_name, p.product_id, companyById(p.company_id)?.company_name || ''].join(' ').toLowerCase().includes(state.filters.q.toLowerCase())).map(productListCard).join('') || '<div class="item">لا توجد منتجات</div>'}
        </div>
        <div>${selected ? productDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر منتجًا لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function productListCard(product) {
  const company = companyById(product.company_id);
  return `
    <div class="item" data-action="select-product" data-id="${escapeHtml(product.product_id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(product.product_name)}</div>
          <div class="item-meta">${escapeHtml(product.product_id)} · ${escapeHtml(company?.company_name || product.company_id || '—')}</div>
        </div>
        <span class="status ${product.visible === false ? 'red' : 'green'}">${product.visible === false ? 'مخفي' : 'ظاهر'}</span>
      </div>
      <div class="item-meta">الحالة: ${escapeHtml(product.status || 'active')} · الكرتونة: ${product.has_carton ? 'نعم' : 'لا'} · الدستة: ${product.has_pack ? 'نعم' : 'لا'}</div>
    </div>
  `;
}

function productFormHtml(product) {
  const p = product || {};
  const carton = getBasePrice('prices_carton', p.product_id);
  const pack = getBasePrice('prices_pack', p.product_id);
  return `
    <div class="card">
      <h4>${product ? 'تعديل منتج' : 'إضافة منتج جديد'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>كود المنتج</span><input id="productCode" type="text" value="${escapeHtml(p.product_id || '')}" /></label>
        <label class="field"><span>اسم المنتج</span><input id="productName" type="text" value="${escapeHtml(p.product_name || '')}" /></label>
        <label class="field"><span>الشركة</span>
          <select id="productCompany">
            <option value="">اختر الشركة</option>
            ${state.companies.map((c) => `<option value="${escapeHtml(c.company_id)}" ${String(p.company_id) === String(c.company_id) ? 'selected' : ''}>${escapeHtml(c.company_name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>الصورة</span><input id="productImage" type="text" value="${escapeHtml(p.product_image || '')}" /></label>
        <label class="field"><span>حالة المنتج</span><select id="productStatus"><option value="active" ${String(p.status || 'active') === 'active' ? 'selected' : ''}>متاح</option><option value="out_of_stock" ${String(p.status) === 'out_of_stock' ? 'selected' : ''}>نفذت الكمية</option><option value="inactive" ${String(p.status) === 'inactive' ? 'selected' : ''}>غير متاح</option></select></label>
        <label class="field"><span>الظهور في الموقع</span><select id="productVisible"><option value="true" ${p.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${p.visible === false ? 'selected' : ''}>مخفي</option></select></label>
        <label class="field"><span>تفعيل الكرتونة</span><select id="productHasCarton"><option value="true" ${p.has_carton ? 'selected' : ''}>نعم</option><option value="false" ${!p.has_carton ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>تفعيل الدستة</span><select id="productHasPack"><option value="true" ${p.has_pack ? 'selected' : ''}>نعم</option><option value="false" ${!p.has_pack ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>خصم الشرائح على الكرتونة</span><select id="productDiscountCarton"><option value="true" ${p.discount_carton !== false ? 'selected' : ''}>مفعل</option><option value="false" ${p.discount_carton === false ? 'selected' : ''}>معطل</option></select></label>
        <label class="field"><span>خصم الشرائح على الدستة</span><select id="productDiscountPack"><option value="true" ${p.discount_pack !== false ? 'selected' : ''}>مفعل</option><option value="false" ${p.discount_pack === false ? 'selected' : ''}>معطل</option></select></label>
        <label class="field"><span>سعر الكرتونة</span><input id="productCartonPrice" type="number" step="0.01" value="${escapeHtml(carton)}" /></label>
        <label class="field"><span>سعر الدستة</span><input id="productPackPrice" type="number" step="0.01" value="${escapeHtml(pack)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-product" data-id="${escapeHtml(p.product_id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-product" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function getBasePrice(table, productId) {
  const row = (state[table] || []).find((r) => String(r.product_id) === String(productId) && String(r.tier_name || '') === 'base');
  return row?.price ?? '';
}

function productDetailsCard(product) {
  const company = companyById(product.company_id);
  const carton = getBasePrice('prices_carton', product.product_id);
  const pack = getBasePrice('prices_pack', product.product_id);
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل المنتج</h3>
          <div class="small">تعديل الاسم والكود والصورة والأسعار والوحدات والخصم</div>
        </div>
      </div>
      <div class="grid cols-2">
        <label class="field"><span>كود المنتج</span><input id="editProductCode" type="text" value="${escapeHtml(product.product_id || '')}" /></label>
        <label class="field"><span>اسم المنتج</span><input id="editProductName" type="text" value="${escapeHtml(product.product_name || '')}" /></label>
        <label class="field"><span>الشركة</span>
          <select id="editProductCompany">
            <option value="">اختر الشركة</option>
            ${state.companies.map((c) => `<option value="${escapeHtml(c.company_id)}" ${String(product.company_id) === String(c.company_id) ? 'selected' : ''}>${escapeHtml(c.company_name)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>الصورة</span><input id="editProductImage" type="text" value="${escapeHtml(product.product_image || '')}" /></label>
        <label class="field"><span>الحالة</span><select id="editProductStatus"><option value="active" ${String(product.status || 'active') === 'active' ? 'selected' : ''}>متاح</option><option value="out_of_stock" ${String(product.status) === 'out_of_stock' ? 'selected' : ''}>نفذت الكمية</option><option value="inactive" ${String(product.status) === 'inactive' ? 'selected' : ''}>غير متاح</option></select></label>
        <label class="field"><span>الظهور</span><select id="editProductVisible"><option value="true" ${product.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${product.visible === false ? 'selected' : ''}>مخفي</option></select></label>
        <label class="field"><span>تفعيل الكرتونة</span><select id="editProductHasCarton"><option value="true" ${product.has_carton ? 'selected' : ''}>نعم</option><option value="false" ${!product.has_carton ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>تفعيل الدستة</span><select id="editProductHasPack"><option value="true" ${product.has_pack ? 'selected' : ''}>نعم</option><option value="false" ${!product.has_pack ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>خصم الشرائح على الكرتونة</span><select id="editProductDiscountCarton"><option value="true" ${product.discount_carton !== false ? 'selected' : ''}>مفعل</option><option value="false" ${product.discount_carton === false ? 'selected' : ''}>معطل</option></select></label>
        <label class="field"><span>خصم الشرائح على الدستة</span><select id="editProductDiscountPack"><option value="true" ${product.discount_pack !== false ? 'selected' : ''}>مفعل</option><option value="false" ${product.discount_pack === false ? 'selected' : ''}>معطل</option></select></label>
        <label class="field"><span>سعر الكرتونة</span><input id="editProductCartonPrice" type="number" step="0.01" value="${escapeHtml(carton)}" /></label>
        <label class="field"><span>سعر الدستة</span><input id="editProductPackPrice" type="number" step="0.01" value="${escapeHtml(pack)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-product-edit" data-id="${escapeHtml(product.product_id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-product" data-id="${escapeHtml(product.product_id)}" type="button">حذف</button>
      </div>
      <div class="item-meta">الشركة: ${escapeHtml(company?.company_name || '—')}</div>
    </div>
  `;
}

function tiersPage() {
  const selected = tierByName(state.selected.tierName) || state.tiers[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">الشرائح</h3>
          <div class="small">عرض الشرائح الحالية، تعديل الاسم الظاهر، النسبة، الافتراضي، والإخفاء</div>
        </div>
        <button class="btn primary" data-action="toggle-add-tier" type="button">➕ إضافة شريحة جديدة</button>
      </div>
      ${state.forms.addTier ? tierFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${(state.tiers || []).map(tierListCard).join('') || '<div class="item">لا توجد شرائح</div>'}
        </div>
        <div>${selected ? tierDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر شريحة لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function tierListCard(tier) {
  return `
    <div class="item" data-action="select-tier" data-id="${escapeHtml(tier.tier_name)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(tier.visible_label || tier.tier_name)}</div>
          <div class="item-meta">الاسم التقني: ${escapeHtml(tier.tier_name)} · نسبة الخصم: ${num(tier.discount_percent || 0)}%</div>
        </div>
        <span class="status ${tier.is_default ? 'gold' : tier.visible === false ? 'red' : 'green'}">${tier.is_default ? 'افتراضية' : tier.visible === false ? 'مخفية' : 'نشطة'}</span>
      </div>
    </div>
  `;
}

function tierFormHtml(tier) {
  const t = tier || {};
  return `
    <div class="card">
      <h4>${tier ? 'تعديل شريحة' : 'إضافة شريحة'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>اسم الشريحة التقني</span><input id="tierName" type="text" value="${escapeHtml(t.tier_name || '')}" /></label>
        <label class="field"><span>الاسم المعروض</span><input id="tierLabel" type="text" value="${escapeHtml(t.visible_label || '')}" /></label>
        <label class="field"><span>الحد الأدنى</span><input id="tierMinOrder" type="number" step="0.01" value="${escapeHtml(t.min_order || 0)}" /></label>
        <label class="field"><span>نسبة الخصم</span><input id="tierDiscount" type="number" step="0.01" value="${escapeHtml(t.discount_percent || 0)}" /></label>
        <label class="field"><span>افتراضية</span><select id="tierDefault"><option value="true" ${t.is_default ? 'selected' : ''}>نعم</option><option value="false" ${!t.is_default ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>الظهور</span><select id="tierVisible"><option value="true" ${t.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${t.visible === false ? 'selected' : ''}>مخفي</option></select></label>
        <label class="field"><span>الحالة</span><select id="tierActive"><option value="true" ${t.is_active !== false ? 'selected' : ''}>مفعل</option><option value="false" ${t.is_active === false ? 'selected' : ''}>معطل</option></select></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-tier" data-id="${escapeHtml(t.tier_name || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-tier" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function tierDetailsCard(tier) {
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">تفاصيل الشريحة</h3>
          <div class="small">الاسم المعروض، نسبة الخصم، الافتراضية، والإخفاء</div>
        </div>
      </div>
      <div class="grid cols-2">
        <label class="field"><span>الاسم التقني</span><input id="editTierName" type="text" value="${escapeHtml(tier.tier_name || '')}" /></label>
        <label class="field"><span>الاسم المعروض</span><input id="editTierLabel" type="text" value="${escapeHtml(tier.visible_label || '')}" /></label>
        <label class="field"><span>الحد الأدنى</span><input id="editTierMinOrder" type="number" step="0.01" value="${escapeHtml(tier.min_order || 0)}" /></label>
        <label class="field"><span>نسبة الخصم</span><input id="editTierDiscount" type="number" step="0.01" value="${escapeHtml(tier.discount_percent || 0)}" /></label>
        <label class="field"><span>افتراضية</span><select id="editTierDefault"><option value="true" ${tier.is_default ? 'selected' : ''}>نعم</option><option value="false" ${!tier.is_default ? 'selected' : ''}>لا</option></select></label>
        <label class="field"><span>الظهور</span><select id="editTierVisible"><option value="true" ${tier.visible !== false ? 'selected' : ''}>ظاهر</option><option value="false" ${tier.visible === false ? 'selected' : ''}>مخفي</option></select></label>
        <label class="field"><span>الحالة</span><select id="editTierActive"><option value="true" ${tier.is_active !== false ? 'selected' : ''}>مفعل</option><option value="false" ${tier.is_active === false ? 'selected' : ''}>معطل</option></select></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-tier-edit" data-id="${escapeHtml(tier.tier_name)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-tier" data-id="${escapeHtml(tier.tier_name)}" type="button">حذف</button>
      </div>
    </div>
  `;
}

function dealsPage() {
  const selected = dealById(state.selected.dealId) || state.dailyDeals[0] || null;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">صفقة اليوم</h3>
          <div class="small">عرض الصفقات الحالية، الإضافة، التعديل، الحذف</div>
        </div>
        <button class="btn primary" data-action="toggle-add-deal" type="button">➕ إضافة عرض في صفقة اليوم</button>
      </div>
      ${state.forms.addDeal ? dealFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${(state.dailyDeals || []).map(dealListCard).join('') || '<div class="item">لا توجد صفقة اليوم</div>'}
        </div>
        <div>${selected ? dealDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر عرضًا لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function dealListCard(deal) {
  return `
    <div class="item" data-action="select-deal" data-id="${escapeHtml(deal.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(deal.title)}</div>
          <div class="item-meta">${escapeHtml(deal.description || '—')} · ${num(deal.price || 0)} جنيه</div>
        </div>
        <span class="status ${deal.is_active === false ? 'red' : 'green'}">${deal.is_active === false ? 'منتهي' : 'متاح'}</span>
      </div>
    </div>
  `;
}

function dealFormHtml(deal) {
  const d = deal || {};
  return `
    <div class="card">
      <h4>${deal ? 'تعديل عرض صفقة اليوم' : 'إضافة عرض في صفقة اليوم'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="dealTitle" type="text" value="${escapeHtml(d.title || '')}" /></label>
        <label class="field"><span>الوصف</span><input id="dealDescription" type="text" value="${escapeHtml(d.description || '')}" /></label>
        <label class="field"><span>السعر</span><input id="dealPrice" type="number" step="0.01" value="${escapeHtml(d.price || 0)}" /></label>
        <label class="field"><span>الصورة</span><input id="dealImage" type="text" value="${escapeHtml(d.image || '')}" /></label>
        <label class="field"><span>الحالة</span><select id="dealActive"><option value="true" ${d.is_active !== false ? 'selected' : ''}>متاح</option><option value="false" ${d.is_active === false ? 'selected' : ''}>منتهي</option></select></label>
        <label class="field"><span>الكمية</span><input id="dealStock" type="number" step="1" value="${escapeHtml(d.stock || 0)}" /></label>
        <label class="field"><span>المباع</span><input id="dealSold" type="number" step="1" value="${escapeHtml(d.sold_count || 0)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-deal" data-id="${escapeHtml(d.id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-deal" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function dealDetailsCard(deal) {
  const report = buildDealStats().find((x) => String(x.type) === 'deal' && String(x.id) === String(deal.id)) || { purchases: 0, total_amount: 0 };
  return `
    <div class="card">
      <h3>تفاصيل العرض</h3>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="editDealTitle" type="text" value="${escapeHtml(deal.title || '')}" /></label>
        <label class="field"><span>الوصف</span><input id="editDealDescription" type="text" value="${escapeHtml(deal.description || '')}" /></label>
        <label class="field"><span>السعر</span><input id="editDealPrice" type="number" step="0.01" value="${escapeHtml(deal.price || 0)}" /></label>
        <label class="field"><span>الصورة</span><input id="editDealImage" type="text" value="${escapeHtml(deal.image || '')}" /></label>
        <label class="field"><span>الحالة</span><select id="editDealActive"><option value="true" ${deal.is_active !== false ? 'selected' : ''}>متاح</option><option value="false" ${deal.is_active === false ? 'selected' : ''}>منتهي</option></select></label>
        <label class="field"><span>الكمية</span><input id="editDealStock" type="number" step="1" value="${escapeHtml(deal.stock || 0)}" /></label>
        <label class="field"><span>المباع</span><input id="editDealSold" type="number" step="1" value="${escapeHtml(deal.sold_count || 0)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-deal-edit" data-id="${escapeHtml(deal.id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-deal" data-id="${escapeHtml(deal.id)}" type="button">حذف</button>
      </div>
      <div class="item-meta">عدد المشتريات: ${integer(report.purchases || 0)} · إجمالي المبلغ: ${num(report.total_amount || 0)} جنيه</div>
    </div>
  `;
}

function flashPage() {
  const selected = flashById(state.selected.flashId) || state.flashOffers[0] || null;
  const active = selected && selected.can_buy !== false && selected.is_active !== false;
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">عرض الساعة</h3>
          <div class="small">عرض العروض الحالية، التعديل، الإضافة، والحذف</div>
        </div>
        <button class="btn primary" data-action="toggle-add-flash" type="button">➕ إضافة عرض جديد</button>
      </div>
      ${state.forms.addFlash ? flashFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${(state.flashOffers || []).map(flashListCard).join('') || '<div class="item">لا توجد عروض ساعة</div>'}
        </div>
        <div>${selected ? flashDetailsCard(selected) : '<div class="card"><div class="empty-state">اختر عرضًا لعرض التفاصيل</div></div>'}</div>
      </div>
    </div>
  `;
}

function flashListCard(offer) {
  return `
    <div class="item" data-action="select-flash" data-id="${escapeHtml(offer.id)}">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(offer.title)}</div>
          <div class="item-meta">${escapeHtml(offer.description || '—')} · ${num(offer.price || 0)} جنيه</div>
        </div>
        <span class="status ${offer.is_active === false ? 'red' : 'green'}">${offer.is_active === false ? 'منتهي' : 'متاح'}</span>
      </div>
      <div class="item-meta">من ${formatDateTime(offer.start_time)} إلى ${formatDateTime(offer.end_time)}</div>
    </div>
  `;
}

function flashFormHtml(offer) {
  const f = offer || {};
  return `
    <div class="card">
      <h4>${offer ? 'تعديل عرض ساعة' : 'إضافة عرض جديد'}</h4>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="flashTitle" type="text" value="${escapeHtml(f.title || '')}" /></label>
        <label class="field"><span>الوصف</span><input id="flashDescription" type="text" value="${escapeHtml(f.description || '')}" /></label>
        <label class="field"><span>السعر</span><input id="flashPrice" type="number" step="0.01" value="${escapeHtml(f.price || 0)}" /></label>
        <label class="field"><span>الصورة</span><input id="flashImage" type="text" value="${escapeHtml(f.image || '')}" /></label>
        <label class="field"><span>بداية العرض</span><input id="flashStart" type="datetime-local" value="${formatDateTimeInput(f.start_time)}" /></label>
        <label class="field"><span>نهاية العرض</span><input id="flashEnd" type="datetime-local" value="${formatDateTimeInput(f.end_time)}" /></label>
        <label class="field"><span>الحالة</span><select id="flashActive"><option value="true" ${f.is_active !== false ? 'selected' : ''}>متاح</option><option value="false" ${f.is_active === false ? 'selected' : ''}>منتهي</option></select></label>
        <label class="field"><span>الكمية</span><input id="flashStock" type="number" step="1" value="${escapeHtml(f.stock || 0)}" /></label>
        <label class="field"><span>المباع</span><input id="flashSold" type="number" step="1" value="${escapeHtml(f.sold_count || 0)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-flash" data-id="${escapeHtml(f.id || '')}" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-flash" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function flashDetailsCard(offer) {
  const report = buildDealStats().find((x) => String(x.type) === 'flash' && String(x.id) === String(offer.id)) || { purchases: 0, total_amount: 0 };
  return `
    <div class="card">
      <h3>تفاصيل العرض</h3>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="editFlashTitle" type="text" value="${escapeHtml(offer.title || '')}" /></label>
        <label class="field"><span>الوصف</span><input id="editFlashDescription" type="text" value="${escapeHtml(offer.description || '')}" /></label>
        <label class="field"><span>السعر</span><input id="editFlashPrice" type="number" step="0.01" value="${escapeHtml(offer.price || 0)}" /></label>
        <label class="field"><span>الصورة</span><input id="editFlashImage" type="text" value="${escapeHtml(offer.image || '')}" /></label>
        <label class="field"><span>بداية العرض</span><input id="editFlashStart" type="datetime-local" value="${formatDateTimeInput(offer.start_time)}" /></label>
        <label class="field"><span>نهاية العرض</span><input id="editFlashEnd" type="datetime-local" value="${formatDateTimeInput(offer.end_time)}" /></label>
        <label class="field"><span>الحالة</span><select id="editFlashActive"><option value="true" ${offer.is_active !== false ? 'selected' : ''}>متاح</option><option value="false" ${offer.is_active === false ? 'selected' : ''}>منتهي</option></select></label>
        <label class="field"><span>الكمية</span><input id="editFlashStock" type="number" step="1" value="${escapeHtml(offer.stock || 0)}" /></label>
        <label class="field"><span>المباع</span><input id="editFlashSold" type="number" step="1" value="${escapeHtml(offer.sold_count || 0)}" /></label>
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-flash-edit" data-id="${escapeHtml(offer.id)}" type="button">حفظ التعديلات</button>
        <button class="btn" data-action="delete-flash" data-id="${escapeHtml(offer.id)}" type="button">حذف</button>
      </div>
      <div class="item-meta">عدد المشتريات: ${integer(report.purchases || 0)} · إجمالي المبلغ: ${num(report.total_amount || 0)} جنيه</div>
    </div>
  `;
}

function reportsPage() {
  const statsStatus = state.views.ordersStatus || computeOrdersStatusFromRaw();
  const topCompanies = (state.views.topCompanies && state.views.topCompanies.length) ? state.views.topCompanies : computeTopCompaniesFromRaw();
  const topProducts = (state.views.topProducts && state.views.topProducts.length) ? state.views.topProducts : computeTopProductsFromRaw();
  const topCustomers = (state.views.topCustomers && state.views.topCustomers.length) ? state.views.topCustomers : computeTopCustomersFromRaw();
  const repsPerformance = (state.views.repsPerformance && state.views.repsPerformance.length) ? state.views.repsPerformance : computeRepsPerformanceFromRaw();
  const salesDaily = (state.views.salesDaily && state.views.salesDaily.length) ? state.views.salesDaily : computeDailySalesFromRaw();
  const dealStats = buildDealStats();
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">التقارير</h3>
          <div class="small">اختر فترة من/إلى، ثم راجع تقارير الطلبات والشركات والمنتجات والعملاء والمناديب والعروض</div>
        </div>
        <div class="toolbar">
          <input id="reportFrom" type="date" value="${escapeHtml(state.filters.from)}" />
          <input id="reportTo" type="date" value="${escapeHtml(state.filters.to)}" />
          <button class="btn primary" data-action="apply-report-filter" type="button">تحديث الفترة</button>
        </div>
      </div>

      <div class="grid cols-3">
        <div class="stat"><div class="label">الطلبات</div><div class="value">${integer(rawOrdersFilteredByRange().length)}</div></div>
        <div class="stat"><div class="label">المبيعات</div><div class="value">${num(rawOrdersFilteredByRange().reduce((s, o) => s + Number(o.total_amount || 0), 0))} جنيه</div></div>
        <div class="stat"><div class="label">المناطق / الأيام</div><div class="value">${integer(salesDaily.length)}</div></div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h4>تقارير الطلبات</h4>
          <div class="list">
            ${Object.entries(statsStatus).length ? Object.entries(statsStatus).map(([status, info]) => `
              <div class="item">
                <div class="item-head"><div class="item-title">${escapeHtml(status)}</div><span class="status">${integer(info.count)} طلب</span></div>
                <div class="item-meta">إجمالي: ${num(info.total)} جنيه</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
        <div class="card">
          <h4>تقارير الأيام</h4>
          <div class="list">
            ${salesDaily.length ? salesDaily.map((row) => `
              <div class="item">
                <div class="item-head"><div class="item-title">${escapeHtml(row.day || '—')}</div><span class="status">${integer(row.orders_count || 0)} طلب</span></div>
                <div class="item-meta">إجمالي المبيعات: ${num(row.total_sales || 0)} جنيه</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h4>تقارير أعلى الشركات</h4>
          <div class="list">
            ${topCompanies.length ? topCompanies.map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.company_name || row.company_id || '—')}</div><div class="item-meta">كود: ${escapeHtml(row.company_id || '—')}</div></div><span class="status">${num(row.total_sales || 0)} جنيه</span></div>
                <div class="item-meta">عدد الأصناف: ${integer(row.total_items || 0)}</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
        <div class="card">
          <h4>تقارير أعلى المنتجات</h4>
          <div class="list">
            ${topProducts.length ? topProducts.map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.product_name || row.product_id || '—')}</div><div class="item-meta">كود: ${escapeHtml(row.product_id || '—')}</div></div><span class="status">${integer(row.total_qty || 0)} قطعة</span></div>
                <div class="item-meta">إجمالي: ${num(row.total_sales || 0)} جنيه</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h4>أفضل العملاء</h4>
          <div class="list">
            ${topCustomers.length ? topCustomers.map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.name || '—')}</div><div class="item-meta">${escapeHtml(row.phone || '')}</div></div><span class="status">${integer(row.total_orders || 0)} طلب</span></div>
                <div class="item-meta">إجمالي المشتريات: ${num(row.total_spent || 0)} جنيه</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
        <div class="card">
          <h4>تقارير المناديب</h4>
          <div class="list">
            ${repsPerformance.length ? repsPerformance.map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.name || '—')}</div><div class="item-meta">${escapeHtml(row.region || '')}</div></div><span class="status">${integer(row.total_orders || 0)} طلب</span></div>
                <div class="item-meta">إجمالي: ${num(row.total_sales || 0)} جنيه</div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h4>تقارير صفقة اليوم</h4>
          <div class="list">
            ${dealStats.filter((row) => row.type === 'deal').length ? dealStats.filter((row) => row.type === 'deal').map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.title)}</div><div class="item-meta">عدد المشتريات: ${integer(row.purchases || 0)}</div></div><span class="status">${num(row.total_amount || 0)} جنيه</span></div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
        <div class="card">
          <h4>تقارير عرض الساعة</h4>
          <div class="list">
            ${dealStats.filter((row) => row.type === 'flash').length ? dealStats.filter((row) => row.type === 'flash').map((row) => `
              <div class="item">
                <div class="item-head"><div><div class="item-title">${escapeHtml(row.title)}</div><div class="item-meta">عدد المشتريات: ${integer(row.purchases || 0)}</div></div><span class="status">${num(row.total_amount || 0)} جنيه</span></div>
              </div>
            `).join('') : '<div class="empty-state">لا توجد بيانات</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}

function usersPage() {
  const users = authUsers();
  return `
    <div class="card">
      <div class="header" style="margin:0">
        <div>
          <h3 style="margin:0">إدارة المستخدمين</h3>
          <div class="small">المستخدمون محليون داخل الكود، والصلاحيات مفاتيح عرض فقط</div>
        </div>
        <button class="btn primary" data-action="toggle-add-user" type="button">➕ إضافة مستخدم</button>
      </div>
      ${state.forms.addUser ? userFormHtml(null) : ''}
      <div class="grid cols-2">
        <div class="list">
          ${users.map(localUserCard).join('') || '<div class="item">لا يوجد مستخدمون</div>'}
        </div>
        <div class="card">
          <h4>ملاحظات</h4>
          <div class="item-meta">هذا القسم لا يكتب إلى قاعدة البيانات، لأن المستخدمين محفوظون محليًا حسب متطلباتك الحالية.</div>
        </div>
      </div>
    </div>
  `;
}

function localUserCard(user, idx) {
  return `
    <div class="item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(user.name)}</div>
          <div class="item-meta">${escapeHtml(user.username)}</div>
        </div>
        <span class="status">${integer(userPermissionsCount(user))} صلاحيات</span>
      </div>
      <div class="toolbar">
        <button class="btn" data-action="delete-local-user" data-id="${idx}" type="button">حذف</button>
      </div>
    </div>
  `;
}

function userPermissionsCount(user) {
  return Object.values(user.permissions || {}).filter(Boolean).length;
}

function userFormHtml(user) {
  const u = user || {};
  const p = u.permissions || {};
  return `
    <div class="card">
      <h4>إضافة مستخدم محلي</h4>
      <div class="grid cols-2">
        <label class="field"><span>الاسم</span><input id="uName" type="text" value="${escapeHtml(u.name || '')}" /></label>
        <label class="field"><span>اسم المستخدم</span><input id="uUsername" type="text" value="${escapeHtml(u.username || '')}" /></label>
        <label class="field"><span>كلمة المرور</span><input id="uPassword" type="password" value="${escapeHtml(u.password || '')}" /></label>
      </div>
      <div class="grid cols-3">
        ${permissionToggle('dashboard', 'الرئيسية', p.dashboard !== false)}
        ${permissionToggle('orders', 'الطلبات', p.orders !== false)}
        ${permissionToggle('customers', 'العملاء', p.customers !== false)}
        ${permissionToggle('reps', 'المناديب', p.reps !== false)}
        ${permissionToggle('companies', 'الشركات', p.companies !== false)}
        ${permissionToggle('products', 'المنتجات', p.products !== false)}
        ${permissionToggle('tiers', 'الشرائح', p.tiers !== false)}
        ${permissionToggle('deals', 'صفقة اليوم', p.deals !== false)}
        ${permissionToggle('flash', 'عرض الساعة', p.flash !== false)}
        ${permissionToggle('reports', 'التقارير', p.reports !== false)}
        ${permissionToggle('users', 'المستخدمين', p.users !== false)}
      </div>
      <div class="toolbar">
        <button class="btn primary" data-action="save-local-user" type="button">حفظ</button>
        <button class="btn" data-action="cancel-add-user" type="button">إلغاء</button>
      </div>
    </div>
  `;
}

function permissionToggle(key, label, checked) {
  return `<label class="item"><input type="checkbox" id="perm_${key}" ${checked ? 'checked' : ''} /> ${label}</label>`;
}

function bindLogin() {
  document.getElementById('loginBtn')?.addEventListener('click', attemptLogin);
  document.getElementById('resetUsersBtn')?.addEventListener('click', () => {
    state.users = JSON.parse(JSON.stringify(LOCAL_USERS));
    saveJSON(STORAGE.users, state.users);
    toast('تمت استعادة المستخدمين المحليين');
  });
  document.addEventListener('keydown', onLoginKeydown, { once: true });
}

function onLoginKeydown(e) {
  if (e.key === 'Enter') attemptLogin();
}

function attemptLogin() {
  const username = document.getElementById('loginUsername')?.value || '';
  const password = document.getElementById('loginPassword')?.value || '';
  try {
    localLogin(username, password);
    toast('تم تسجيل الدخول');
    syncRouteFromHash();
  } catch (error) {
    toast('بيانات الدخول غير صحيحة');
  }
}

function bindShell() {
  document.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.getAttribute('data-page')));
  });
  document.getElementById('backBtn')?.addEventListener('click', () => history.back());
  document.getElementById('homeBtn')?.addEventListener('click', () => navigate(DEFAULT_PAGE));
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
}

function render() {
  if (!state.user) {
    renderShell();
    return;
  }
  renderShell();
  bindPageEvents();
}

function bindPageEvents() {
  const onClick = async (event) => {
    const target = event.target.closest('[data-action], [data-page]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    const page = target.getAttribute('data-page');
    if (page) {
      navigate(page);
      return;
    }
    try {
      if (action === 'select-order') { state.selected.orderId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-order-status') { await updateOrderStatus(target.getAttribute('data-id')); return; }
      if (action === 'delete-order') { await deleteOrder(target.getAttribute('data-id')); return; }
      if (action === 'copy-invoice') { await copyInvoice(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-customer') { state.forms.addCustomer = !state.forms.addCustomer; render(); return; }
      if (action === 'cancel-add-customer') { state.forms.addCustomer = false; render(); return; }
      if (action === 'select-customer') { state.selected.customerId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-customer') { await saveCustomer(null); return; }
      if (action === 'save-customer-edit') { await saveCustomer(target.getAttribute('data-id')); return; }
      if (action === 'toggle-customer') { await toggleCustomer(target.getAttribute('data-id')); return; }
      if (action === 'delete-customer') { await deleteCustomer(target.getAttribute('data-id')); return; }
      if (action === 'link-customer-to-rep') { await linkCustomerToRep(target.getAttribute('data-id')); return; }
      if (action === 'unlink-customer-from-rep') { await unlinkCustomerFromRep(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-rep') { state.forms.addRep = !state.forms.addRep; render(); return; }
      if (action === 'cancel-add-rep') { state.forms.addRep = false; render(); return; }
      if (action === 'select-rep') { state.selected.repId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-rep') { await saveRep(null); return; }
      if (action === 'save-rep-edit') { await saveRep(target.getAttribute('data-id')); return; }
      if (action === 'delete-rep') { await deleteRep(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-company') { state.forms.addCompany = !state.forms.addCompany; render(); return; }
      if (action === 'cancel-add-company') { state.forms.addCompany = false; render(); return; }
      if (action === 'select-company') { state.selected.companyId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-company') { await saveCompany(null); return; }
      if (action === 'save-company-edit') { await saveCompany(target.getAttribute('data-id')); return; }
      if (action === 'delete-company') { await deleteCompany(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-product') { state.forms.addProduct = !state.forms.addProduct; render(); return; }
      if (action === 'cancel-add-product') { state.forms.addProduct = false; render(); return; }
      if (action === 'select-product') { state.selected.productId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-product') { await saveProduct(null); return; }
      if (action === 'save-product-edit') { await saveProduct(target.getAttribute('data-id')); return; }
      if (action === 'delete-product') { await deleteProduct(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-tier') { state.forms.addTier = !state.forms.addTier; render(); return; }
      if (action === 'cancel-add-tier') { state.forms.addTier = false; render(); return; }
      if (action === 'select-tier') { state.selected.tierName = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-tier') { await saveTier(null); return; }
      if (action === 'save-tier-edit') { await saveTier(target.getAttribute('data-id')); return; }
      if (action === 'delete-tier') { await deleteTier(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-deal') { state.forms.addDeal = !state.forms.addDeal; render(); return; }
      if (action === 'cancel-add-deal') { state.forms.addDeal = false; render(); return; }
      if (action === 'select-deal') { state.selected.dealId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-deal') { await saveDeal(null); return; }
      if (action === 'save-deal-edit') { await saveDeal(target.getAttribute('data-id')); return; }
      if (action === 'delete-deal') { await deleteDeal(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-flash') { state.forms.addFlash = !state.forms.addFlash; render(); return; }
      if (action === 'cancel-add-flash') { state.forms.addFlash = false; render(); return; }
      if (action === 'select-flash') { state.selected.flashId = target.getAttribute('data-id'); render(); return; }
      if (action === 'save-flash') { await saveFlash(null); return; }
      if (action === 'save-flash-edit') { await saveFlash(target.getAttribute('data-id')); return; }
      if (action === 'delete-flash') { await deleteFlash(target.getAttribute('data-id')); return; }
      if (action === 'apply-report-filter') { applyReportFilters(); return; }
      if (action === 'toggle-add-user') { state.forms.addUser = !state.forms.addUser; render(); return; }
      if (action === 'cancel-add-user') { state.forms.addUser = false; render(); return; }
      if (action === 'save-local-user') { await saveLocalUser(); return; }
      if (action === 'delete-local-user') { await deleteLocalUser(Number(target.getAttribute('data-id'))); return; }
      if (action === 'save-order-status') { await updateOrderStatus(target.getAttribute('data-id')); return; }
      if (action === 'refresh') { await loadAll(); return; }
      if (action === 'noop') return;
    } catch (error) {
      console.error(error);
      toast(error.message || 'تعذر تنفيذ العملية');
    }
  };

  document.removeEventListener('click', bindPageEvents._click);
  bindPageEvents._click = onClick;
  document.addEventListener('click', onClick);

  const onChange = async (event) => {
    const target = event.target;
    if (target.id === 'orderTypeFilter') { state.filters.orderType = target.value; render(); return; }
    if (target.id === 'statusFilter') { state.filters.status = target.value; render(); return; }
    if (target.id === 'customerSearch') { state.filters.q = target.value; render(); return; }
    if (target.id === 'productSearch') { state.filters.q = target.value; render(); return; }
    if (target.id === 'reportFrom' || target.id === 'reportTo') { state.filters[target.id === 'reportFrom' ? 'from' : 'to'] = target.value; return; }
  };
  document.removeEventListener('change', bindPageEvents._change);
  bindPageEvents._change = onChange;
  document.addEventListener('change', onChange);

  const onInput = (event) => {
    const target = event.target;
    if (target.id === 'orderSearch') { state.filters.q = target.value; render(); }
    if (target.id === 'customerSearch') { state.filters.q = target.value; render(); }
    if (target.id === 'productSearch') { state.filters.q = target.value; render(); }
  };
  document.removeEventListener('input', bindPageEvents._input);
  bindPageEvents._input = onInput;
  document.addEventListener('input', onInput);
}

function applyReportFilters() {
  state.filters.from = document.getElementById('reportFrom')?.value || '';
  state.filters.to = document.getElementById('reportTo')?.value || '';
  render();
}

async function loadAll() {
  state.loading = true;
  try {
    const results = await Promise.allSettled([
      apiGet('customers', { select: '*', order: 'created_at.desc' }),
      apiGet('sales_reps', { select: '*', order: 'created_at.desc' }),
      apiGet('orders', { select: '*', order: 'created_at.desc' }),
      apiGet('order_items', { select: '*', order: 'created_at.desc' }),
      apiGet('companies', { select: 'company_id,company_name,company_logo,visible,allow_discount', order: 'company_id.asc' }),
      apiGet('products', { select: '*', order: 'product_name.asc' }),
      apiGet('prices_carton', { select: 'product_id,tier_name,price,visible', order: 'product_id.asc' }),
      apiGet('prices_pack', { select: 'product_id,tier_name,price,visible', order: 'product_id.asc' }),
      apiGet('tiers', { select: 'tier_name,visible_label,min_order,discount_percent,visible,is_active,is_default', order: 'min_order.asc' }),
      apiGet('daily_deals', { select: '*', order: 'created_at.desc' }),
      apiGet('flash_offers', { select: '*', order: 'start_time.desc' }),
      apiGet('customer_assignments', { select: '*', order: 'assigned_at.desc' }),
      apiGet('v_orders_status', { select: '*' }),
      apiGet('v_top_companies', { select: '*' }),
      apiGet('v_top_products', { select: '*' }),
      apiGet('v_top_customers', { select: '*' }),
      apiGet('v_reps_performance', { select: '*' }),
      apiGet('v_sales_daily', { select: '*' }),
      apiGet('v_rep_sales', { select: '*' }),
    ]);

    const v = (i) => (results[i].status === 'fulfilled' ? results[i].value || [] : []);
    state.customers = v(0);
    state.reps = v(1);
    state.orders = v(2);
    state.orderItems = v(3);
    state.companies = v(4);
    state.products = v(5);
    state.pricesCarton = v(6);
    state.pricesPack = v(7);
    state.tiers = v(8);
    state.dailyDeals = v(9);
    state.flashOffers = v(10);
    state.customerAssignments = v(11);
    state.views = {
      ordersStatus: v(12),
      topCompanies: v(13),
      topProducts: v(14),
      topCustomers: v(15),
      repsPerformance: v(16),
      salesDaily: v(17),
      repSales: v(18),
    };

    // normalize / fallback defaults
    state.orders = (state.orders || []).map((order) => ({
      ...order,
      customer_type: order.customer_type || (order.user_type === 'rep' ? 'rep' : 'direct'),
      workflow_status: order.workflow_status || statusLabel(order.status),
    }));

    const customerIdsInAssignments = new Set((state.customerAssignments || []).filter((a) => !a.ended_at).map((a) => String(a.customer_id)));
    state.customers = (state.customers || []).map((c) => ({
      ...c,
      is_active: c.is_active !== false,
      sales_rep_id: c.sales_rep_id || null,
      created_by_rep_id: c.created_by_rep_id || c.created_by || null,
      customer_type: c.customer_type || (c.sales_rep_id ? 'rep' : 'direct'),
      _hasAssignment: customerIdsInAssignments.has(String(c.id)),
    }));

    state.reps = (state.reps || []).map((r) => ({
      ...r,
      is_active: r.is_active !== false,
      default_tier_name: r.default_tier_name || 'base',
    }));

    state.companies = (state.companies || []).map((c) => ({ ...c, visible: c.visible !== false, allow_discount: c.allow_discount !== false }));
    state.products = (state.products || []).map((p) => ({
      ...p,
      visible: p.visible !== false,
      has_carton: !!p.has_carton,
      has_pack: !!p.has_pack,
      discount_carton: p.discount_carton !== false,
      discount_pack: p.discount_pack !== false,
    }));
    state.tiers = (state.tiers || []).map((t) => ({
      ...t,
      visible: t.visible !== false,
      is_active: t.is_active !== false,
      is_default: !!t.is_default,
    }));
    state.dailyDeals = (state.dailyDeals || []).map((d) => ({ ...d, is_active: d.is_active !== false }));
    state.flashOffers = (state.flashOffers || []).map((f) => ({ ...f, is_active: f.is_active !== false }));

    if (!state.selected.orderId && state.orders[0]) state.selected.orderId = state.orders[0].id;
    if (!state.selected.customerId && state.customers[0]) state.selected.customerId = state.customers[0].id;
    if (!state.selected.repId && state.reps[0]) state.selected.repId = state.reps[0].id;
    if (!state.selected.companyId && state.companies[0]) state.selected.companyId = state.companies[0].company_id;
    if (!state.selected.productId && state.products[0]) state.selected.productId = state.products[0].product_id;
    if (!state.selected.tierName && state.tiers[0]) state.selected.tierName = state.tiers[0].tier_name;
    if (!state.selected.dealId && state.dailyDeals[0]) state.selected.dealId = state.dailyDeals[0].id;
    if (!state.selected.flashId && state.flashOffers[0]) state.selected.flashId = state.flashOffers[0].id;

    state.stats = {
      orders: state.orders.length,
      customers: state.customers.length,
      reps: state.reps.length,
      sales: state.orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    };
  } catch (error) {
    console.error(error);
    toast('تعذر تحميل البيانات من قاعدة البيانات');
  } finally {
    state.loading = false;
    render();
  }
}

function findPriceRow(table, productId, tierName = 'base') {
  const rows = state[table] || [];
  return rows.find((row) => String(row.product_id) === String(productId) && String(row.tier_name || 'base') === String(tierName)) || null;
}

function priceStateKey(table) {
  if (table === 'prices_carton') return 'pricesCarton';
  if (table === 'prices_pack') return 'pricesPack';
  return table;
}

function getPriceRows(table) {
  return state[priceStateKey(table)] || [];
}

function getBasePrice(table, productId) {
  const row = getPriceRows(table).find((r) => String(r.product_id) === String(productId) && String(r.tier_name || 'base') === 'base');
  return row ? row.price : '';
}

async function upsertPrice(table, productId, price) {
  const rows = getPriceRows(table);
  const existing = rows.find((row) => String(row.product_id) === String(productId) && String(row.tier_name || 'base') === 'base');
  const payload = { product_id: productId, tier_name: 'base', price: Number(price || 0), visible: true };
  if (existing) {
    return apiMut('PATCH', table, { price: Number(price || 0), visible: true }, { product_id: `eq.${productId}`, tier_name: 'eq.base' });
  }
  return apiMut('POST', table, payload).catch(async (error) => {
    const msg = String(error?.message || '');
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
      return apiMut('PATCH', table, { price: Number(price || 0), visible: true }, { product_id: `eq.${productId}`, tier_name: 'eq.base' });
    }
    throw error;
  });
}

async function updateOrderStatus(id) {
  const label = document.getElementById('orderStatusSelect')?.value || 'قيد التنفيذ';
  const payload = { workflow_status: label, status: statusDb(label) };
  try {
    await apiMut('PATCH', 'orders', payload, { id: `eq.${id}` });
    toast('تم تحديث حالة الطلب');
    await loadAll();
  } catch (error) {
    console.warn(error);
    toast('تعذر تحديث الحالة');
  }
}

async function deleteOrder(id) {
  if (!confirm('حذف الطلب نهائيًا؟')) return;
  try {
    await apiMut('DELETE', 'order_items', {}, { order_id: `eq.${id}` });
  } catch (e) {
    console.warn('تعذر حذف عناصر الطلب أولاً', e);
  }
  await apiMut('DELETE', 'orders', {}, { id: `eq.${id}` });
  toast('تم حذف الطلب');
  await loadAll();
}

async function copyInvoice(orderId) {
  const order = state.orders.find((o) => String(o.id) === String(orderId));
  if (!order) return;
  await navigator.clipboard.writeText(buildInvoiceText(order));
  toast('تم نسخ الفاتورة');
}

async function saveCustomer(id) {
  const body = {
    name: document.getElementById(id ? 'editCustName' : 'custName')?.value.trim(),
    phone: document.getElementById(id ? 'editCustPhone' : 'custPhone')?.value.trim() || null,
    address: document.getElementById(id ? 'editCustAddress' : 'custAddress')?.value.trim() || null,
    location: document.getElementById(id ? 'editCustLocation' : 'custLocation')?.value.trim() || null,
    username: document.getElementById(id ? 'editCustUsername' : 'custUsername')?.value.trim() || null,
    password: document.getElementById(id ? 'editCustPassword' : 'custPassword')?.value.trim() || null,
    sales_rep_id: document.getElementById(id ? 'editCustRepId' : 'custRepId')?.value || null,
    customer_type: document.getElementById(id ? 'editCustRepId' : 'custRepId')?.value ? 'rep' : 'direct',
    is_active: document.getElementById(id ? 'editCustActive' : 'custActive')?.value !== 'false',
    created_by_rep_id: document.getElementById(id ? 'editCustRepId' : 'custRepId')?.value || null,
  };
  if (!body.name) return toast('اسم العميل مطلوب');

  if (id) {
    await apiMut('PATCH', 'customers', body, { id: `eq.${id}` });
  } else {
    const created = await apiMut('POST', 'customers', body);
    if (created?.[0]?.id && body.sales_rep_id) {
      await linkCustomerAssignment(created[0].id, body.sales_rep_id);
    }
  }
  state.forms.addCustomer = false;
  toast('تم حفظ العميل');
  await loadAll();
}

async function toggleCustomer(id) {
  const current = customerById(id);
  if (!current) return;
  await apiMut('PATCH', 'customers', { is_active: !current.is_active }, { id: `eq.${id}` });
  toast('تم تحديث حالة العميل');
  await loadAll();
}

async function deleteCustomer(id) {
  if (!confirm('إخفاء العميل نهائيًا؟')) return;
  try {
    const linkedOrders = (state.orders || []).filter((o) => String(o.customer_id) === String(id));
    if (linkedOrders.length) {
      await apiMut('PATCH', 'customers', { is_active: false, sales_rep_id: null, customer_type: 'direct' }, { id: `eq.${id}` });
      toast('تم إخفاء العميل لوجود طلبات مرتبطة');
    } else {
      await apiMut('DELETE', 'customers', {}, { id: `eq.${id}` });
      toast('تم حذف العميل');
    }
  } catch (error) {
    console.warn(error);
    await apiMut('PATCH', 'customers', { is_active: false }, { id: `eq.${id}` });
    toast('تم إخفاء العميل');
  }
  await loadAll();
}

async function linkCustomerAssignment(customerId, repId) {
  if (!customerId || !repId) return;
  const old = (state.customerAssignments || []).find((a) => String(a.customer_id) === String(customerId) && !a.ended_at);
  if (old) {
    await apiMut('PATCH', 'customer_assignments', { ended_at: new Date().toISOString() }, { id: `eq.${old.id}` });
  }
  await apiMut('POST', 'customer_assignments', {
    customer_id: customerId,
    sales_rep_id: repId,
    assigned_by: null,
    assigned_at: new Date().toISOString(),
  });
  await apiMut('PATCH', 'customers', { sales_rep_id: repId, customer_type: 'rep', created_by_rep_id: repId }, { id: `eq.${customerId}` });
}

async function linkCustomerToRep(repId) {
  const customerId = document.getElementById('repCustomerSelect')?.value;
  if (!customerId) return toast('اختر عميلاً أولاً');
  await linkCustomerAssignment(customerId, repId);
  toast('تم ربط العميل بالمندوب');
  await loadAll();
}

async function unlinkCustomerFromRep(customerId) {
  const current = customerById(customerId);
  if (!current) return;
  const old = (state.customerAssignments || []).find((a) => String(a.customer_id) === String(customerId) && !a.ended_at);
  if (old) {
    await apiMut('PATCH', 'customer_assignments', { ended_at: new Date().toISOString() }, { id: `eq.${old.id}` });
  }
  await apiMut('PATCH', 'customers', { sales_rep_id: null, customer_type: 'direct' }, { id: `eq.${customerId}` });
  toast('تم فصل العميل عن المندوب');
  await loadAll();
}

async function saveRep(id) {
  const body = {
    name: document.getElementById(id ? 'editRepName' : 'repName')?.value.trim(),
    phone: document.getElementById(id ? 'editRepPhone' : 'repPhone')?.value.trim() || null,
    region: document.getElementById(id ? 'editRepRegion' : 'repRegion')?.value.trim() || null,
    username: document.getElementById(id ? 'editRepUsername' : 'repUsername')?.value.trim() || null,
    password: document.getElementById(id ? 'editRepPassword' : 'repPassword')?.value.trim() || null,
    is_active: document.getElementById(id ? 'editRepActive' : 'repActive')?.value !== 'false',
  };
  if (!body.name) return toast('اسم المندوب مطلوب');
  if (id) {
    await apiMut('PATCH', 'sales_reps', body, { id: `eq.${id}` });
  } else {
    await apiMut('POST', 'sales_reps', body);
  }
  state.forms.addRep = false;
  toast('تم حفظ المندوب');
  await loadAll();
}

async function deleteRep(id) {
  if (!confirm('إخفاء المندوب نهائيًا؟')) return;
  try {
    const linkedCustomers = (state.customers || []).filter((c) => String(c.sales_rep_id || '') === String(id));
    for (const customer of linkedCustomers) {
      await apiMut('PATCH', 'customers', { sales_rep_id: null, customer_type: 'direct' }, { id: `eq.${customer.id}` });
    }
    const hasOrders = (state.orders || []).some((o) => String(o.rep_id || o.sales_rep_id || '') === String(id));
    if (hasOrders) {
      await apiMut('PATCH', 'sales_reps', { is_active: false }, { id: `eq.${id}` });
      toast('تم إخفاء المندوب لوجود فواتير مرتبطة');
    } else {
      await apiMut('DELETE', 'sales_reps', {}, { id: `eq.${id}` });
      toast('تم حذف المندوب');
    }
  } catch (error) {
    console.warn(error);
    await apiMut('PATCH', 'sales_reps', { is_active: false }, { id: `eq.${id}` });
    toast('تم إخفاء المندوب');
  }
  await loadAll();
}

async function saveCompany(id) {
  const body = {
    company_id: document.getElementById(id ? 'editCompanyCode' : 'companyCode')?.value.trim(),
    company_name: document.getElementById(id ? 'editCompanyName' : 'companyName')?.value.trim(),
    company_logo: document.getElementById(id ? 'editCompanyLogo' : 'companyLogo')?.value.trim() || '',
    visible: document.getElementById(id ? 'editCompanyVisible' : 'companyVisible')?.value !== 'false',
    allow_discount: document.getElementById(id ? 'editCompanyDiscount' : 'companyDiscount')?.value !== 'false',
  };
  if (!body.company_id || !body.company_name) return toast('كود الشركة واسمها مطلوبان');
  if (id && id !== body.company_id) {
    await apiMut('PATCH', 'companies', body, { company_id: `eq.${id}` });
  } else if (id) {
    await apiMut('PATCH', 'companies', body, { company_id: `eq.${id}` });
  } else {
    await apiMut('POST', 'companies', body);
  }
  state.forms.addCompany = false;
  toast('تم حفظ الشركة');
  await loadAll();
}

async function deleteCompany(id) {
  if (!confirm('إخفاء الشركة نهائيًا؟')) return;
  try {
    await apiMut('PATCH', 'companies', { visible: false }, { company_id: `eq.${id}` });
    toast('تم إخفاء الشركة');
  } catch (error) {
    console.warn(error);
    toast('تعذر حذف الشركة');
  }
  await loadAll();
}

async function saveProduct(id) {
  const body = {
    product_id: document.getElementById(id ? 'editProductCode' : 'productCode')?.value.trim(),
    product_name: document.getElementById(id ? 'editProductName' : 'productName')?.value.trim(),
    company_id: document.getElementById(id ? 'editProductCompany' : 'productCompany')?.value || '',
    product_image: document.getElementById(id ? 'editProductImage' : 'productImage')?.value.trim() || '',
    status: document.getElementById(id ? 'editProductStatus' : 'productStatus')?.value || 'active',
    visible: document.getElementById(id ? 'editProductVisible' : 'productVisible')?.value !== 'false',
    has_carton: document.getElementById(id ? 'editProductHasCarton' : 'productHasCarton')?.value !== 'false',
    has_pack: document.getElementById(id ? 'editProductHasPack' : 'productHasPack')?.value !== 'false',
    discount_carton: document.getElementById(id ? 'editProductDiscountCarton' : 'productDiscountCarton')?.value !== 'false',
    discount_pack: document.getElementById(id ? 'editProductDiscountPack' : 'productDiscountPack')?.value !== 'false',
  };
  const carton = document.getElementById(id ? 'editProductCartonPrice' : 'productCartonPrice')?.value;
  const pack = document.getElementById(id ? 'editProductPackPrice' : 'productPackPrice')?.value;
  if (!body.product_id || !body.product_name || !body.company_id) return toast('استكمل كود المنتج واسم المنتج والشركة');

  if (id && id !== body.product_id) {
    await apiMut('PATCH', 'products', body, { product_id: `eq.${id}` });
  } else if (id) {
    await apiMut('PATCH', 'products', body, { product_id: `eq.${id}` });
  } else {
    await apiMut('POST', 'products', body);
  }
  if (body.has_carton) await upsertPrice('prices_carton', id || body.product_id, carton || 0);
  if (body.has_pack) await upsertPrice('prices_pack', id || body.product_id, pack || 0);
  state.forms.addProduct = false;
  toast('تم حفظ المنتج');
  await loadAll();
}

async function deleteProduct(id) {
  if (!confirm('إخفاء المنتج نهائيًا؟')) return;
  try {
    await apiMut('PATCH', 'products', { visible: false, status: 'inactive' }, { product_id: `eq.${id}` });
    toast('تم إخفاء المنتج');
  } catch (error) {
    console.warn(error);
    toast('تعذر حذف المنتج');
  }
  await loadAll();
}

async function saveTier(id) {
  const body = {
    tier_name: document.getElementById(id ? 'editTierName' : 'tierName')?.value.trim(),
    visible_label: document.getElementById(id ? 'editTierLabel' : 'tierLabel')?.value.trim(),
    min_order: Number(document.getElementById(id ? 'editTierMinOrder' : 'tierMinOrder')?.value || 0),
    discount_percent: Number(document.getElementById(id ? 'editTierDiscount' : 'tierDiscount')?.value || 0),
    visible: document.getElementById(id ? 'editTierVisible' : 'tierVisible')?.value !== 'false',
    is_active: document.getElementById(id ? 'editTierActive' : 'tierActive')?.value !== 'false',
    is_default: document.getElementById(id ? 'editTierDefault' : 'tierDefault')?.value === 'true',
  };
  if (!body.tier_name || !body.visible_label) return toast('استكمل اسم الشريحة والاسم المعروض');
  if (id && id !== body.tier_name) {
    await apiMut('PATCH', 'tiers', body, { tier_name: `eq.${id}` });
  } else if (id) {
    await apiMut('PATCH', 'tiers', body, { tier_name: `eq.${id}` });
  } else {
    await apiMut('POST', 'tiers', body);
  }
  if (body.is_default) {
    const others = state.tiers.filter((t) => String(t.tier_name) !== String(body.tier_name || id));
    for (const other of others) {
      await apiMut('PATCH', 'tiers', { is_default: false }, { tier_name: `eq.${other.tier_name}` });
    }
  }
  state.forms.addTier = false;
  toast('تم حفظ الشريحة');
  await loadAll();
}

async function deleteTier(id) {
  if (!confirm('إخفاء الشريحة نهائيًا؟')) return;
  try {
    await apiMut('PATCH', 'tiers', { visible: false, is_active: false }, { tier_name: `eq.${id}` });
    toast('تم إخفاء الشريحة');
  } catch (error) {
    console.warn(error);
    toast('تعذر حذف الشريحة');
  }
  await loadAll();
}

async function saveDeal(id) {
  const body = {
    title: document.getElementById(id ? 'editDealTitle' : 'dealTitle')?.value.trim(),
    description: document.getElementById(id ? 'editDealDescription' : 'dealDescription')?.value.trim() || null,
    price: Number(document.getElementById(id ? 'editDealPrice' : 'dealPrice')?.value || 0),
    image: document.getElementById(id ? 'editDealImage' : 'dealImage')?.value.trim() || null,
    is_active: document.getElementById(id ? 'editDealActive' : 'dealActive')?.value !== 'false',
    stock: Number(document.getElementById(id ? 'editDealStock' : 'dealStock')?.value || 0),
    sold_count: Number(document.getElementById(id ? 'editDealSold' : 'dealSold')?.value || 0),
  };
  if (!body.title) return toast('عنوان الصفقة مطلوب');
  if (id) await apiMut('PATCH', 'daily_deals', body, { id: `eq.${id}` });
  else await apiMut('POST', 'daily_deals', body);
  state.forms.addDeal = false;
  toast('تم حفظ صفقة اليوم');
  await loadAll();
}

async function deleteDeal(id) {
  if (!confirm('إخفاء الصفقة نهائيًا؟')) return;
  try {
    await apiMut('PATCH', 'daily_deals', { is_active: false }, { id: `eq.${id}` });
    toast('تم إخفاء الصفقة');
  } catch (error) {
    console.warn(error);
    toast('تعذر حذف الصفقة');
  }
  await loadAll();
}

async function saveFlash(id) {
  const body = {
    title: document.getElementById(id ? 'editFlashTitle' : 'flashTitle')?.value.trim(),
    description: document.getElementById(id ? 'editFlashDescription' : 'flashDescription')?.value.trim() || null,
    price: Number(document.getElementById(id ? 'editFlashPrice' : 'flashPrice')?.value || 0),
    image: document.getElementById(id ? 'editFlashImage' : 'flashImage')?.value.trim() || null,
    start_time: document.getElementById(id ? 'editFlashStart' : 'flashStart')?.value,
    end_time: document.getElementById(id ? 'editFlashEnd' : 'flashEnd')?.value,
    is_active: document.getElementById(id ? 'editFlashActive' : 'flashActive')?.value !== 'false',
    stock: Number(document.getElementById(id ? 'editFlashStock' : 'flashStock')?.value || 0),
    sold_count: Number(document.getElementById(id ? 'editFlashSold' : 'flashSold')?.value || 0),
  };
  if (!body.title || !body.start_time || !body.end_time) return toast('استكمل بيانات العرض والوقت');
  if (id) await apiMut('PATCH', 'flash_offers', body, { id: `eq.${id}` });
  else await apiMut('POST', 'flash_offers', body);
  state.forms.addFlash = false;
  toast('تم حفظ عرض الساعة');
  await loadAll();
}

async function deleteFlash(id) {
  if (!confirm('إخفاء عرض الساعة نهائيًا؟')) return;
  try {
    await apiMut('PATCH', 'flash_offers', { is_active: false }, { id: `eq.${id}` });
    toast('تم إخفاء العرض');
  } catch (error) {
    console.warn(error);
    toast('تعذر حذف العرض');
  }
  await loadAll();
}

function applyReportRange() {
  state.filters.from = document.getElementById('reportFrom')?.value || '';
  state.filters.to = document.getElementById('reportTo')?.value || '';
  render();
}

async function saveLocalUser() {
  const user = {
    name: document.getElementById('uName')?.value.trim(),
    username: document.getElementById('uUsername')?.value.trim(),
    password: document.getElementById('uPassword')?.value.trim(),
    permissions: {
      dashboard: document.getElementById('perm_dashboard')?.checked,
      orders: document.getElementById('perm_orders')?.checked,
      customers: document.getElementById('perm_customers')?.checked,
      reps: document.getElementById('perm_reps')?.checked,
      companies: document.getElementById('perm_companies')?.checked,
      products: document.getElementById('perm_products')?.checked,
      tiers: document.getElementById('perm_tiers')?.checked,
      deals: document.getElementById('perm_deals')?.checked,
      flash: document.getElementById('perm_flash')?.checked,
      reports: document.getElementById('perm_reports')?.checked,
      users: document.getElementById('perm_users')?.checked,
    },
  };
  if (!user.name || !user.username || !user.password) return toast('استكمل بيانات المستخدم');
  state.users.push(user);
  saveJSON(STORAGE.users, state.users);
  state.forms.addUser = false;
  toast('تم حفظ المستخدم محليًا');
  render();
}

async function deleteLocalUser(index) {
  if (!confirm('حذف المستخدم المحلي؟')) return;
  state.users.splice(index, 1);
  saveJSON(STORAGE.users, state.users);
  toast('تم حذف المستخدم');
  render();
}

function bindGlobal() {
  window.addEventListener('hashchange', syncRouteFromHash);
  document.addEventListener('click', handleGlobalClick);
}

async function handleGlobalClick(event) {
  const target = event.target.closest('[data-action], [data-page]');
  if (!target) return;
  const page = target.getAttribute('data-page');
  const action = target.getAttribute('data-action');
  if (page) { navigate(page); return; }
  try {
    if (action === 'login') return attemptLogin();
    if (action === 'logout') return logout();
    if (action === 'go-home') return navigate(DEFAULT_PAGE);
    if (action === 'go-back') return history.back();
    if (action === 'select-order') { state.selected.orderId = target.getAttribute('data-id'); render(); return; }
    if (action === 'set-order-type') { state.filters.orderType = target.getAttribute('data-value') || 'all'; render(); return; }
    if (action === 'clear-order-filters') { state.filters.orderType = 'all'; state.filters.status = 'all'; state.filters.q = ''; render(); return; }
    if (action === 'select-customer') { state.selected.customerId = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-rep') { state.selected.repId = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-company') { state.selected.companyId = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-product') { state.selected.productId = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-tier') { state.selected.tierName = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-deal') { state.selected.dealId = target.getAttribute('data-id'); render(); return; }
    if (action === 'select-flash') { state.selected.flashId = target.getAttribute('data-id'); render(); return; }
    if (action === 'toggle-add-customer') { state.forms.addCustomer = !state.forms.addCustomer; render(); return; }
    if (action === 'cancel-add-customer') { state.forms.addCustomer = false; render(); return; }
    if (action === 'save-customer') return saveCustomer(null);
    if (action === 'save-customer-edit') return saveCustomer(target.getAttribute('data-id'));
    if (action === 'toggle-customer') return toggleCustomer(target.getAttribute('data-id'));
    if (action === 'delete-customer') return deleteCustomer(target.getAttribute('data-id'));
    if (action === 'link-customer-to-rep') return linkCustomerToRep(target.getAttribute('data-id'));
    if (action === 'unlink-customer-from-rep') return unlinkCustomerFromRep(target.getAttribute('data-id'));
    if (action === 'toggle-add-rep') { state.forms.addRep = !state.forms.addRep; render(); return; }
    if (action === 'cancel-add-rep') { state.forms.addRep = false; render(); return; }
    if (action === 'save-rep') return saveRep(null);
    if (action === 'save-rep-edit') return saveRep(target.getAttribute('data-id'));
    if (action === 'delete-rep') return deleteRep(target.getAttribute('data-id'));
    if (action === 'toggle-add-company') { state.forms.addCompany = !state.forms.addCompany; render(); return; }
    if (action === 'cancel-add-company') { state.forms.addCompany = false; render(); return; }
    if (action === 'save-company') return saveCompany(null);
    if (action === 'save-company-edit') return saveCompany(target.getAttribute('data-id'));
    if (action === 'delete-company') return deleteCompany(target.getAttribute('data-id'));
    if (action === 'toggle-add-product') { state.forms.addProduct = !state.forms.addProduct; render(); return; }
    if (action === 'cancel-add-product') { state.forms.addProduct = false; render(); return; }
    if (action === 'save-product') return saveProduct(null);
    if (action === 'save-product-edit') return saveProduct(target.getAttribute('data-id'));
    if (action === 'delete-product') return deleteProduct(target.getAttribute('data-id'));
    if (action === 'toggle-add-tier') { state.forms.addTier = !state.forms.addTier; render(); return; }
    if (action === 'cancel-add-tier') { state.forms.addTier = false; render(); return; }
    if (action === 'save-tier') return saveTier(null);
    if (action === 'save-tier-edit') return saveTier(target.getAttribute('data-id'));
    if (action === 'delete-tier') return deleteTier(target.getAttribute('data-id'));
    if (action === 'toggle-add-deal') { state.forms.addDeal = !state.forms.addDeal; render(); return; }
    if (action === 'cancel-add-deal') { state.forms.addDeal = false; render(); return; }
    if (action === 'save-deal') return saveDeal(null);
    if (action === 'save-deal-edit') return saveDeal(target.getAttribute('data-id'));
    if (action === 'delete-deal') return deleteDeal(target.getAttribute('data-id'));
    if (action === 'toggle-add-flash') { state.forms.addFlash = !state.forms.addFlash; render(); return; }
    if (action === 'cancel-add-flash') { state.forms.addFlash = false; render(); return; }
    if (action === 'save-flash') return saveFlash(null);
    if (action === 'save-flash-edit') return saveFlash(target.getAttribute('data-id'));
    if (action === 'delete-flash') return deleteFlash(target.getAttribute('data-id'));
    if (action === 'save-order-status') return updateOrderStatus(target.getAttribute('data-id'));
    if (action === 'delete-order') return deleteOrder(target.getAttribute('data-id'));
    if (action === 'copy-invoice') return copyInvoice(target.getAttribute('data-id'));
    if (action === 'toggle-add-user') { state.forms.addUser = !state.forms.addUser; render(); return; }
    if (action === 'cancel-add-user') { state.forms.addUser = false; render(); return; }
    if (action === 'save-local-user') return saveLocalUser();
    if (action === 'delete-local-user') return deleteLocalUser(Number(target.getAttribute('data-id')));
    if (action === 'apply-report-filter') return applyReportRange();
    if (action === 'refresh-data') return loadAll();
    if (action === 'back-home') return navigate(DEFAULT_PAGE);
  } catch (error) {
    console.error(error);
    toast(error.message || 'تعذر تنفيذ العملية');
  }
}

async function attemptLogin() {
  const username = document.getElementById('loginUsername')?.value || '';
  const password = document.getElementById('loginPassword')?.value || '';
  const found = authUsers().find((u) => String(u.username).trim() === String(username).trim() && String(u.password).trim() === String(password).trim());
  if (!found) return toast('بيانات الدخول غير صحيحة');
  state.user = found;
  saveJSON(STORAGE.auth, found);
  toast('تم تسجيل الدخول');
  render();
}

async function init() {
  bindGlobal();
  syncRouteFromHash();
  await loadAll();
  render();
}

init();
