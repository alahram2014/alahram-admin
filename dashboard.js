
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

const STATUS_LABELS = {
  draft: 'مسودة / لم يُرسل بعد',
  pending: 'قيد المراجعة / بانتظار التنفيذ',
  confirmed: 'تم تأكيد الطلب',
  processing: 'جاري التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  paid: 'تم الدفع',
  cancelled: 'تم الإلغاء',
};
const AR_STATUS = Object.values(STATUS_LABELS);
const STATUS_TO_DB = {
  'مسودة / لم يُرسل بعد': 'draft',
  'قيد المراجعة / بانتظار التنفيذ': 'pending',
  'تم تأكيد الطلب': 'confirmed',
  'جاري التجهيز': 'processing',
  'تم الشحن': 'shipped',
  'تم التسليم': 'delivered',
  'تم الدفع': 'paid',
  'تم الإلغاء': 'cancelled',
};
const DB_TO_AR = STATUS_LABELS;

const PAGE_META = {
  dashboard: 'الرئيسية',
  orders: 'الطلبات',
  'order-detail': 'تفاصيل الطلب',
  customers: 'العملاء',
  'customer-detail': 'تفاصيل العميل',
  reps: 'المناديب',
  'rep-detail': 'تفاصيل المندوب',
  companies: 'الشركات',
  'company-detail': 'تفاصيل الشركة',
  products: 'المنتجات',
  'product-detail': 'تفاصيل المنتج',
  tiers: 'الشرائح',
  'tier-detail': 'تفاصيل الشريحة',
  deals: 'صفقة اليوم',
  'deal-detail': 'تفاصيل صفقة اليوم',
  flash: 'عرض الساعة',
  'flash-detail': 'تفاصيل عرض الساعة',
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
    customerView: 'all',
    status: 'all',
    q: '',
    from: '',
    to: '',
  },
  searchText: '',
  searchResults: [],
  hubSection: 'orders',
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
  if (!value) return STATUS_LABELS.draft;
  if (AR_STATUS.includes(value)) return value;
  return DB_TO_AR[String(value)] || STATUS_LABELS.draft;
}

function statusDb(value) {
  return STATUS_TO_DB[String(value)] || 'pending';
}

function statusClass(value) {
  if (!value) return 'gold';
  if (String(value).includes('ملغي')) return 'red';
  if (String(value).includes('تم') || String(value).includes('مدفوع')) return 'green';
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



function detailPageShell(title, subtitle, bodyHtml, backPage) {
  return `
    <div class="card detail-page">
      <div class="header" style="margin:0">
        <div>
          <div class="badge">${escapeHtml(title)}</div>
          <h3 style="margin:8px 0 0">${escapeHtml(subtitle || title)}</h3>
        </div>
        <div class="toolbar">
          <button class="btn primary" data-action="back-home" type="button">الرئيسية</button>
          <button class="btn" data-action="go-back" type="button">رجوع</button>
        </div>
      </div>
      ${bodyHtml}
    </div>
  `;
}

function orderDetailPage() {
  const order = state.orders.find((o) => String(o.id) === String(state.selected.orderId)) || null;
  return order ? detailPageShell('تفاصيل الطلب', `فاتورة ${escapeHtml(order.invoice_number || order.order_number || order.id)}`, orderDetailsCard(order), 'orders') : '<div class="card"><div class="empty-state">اختر طلبًا أولاً</div><div class="toolbar"><button class="btn primary" data-action="back-home" type="button">الرئيسية</button></div></div>';
}

function customerDetailPage() {
  const customer = customerById(state.selected.customerId) || null;
  return customer ? detailPageShell('تفاصيل العميل', escapeHtml(customer.name || '—'), customerDetailsCard(customer), 'customers') : '<div class="card"><div class="empty-state">اختر عميلاً أولاً</div></div>';
}

function repDetailPage() {
  const rep = repById(state.selected.repId) || null;
  return rep ? detailPageShell('تفاصيل المندوب', escapeHtml(rep.name || '—'), repDetailsCard(rep), 'reps') : '<div class="card"><div class="empty-state">اختر مندوبًا أولاً</div></div>';
}

function companyDetailPage() {
  const company = companyById(state.selected.companyId) || null;
  return company ? detailPageShell('تفاصيل الشركة', escapeHtml(company.company_name || '—'), companyDetailsCard(company), 'companies') : '<div class="card"><div class="empty-state">اختر شركة أولاً</div></div>';
}

function productDetailPage() {
  const product = productById(state.selected.productId) || null;
  return product ? detailPageShell('تفاصيل المنتج', escapeHtml(product.product_name || '—'), productDetailsCard(product), 'products') : '<div class="card"><div class="empty-state">اختر منتجًا أولاً</div></div>';
}

function tierDetailPage() {
  const tier = tierByName(state.selected.tierName) || null;
  return tier ? detailPageShell('تفاصيل الشريحة', escapeHtml(tier.visible_label || tier.tier_name || '—'), tierDetailsCard(tier), 'tiers') : '<div class="card"><div class="empty-state">اختر شريحة أولاً</div></div>';
}

function dealDetailPage() {
  const deal = dealById(state.selected.dealId) || null;
  return deal ? detailPageShell('تفاصيل صفقة اليوم', escapeHtml(deal.title || '—'), dealDetailsCard(deal), 'deals') : '<div class="card"><div class="empty-state">اختر عرضًا أولاً</div></div>';
}

function flashDetailPage() {
  const offer = flashById(state.selected.flashId) || null;
  return offer ? detailPageShell('تفاصيل عرض الساعة', escapeHtml(offer.title || '—'), flashDetailsCard(offer), 'flash') : '<div class="card"><div class="empty-state">اختر عرضًا أولاً</div></div>';
}



function renderMetric(label, value, hint = '') {
  return `
    <div class="stat">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      ${hint ? `<div class="small">${escapeHtml(hint)}</div>` : ''}
    </div>
  `;
}

function searchTokens(value) {
  return normalizeSearchText(value)
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function smartIncludes(haystack, query) {
  const h = normalizeSearchText(haystack);
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  return tokens.every((token) => h.includes(token));
}

function hubActionCard(title, subtitle, action, icon = '•', status = '') {
  return `
    <button class="hub-card" type="button" data-action="${escapeHtml(action)}">
      <div class="hub-card__icon">${escapeHtml(icon)}</div>
      <div class="hub-card__body">
        <div class="hub-card__title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="hub-card__sub">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      ${status ? `<span class="status ${statusClass(status)}">${escapeHtml(status)}</span>` : ''}
    </button>
  `;
}

function modulePanel(title, subtitle, itemsHtml) {
  return `
    <section class="card module-panel">
      <div class="header">
        <div>
          <div class="badge">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="small" style="margin-top:6px">${escapeHtml(subtitle)}</div>` : ''}
        </div>
      </div>
      <div class="subgrid">${itemsHtml}</div>
    </section>
  `;
}

function pageCard(title, subtitle, bodyHtml, actionsHtml = '') {
  return `
    <section class="card">
      <div class="header">
        <div>
          <div class="badge">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="small" style="margin-top:6px">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        ${actionsHtml ? `<div class="toolbar">${actionsHtml}</div>` : ''}
      </div>
      ${bodyHtml}
    </section>
  `;
}

function listItem(title, meta = '', actionsHtml = '', statusHtml = '') {
  return `
    <div class="item">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(title)}</div>
          ${meta ? `<div class="item-meta">${meta}</div>` : ''}
        </div>
        ${statusHtml || ''}
      </div>
      ${actionsHtml ? `<div class="toolbar">${actionsHtml}</div>` : ''}
    </div>
  `;
}

function safeRows(list) {
  return Array.isArray(list) ? list : [];
}

function orderFilterLabel() {
  return state.filters.orderType === 'direct' ? 'طلبات عميل مباشر' : state.filters.orderType === 'rep' ? 'طلبات مندوب' : 'جميع الطلبات';
}

function filteredOrders() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.orders).filter((order) => {
    if (state.filters.orderType === 'direct' && String(order.customer_type || 'direct') === 'rep') return false;
    if (state.filters.orderType === 'rep' && String(order.customer_type || 'direct') !== 'rep') return false;
    const status = statusLabel(order.workflow_status || order.status);
    if (state.filters.status && state.filters.status !== 'all' && status !== state.filters.status) return false;
    if (!q) return true;
    const { customer, rep } = orderPartyInfo(order);
    return smartIncludes([order.invoice_number, order.order_number, order.id, customer.name, customer.phone, rep.name, rep.phone, order.tier_name, order.total_amount, order.status, order.workflow_status].join(' '), q);
  });
}

function filteredCustomers() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.customers).filter((customer) => {
    if (state.filters.customerView === 'direct' && String(customer.customer_type || 'direct') === 'rep') return false;
    if (state.filters.customerView === 'rep' && String(customer.customer_type || 'direct') !== 'rep') return false;
    if (!q) return true;
    return smartIncludes([customer.name, customer.phone, customer.address, customer.location, customer.username, customer.customer_type].join(' '), q);
  });
}

function filteredReps() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.reps).filter((rep) => !q || smartIncludes([rep.name, rep.phone, rep.region, rep.username].join(' '), q));
}

function filteredCompanies() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.companies).filter((company) => !q || smartIncludes([company.company_name, company.company_id].join(' '), q));
}

function filteredProducts() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.products).filter((product) => {
    const company = companyById(product.company_id);
    return !q || smartIncludes([product.product_name, product.product_id, product.company_id, company?.company_name, statusLabel(product.status)].join(' '), q);
  });
}

function filteredTiers() {
  const q = normalizeSearchText(state.filters.q || state.searchText || '');
  return safeRows(state.tiers).filter((tier) => !q || smartIncludes([tier.tier_name, tier.visible_label].join(' '), q));
}

function tierOrders(tierName) {
  return safeRows(state.orders).filter((order) => String(order.tier_name || '') === String(tierName));
}

function tierSummary(tierName) {
  const orders = tierOrders(tierName);
  const uniqueCustomers = new Set(orders.map((o) => String(o.customer_id || ''))).size;
  const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  return { ordersCount: orders.length, uniqueCustomers, totalAmount };
}

function dealOrders(dealId) {
  return safeRows(state.orders).filter((order) => safeRows(orderItemsFor(order.id)).some((item) => String(item.type) === 'deal' && String(item.product_id) === String(dealId)));
}

function flashOrders(flashId) {
  return safeRows(state.orders).filter((order) => safeRows(orderItemsFor(order.id)).some((item) => String(item.type) === 'flash' && String(item.product_id) === String(flashId)));
}

function companyOrders(companyId) {
  return safeRows(state.orders).filter((order) => safeRows(orderItemsFor(order.id)).some((item) => {
    const product = productById(item.product_id);
    return String(product?.company_id || item.company_id || '') === String(companyId);
  }));
}

function customerOrders(customerId) {
  return safeRows(state.orders).filter((order) => String(order.customer_id || '') === String(customerId));
}

function repOrders(repId) {
  return safeRows(state.orders).filter((order) => String(order.rep_id || order.sales_rep_id || '') === String(repId));
}

function productOrders(productId) {
  return safeRows(state.orders).filter((order) => safeRows(orderItemsFor(order.id)).some((item) => String(item.product_id || '') === String(productId)));
}

function activeRepCustomers(repId) {
  return safeRows(state.customers).filter((customer) => String(customer.sales_rep_id || '') === String(repId));
}

function renderDashboardHome() {
  const ordersCount = safeRows(state.orders).length;
  const totalSales = safeRows(state.orders).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const statuses = computeOrdersStatusFromRaw();
  const topCompanies = computeTopCompaniesFromRaw().slice(0, 5);
  const topProducts = computeTopProductsFromRaw().slice(0, 5);
  const topCustomers = computeTopCustomersFromRaw().slice(0, 5);
  const repsPerformance = computeRepsPerformanceFromRaw().slice(0, 5);
  const recentOrders = safeRows(state.orders).slice(0, 8);
  const activeSection = state.hubSection || 'orders';
  const searchSummary = state.searchText ? performGlobalSearch(state.searchText) : null;

  const moduleCards = [
    { key: 'orders', title: 'الطلبات والفواتير', subtitle: 'وصول سريع للطلب، الفاتورة، والحالة', icon: '🧾' },
    { key: 'customers', title: 'العملاء', subtitle: 'عميل مباشر أو عميل مندوب', icon: '👤' },
    { key: 'reps', title: 'المناديب', subtitle: 'حركة المندوب، العملاء، والمبيعات', icon: '🧑‍💼' },
    { key: 'companies', title: 'الشركات', subtitle: 'الشركة والمنتجات التابعة لها', icon: '🏢' },
    { key: 'products', title: 'المنتجات', subtitle: 'الأسعار، الأنواع، والتوفر', icon: '📦' },
    { key: 'tiers', title: 'الشرائح', subtitle: 'الخصومات والتسعير حسب الشريحة', icon: '💠' },
    { key: 'deals', title: 'صفقة اليوم', subtitle: 'عروض اليوم ومؤشرات البيع', icon: '⭐' },
    { key: 'flash', title: 'عرض الساعة', subtitle: 'العروض المؤقتة والمخزون', icon: '⏱️' },
    { key: 'reports', title: 'التقارير', subtitle: 'مبيعات، مناديب، كبار العملاء', icon: '📊' },
    { key: 'users', title: 'الصلاحيات', subtitle: 'إدارة المستخدمين المحليين', icon: '🔐' },
  ];

  const sections = {
    orders: modulePanel('الطلبات والفواتير', 'هيكل شجري للوصول للطلب مباشرة', [
      hubActionCard('كل الطلبات', 'عرض موحد لكل الطلبات والفواتير', 'go-orders', '🧾'),
      hubActionCard('طلبات عميل مباشر', 'فلترة الطلبات حسب عميل مباشر', 'open-direct-orders', '👤'),
      hubActionCard('طلبات مندوب', 'فلترة الطلبات حسب طلبات المناديب', 'open-rep-orders', '🧑‍💼'),
      hubActionCard('تحديث سريع للحالة', 'تمكين التعديل السريع لحالات الطلب', 'go-orders', '🔄'),
    ].join('')),
    customers: modulePanel('العملاء', 'الوصول إلى العميل مباشرة أو عبر نوعه', [
      hubActionCard('كل العملاء', 'قائمة العملاء كاملة', 'go-customers', '👥'),
      hubActionCard('عملاء مباشر', 'العملاء غير المرتبطين بمندوب', 'open-direct-customers', '👤'),
      hubActionCard('عملاء مناديب', 'العملاء المرتبطون بمندوب', 'open-rep-customers', '🧑‍💼'),
    ].join('')),
    reps: modulePanel('المناديب', 'الوصول إلى المناديب وتقاريرهم', [
      hubActionCard('كل المناديب', 'قائمة المناديب كاملة', 'go-reps', '🧑‍💼'),
      hubActionCard('أداء المناديب', 'المبيعات والطلبات حسب المندوب', 'go-reports', '📈'),
      hubActionCard('ربط عميل بمندوب', 'الوصول السريع لعملية الربط', 'go-reps', '🔗'),
    ].join('')),
    companies: modulePanel('الشركات', 'ربط المنتجات بالشركة الأصلية', [
      hubActionCard('كل الشركات', 'عرض الشركات المعتمدة', 'go-companies', '🏢'),
      hubActionCard('أفضل الشركات', 'حسب حجم المبيعات', 'go-reports', '📊'),
    ].join('')),
    products: modulePanel('المنتجات', 'الوصول للمنتج والسعر والتوفر', [
      hubActionCard('كل المنتجات', 'قائمة المنتجات المعروضة', 'go-products', '📦'),
      hubActionCard('أسعار الكرتون', 'قراءة الأسعار حسب الشريحة', 'go-products', '📦'),
      hubActionCard('أسعار القطعة', 'قراءة الأسعار حسب الشريحة', 'go-products', '📦'),
    ].join('')),
    tiers: modulePanel('الشرائح', 'التحكم في التسعير والخصم', [
      hubActionCard('كل الشرائح', 'قائمة الشرائح الحالية', 'go-tiers', '💠'),
      hubActionCard('أثر الشريحة', 'مبيعات وطلبات كل شريحة', 'go-reports', '📊'),
    ].join('')),
    deals: modulePanel('صفقة اليوم', 'مؤشرات وقراءة سريعة للعروض', [
      hubActionCard('صفقات اليوم', 'العروض اليومية الحالية', 'go-deals', '⭐'),
      hubActionCard('تفاصيل الصفقة', 'انتقال لصفحة العرض المختار', 'go-deals', '🧩'),
    ].join('')),
    flash: modulePanel('عرض الساعة', 'العروض المؤقتة الأكثر حساسية', [
      hubActionCard('عروض الساعة', 'العروض النشطة الآن', 'go-flash', '⏱️'),
      hubActionCard('تفاصيل العرض', 'إجراء سريع للتعديل أو المراجعة', 'go-flash', '🧩'),
    ].join('')),
    reports: modulePanel('التقارير', 'ملخص تنفيذي سريع', [
      hubActionCard('مبيعات يومية', 'قراءة سريعة للتدفق اليومي', 'go-reports', '📈'),
      hubActionCard('أقوى العملاء', 'من اشترى أكثر', 'go-reports', '🏆'),
      hubActionCard('أقوى المناديب', 'من نفذ أكثر', 'go-reports', '🏅'),
    ].join('')),
    users: modulePanel('الصلاحيات', 'المستخدمون المحليون وصلاحياتهم', [
      hubActionCard('المستخدمون المحليون', 'إضافة أو حذف المستخدمين', 'go-users', '🔐'),
    ].join('')),
  };

  return `
    <section class="card hero-card">
      <div class="hero-top">
        <div>
          <div class="badge">الرئيسية</div>
          <h2>إدارة شبكية عربية موبايل أول</h2>
          <div class="small">وصول شجري للطلبات والعملاء والمناديب والشركات والمنتجات دون تشتيت.</div>
        </div>
        <div class="hero-search">
          <div class="field">
            <span>بحث ذكي في كل البيانات</span>
            <input id="globalSearch" type="search" placeholder="ابحث باسم العميل أو رقم الفاتورة أو المندوب أو الشركة..." value="${escapeHtml(state.searchText || '')}" />
          </div>
          <div class="toolbar">
            <button class="btn" id="clearSearchBtn" type="button">مسح البحث</button>
          </div>
        </div>
      </div>

      ${searchSummary ? `
        <div class="search-result">
          <div class="small">أفضل نتيجة مطابقة</div>
          <div class="search-result__title">${escapeHtml(searchSummary.label || '—')}</div>
          <div class="search-result__meta">النوع: ${escapeHtml(PAGE_META[searchSummary.type] || searchSummary.type || '—')}</div>
        </div>
      ` : ''}

      <div class="grid cols-3 stats-grid">
        ${renderMetric('الطلبات', integer(ordersCount), 'إجمالي الفواتير المسجلة')}
        ${renderMetric('العملاء', integer(safeRows(state.customers).length), 'كل العملاء')}
        ${renderMetric('المناديب', integer(safeRows(state.reps).length), 'كل المناديب')}
        ${renderMetric('المبيعات', `${num(totalSales)} جنيه`, 'إجمالي قيمة الفواتير')}
        ${renderMetric('الشركات', integer(safeRows(state.companies).length), 'الشركات المعتمدة')}
        ${renderMetric('المنتجات', integer(safeRows(state.products).length), 'المنتجات المعروضة')}
      </div>
    </section>

    <section class="card">
      <div class="header">
        <div>
          <div class="badge">الحالات</div>
          <div class="small" style="margin-top:6px">الحالة الحالية مع أسماء عربية واضحة</div>
        </div>
      </div>
      <div class="status-grid">
        ${Object.entries(statuses).map(([label, val]) => `
          <div class="status-card">
            <div class="status-card__top">
              <span class="status ${statusClass(label)}">${escapeHtml(label)}</span>
              <strong>${integer(val.count || 0)}</strong>
            </div>
            <div class="small">إجمالي: ${num(val.total || 0)} جنيه</div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <div class="header">
        <div>
          <div class="badge">القوائم الرئيسية</div>
          <div class="small" style="margin-top:6px">اضغط على أي كارت لعرض القوائم الفرعية تحته</div>
        </div>
      </div>
      <div class="hub-grid">
        ${moduleCards.map((m) => `
          <button class="hub-module ${activeSection === m.key ? 'active' : ''}" type="button" data-action="set-hub-section" data-value="${escapeHtml(m.key)}">
            <div class="hub-module__icon">${m.icon}</div>
            <div class="hub-module__body">
              <div class="hub-module__title">${escapeHtml(m.title)}</div>
              <div class="hub-module__sub">${escapeHtml(m.subtitle)}</div>
            </div>
          </button>
        `).join('')}
      </div>
    </section>

    ${sections[activeSection] || sections.orders}

    <section class="card">
      <div class="header">
        <div>
          <div class="badge">آخر الطلبات</div>
          <div class="small" style="margin-top:6px">مؤشر سريع على النشاط الحالي</div>
        </div>
      </div>
      <div class="list">
        ${recentOrders.length ? recentOrders.map((order) => {
          const { customer, rep } = orderPartyInfo(order);
          return listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `${escapeHtml(customer.name || '—')} — ${escapeHtml(rep.name || 'مباشر')}`, `
            <button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>
            <button class="btn" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ الفاتورة</button>
          `, `<span class="status ${statusClass(statusLabel(order.workflow_status || order.status))}">${escapeHtml(statusLabel(order.workflow_status || order.status))}</span>`);
        }).join('') : '<div class="empty-state">لا توجد طلبات بعد</div>'}
      </div>
    </section>

    <section class="card">
      <div class="grid cols-2">
        ${pageCard('أفضل الشركات', 'حسب إجمالي المبيعات', topCompanies.length ? topCompanies.map((row) => listItem(row.company_name || row.company_id, `إجمالي الأصناف: ${integer(row.total_items || 0)} — المبيعات: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-action="select-company" data-id="${escapeHtml(row.company_id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
        ${pageCard('أفضل المنتجات', 'حسب الكمية المباعة', topProducts.length ? topProducts.map((row) => listItem(row.product_name || row.product_id, `الكمية: ${integer(row.total_qty || 0)} — المبيعات: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-action="select-product" data-id="${escapeHtml(row.product_id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
      </div>
    </section>

    <section class="card">
      <div class="grid cols-2">
        ${pageCard('أفضل العملاء', 'إجمالي الطلبات والمشتريات', topCustomers.length ? topCustomers.map((row) => listItem(row.name || row.id, `الهاتف: ${escapeHtml(row.phone || '—')} — الطلبات: ${integer(row.total_orders || 0)} — الإجمالي: ${num(row.total_spent || 0)} جنيه`, `<button class="btn primary" data-action="select-customer" data-id="${escapeHtml(row.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
        ${pageCard('أداء المناديب', 'إجمالي الطلبات والمبيعات', repsPerformance.length ? repsPerformance.map((row) => listItem(row.name || row.id, `المنطقة: ${escapeHtml(row.region || '—')} — الطلبات: ${integer(row.total_orders || 0)} — الإجمالي: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-action="select-rep" data-id="${escapeHtml(row.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
      </div>
    </section>
  `;
}
function renderOrdersPage() {
  const rows = filteredOrders();
  return `
    <div class="card">
      <div class="header">
        <div>
          <div class="badge">الطلبات</div>
          <div class="small">${escapeHtml(orderFilterLabel())}</div>
        </div>
        <div class="toolbar">
          <button class="btn ${state.filters.orderType === 'all' ? 'primary' : ''}" data-action="set-order-type" data-value="all" type="button">الكل</button>
          <button class="btn ${state.filters.orderType === 'direct' ? 'primary' : ''}" data-action="set-order-type" data-value="direct" type="button">عميل مباشر</button>
          <button class="btn ${state.filters.orderType === 'rep' ? 'primary' : ''}" data-action="set-order-type" data-value="rep" type="button">مندوب</button>
          <button class="btn" data-action="clear-order-filters" type="button">مسح الفلاتر</button>
        </div>
      </div>
      <div class="search-row">
        <input id="orderSearch" type="search" placeholder="بحث داخل الطلبات والفواتير..." value="${escapeHtml(state.filters.q || '')}" />
        <select id="statusFilter">
          <option value="all" ${state.filters.status === 'all' ? 'selected' : ''}>كل الحالات</option>
          ${AR_STATUS.map((s) => `<option value="${escapeHtml(s)}" ${state.filters.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="list">${rows.length ? rows.map((order) => {
      const { customer, rep } = orderPartyInfo(order);
      const itemsCount = orderItemsFor(order.id).length;
      const label = statusLabel(order.workflow_status || order.status);
      return listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `
        العميل: ${escapeHtml(customer.name || '—')}<br/>
        ${order.customer_type === 'rep' ? `المندوب: ${escapeHtml(rep.name || '—')}<br/>` : ''}
        الهاتف: ${escapeHtml(customer.phone || '—')}<br/>
        الإجمالي: ${num(order.total_amount || 0)} جنيه<br/>
        الأصناف: ${integer(itemsCount)}
      `, `
        <button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>
        <button class="btn" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ الفاتورة</button>
      `, `<span class="status ${statusClass(label)}">${escapeHtml(label)}</span>`);
    }).join('') : '<div class="empty-state">لا توجد طلبات مطابقة</div>'}</div>
  `;
}

function renderCustomersPage() {
  const rows = filteredCustomers();
  const directCount = safeRows(state.customers).filter((c) => String(c.customer_type || 'direct') !== 'rep').length;
  const repCount = safeRows(state.customers).filter((c) => String(c.customer_type || '') === 'rep').length;
  const addForm = state.forms.addCustomer ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة عميل مباشر جديد</div><div class="small">يُحفظ في قاعدة البيانات مباشرة</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-customer" type="button">إغلاق</button></div></div>
      ${customerFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header">
        <div>
          <div class="badge">العملاء</div>
          <div class="small">إجمالي مباشر: ${integer(directCount)} — مندوب: ${integer(repCount)}</div>
        </div>
        <div class="toolbar">
          <button class="btn ${state.filters.customerView === 'all' ? 'primary' : ''}" data-action="open-direct-customers" type="button">الكل المباشر</button>
          <button class="btn ${state.filters.customerView === 'rep' ? 'primary' : ''}" data-action="open-rep-customers" type="button">عملاء المندوبين</button>
          <button class="btn" data-action="toggle-add-customer" type="button">إضافة عميل مباشر جديد</button>
        </div>
      </div>
      <div class="search-row">
        <input id="customerSearch" type="search" placeholder="بحث في العملاء..." value="${escapeHtml(state.filters.q || '')}" />
        <select id="customerViewFilter">
          <option value="all" ${state.filters.customerView === 'all' ? 'selected' : ''}>كل العملاء</option>
          <option value="direct" ${state.filters.customerView === 'direct' ? 'selected' : ''}>مباشر</option>
          <option value="rep" ${state.filters.customerView === 'rep' ? 'selected' : ''}>مندوب</option>
        </select>
      </div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((customer) => {
      const rep = repById(customer.sales_rep_id);
      const orders = customerOrders(customer.id);
      const typeLabel = String(customer.customer_type || (customer.sales_rep_id ? 'rep' : 'direct')) === 'rep' ? 'عميل مندوب' : 'عميل مباشر';
      return listItem(customer.name || '—', `
        الهاتف: ${escapeHtml(customer.phone || '—')}<br/>
        العنوان: ${escapeHtml(customer.address || '—')}<br/>
        المندوب: ${escapeHtml(rep?.name || 'غير مرتبط')}<br/>
        تاريخ التسجيل: ${formatDateTime(customer.created_at || customer.created_at)}<br/>
        الفواتير: ${integer(orders.length)}
      `, `
        <button class="btn primary" data-action="select-customer" data-id="${escapeHtml(customer.id)}" type="button">تفاصيل</button>
      `, `<span class="status ${typeLabel === 'عميل مندوب' ? 'green' : 'gold'}">${typeLabel}</span>`);
    }).join('') : '<div class="empty-state">لا توجد عملاء</div>'}</div>
  `;
}

function customerFormHtml(customer) {
  const repOptions = ['<option value="">مباشر</option>'].concat(safeRows(state.reps).map((rep) => `<option value="${escapeHtml(rep.id)}" ${customer && String(customer.sales_rep_id || '') === String(rep.id) ? 'selected' : ''}>${escapeHtml(rep.name || rep.id)}</option>`)).join('');
  const prefix = customer ? 'edit' : '';
  const activeValue = customer ? (customer.is_active === false ? 'false' : 'true') : 'true';
  return `
    <div class="grid cols-2">
      <label class="field"><span>الاسم</span><input id="${prefix}CustName" type="text" value="${escapeHtml(customer?.name || '')}" /></label>
      <label class="field"><span>رقم الهاتف</span><input id="${prefix}CustPhone" type="text" value="${escapeHtml(customer?.phone || '')}" /></label>
      <label class="field"><span>العنوان</span><input id="${prefix}CustAddress" type="text" value="${escapeHtml(customer?.address || '')}" /></label>
      <label class="field"><span>المنطقة</span><input id="${prefix}CustLocation" type="text" value="${escapeHtml(customer?.location || '')}" /></label>
      <label class="field"><span>اسم المستخدم</span><input id="${prefix}CustUsername" type="text" value="${escapeHtml(customer?.username || '')}" /></label>
      <label class="field"><span>كلمة المرور</span><input id="${prefix}CustPassword" type="password" value="${escapeHtml(customer?.password || '')}" /></label>
      <label class="field"><span>المندوب</span><select id="${prefix}CustRepId">${repOptions}</select></label>
      <label class="field"><span>الحالة</span><select id="${prefix}CustActive"><option value="true" ${activeValue === 'true' ? 'selected' : ''}>نشط</option><option value="false" ${activeValue === 'false' ? 'selected' : ''}>غير نشط</option></select></label>
    </div>
    <div class="toolbar">
      <button class="btn primary ${customer ? '' : ''}" data-action="${customer ? 'save-customer-edit' : 'save-customer'}" data-id="${customer ? escapeHtml(customer.id) : ''}" type="button">${customer ? 'حفظ التعديل' : 'حفظ العميل'}</button>
    </div>
  `;
}

function renderRepsPage() {
  const rows = filteredReps();
  const addForm = state.forms.addRep ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة مندوب جديد</div><div class="small">يُحفظ محليًا مع قاعدة البيانات الحالية</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-rep" type="button">إغلاق</button></div></div>
      ${repFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header">
        <div><div class="badge">المناديب</div><div class="small">${integer(safeRows(state.reps).length)} مندوب</div></div>
        <div class="toolbar"><button class="btn" data-action="toggle-add-rep" type="button">إضافة مندوب جديد</button></div>
      </div>
      <div class="search-row">
        <input id="repSearch" type="search" placeholder="بحث في المناديب..." value="${escapeHtml(state.filters.q || '')}" />
      </div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((rep) => {
      const customers = activeRepCustomers(rep.id);
      const orders = repOrders(rep.id);
      return listItem(rep.name || '—', `
        الهاتف: ${escapeHtml(rep.phone || '—')}<br/>
        المنطقة: ${escapeHtml(rep.region || '—')}<br/>
        العملاء: ${integer(customers.length)}<br/>
        الفواتير: ${integer(orders.length)}<br/>
        الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه
      `, `
        <button class="btn primary" data-action="select-rep" data-id="${escapeHtml(rep.id)}" type="button">تفاصيل</button>
      `, `<span class="status ${rep.is_active === false ? 'red' : 'green'}">${rep.is_active === false ? 'غير نشط' : 'نشط'}</span>`);
    }).join('') : '<div class="empty-state">لا توجد مناديب</div>'}</div>
  `;
}

function repFormHtml(rep) {
  const prefix = rep ? 'edit' : '';
  const activeValue = rep ? (rep.is_active === false ? 'false' : 'true') : 'true';
  return `
    <div class="grid cols-2">
      <label class="field"><span>الاسم</span><input id="${prefix}RepName" type="text" value="${escapeHtml(rep?.name || '')}" /></label>
      <label class="field"><span>رقم الهاتف</span><input id="${prefix}RepPhone" type="text" value="${escapeHtml(rep?.phone || '')}" /></label>
      <label class="field"><span>المنطقة</span><input id="${prefix}RepRegion" type="text" value="${escapeHtml(rep?.region || '')}" /></label>
      <label class="field"><span>اسم المستخدم</span><input id="${prefix}RepUsername" type="text" value="${escapeHtml(rep?.username || '')}" /></label>
      <label class="field"><span>كلمة المرور</span><input id="${prefix}RepPassword" type="password" value="${escapeHtml(rep?.password || '')}" /></label>
      <label class="field"><span>الحالة</span><select id="${prefix}RepActive"><option value="true" ${activeValue === 'true' ? 'selected' : ''}>نشط</option><option value="false" ${activeValue === 'false' ? 'selected' : ''}>غير نشط</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${rep ? 'save-rep-edit' : 'save-rep'}" data-id="${rep ? escapeHtml(rep.id) : ''}" type="button">${rep ? 'حفظ التعديل' : 'حفظ المندوب'}</button></div>
  `;
}

function renderCompaniesPage() {
  const rows = filteredCompanies();
  const addForm = state.forms.addCompany ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة شركة</div><div class="small">تحديث الاسم أو الكود أو اللوجو</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-company" type="button">إغلاق</button></div></div>
      ${companyFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header">
        <div><div class="badge">الشركات</div><div class="small">${integer(safeRows(state.companies).length)} شركة</div></div>
        <div class="toolbar"><button class="btn" data-action="toggle-add-company" type="button">إضافة شركة</button></div>
      </div>
      <div class="search-row"><input id="companySearch" type="search" placeholder="بحث في الشركات..." value="${escapeHtml(state.filters.q || '')}" /></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((company) => {
      const orders = companyOrders(company.company_id);
      const productsCount = safeRows(state.products).filter((p) => String(p.company_id || '') === String(company.company_id)).length;
      return listItem(company.company_name || '—', `
        الكود: ${escapeHtml(company.company_id || '—')}<br/>
        المنتجات: ${integer(productsCount)}<br/>
        الفواتير: ${integer(orders.length)}<br/>
        المبيعات: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه
      `, `<button class="btn primary" data-action="select-company" data-id="${escapeHtml(company.company_id)}" type="button">تفاصيل</button>`, `<span class="status ${company.visible === false ? 'red' : 'green'}">${company.visible === false ? 'مخفية' : 'ظاهرة'}</span>`);
    }).join('') : '<div class="empty-state">لا توجد شركات</div>'}</div>
  `;
}

function companyFormHtml(company) {
  const prefix = company ? 'edit' : '';
  const visibleValue = company ? (company.visible === false ? 'false' : 'true') : 'true';
  const discountValue = company ? (company.allow_discount === false ? 'false' : 'true') : 'true';
  return `
    <div class="grid cols-2">
      <label class="field"><span>كود الشركة</span><input id="${prefix}CompanyCode" type="text" value="${escapeHtml(company?.company_id || '')}" /></label>
      <label class="field"><span>اسم الشركة</span><input id="${prefix}CompanyName" type="text" value="${escapeHtml(company?.company_name || '')}" /></label>
      <label class="field"><span>اللوجو</span><input id="${prefix}CompanyLogo" type="text" value="${escapeHtml(company?.company_logo || '')}" /></label>
      <label class="field"><span>الظهور</span><select id="${prefix}CompanyVisible"><option value="true" ${visibleValue === 'true' ? 'selected' : ''}>ظاهرة</option><option value="false" ${visibleValue === 'false' ? 'selected' : ''}>مخفية</option></select></label>
      <label class="field"><span>الخصم</span><select id="${prefix}CompanyDiscount"><option value="true" ${discountValue === 'true' ? 'selected' : ''}>تسمح بالخصم</option><option value="false" ${discountValue === 'false' ? 'selected' : ''}>بدون خصم</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${company ? 'save-company-edit' : 'save-company'}" data-id="${company ? escapeHtml(company.company_id) : ''}" type="button">${company ? 'حفظ التعديل' : 'حفظ الشركة'}</button></div>
  `;
}

function renderProductsPage() {
  const rows = filteredProducts();
  const addForm = state.forms.addProduct ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة منتج جديد</div><div class="small">ربط المنتج بالشركة وتحديد أسعاره</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-product" type="button">إغلاق</button></div></div>
      ${productFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header">
        <div><div class="badge">المنتجات</div><div class="small">${integer(safeRows(state.products).length)} منتج</div></div>
        <div class="toolbar"><button class="btn" data-action="toggle-add-product" type="button">إضافة منتج</button></div>
      </div>
      <div class="search-row"><input id="productSearch" type="search" placeholder="بحث في المنتجات..." value="${escapeHtml(state.filters.q || '')}" /></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((product) => {
      const company = companyById(product.company_id);
      const carton = getBasePrice('prices_carton', product.product_id);
      const pack = getBasePrice('prices_pack', product.product_id);
      const orders = productOrders(product.product_id);
      const status = product.status === 'inactive' ? 'نفذت الكمية' : 'متاح';
      return listItem(product.product_name || '—', `
        الكود: ${escapeHtml(product.product_id || '—')}<br/>
        الشركة: ${escapeHtml(company?.company_name || '—')}<br/>
        سعر الكرتونة: ${carton !== '' ? num(carton) : '—'} جنيه<br/>
        سعر الدستة: ${pack !== '' ? num(pack) : '—'} جنيه<br/>
        الفواتير: ${integer(orders.length)}
      `, `<button class="btn primary" data-action="select-product" data-id="${escapeHtml(product.product_id)}" type="button">تفاصيل</button>`, `<span class="status ${product.visible === false ? 'red' : 'green'}">${escapeHtml(status)}</span>`);
    }).join('') : '<div class="empty-state">لا توجد منتجات</div>'}</div>
  `;
}

function productFormHtml(product) {
  const prefix = product ? 'edit' : '';
  const visibleValue = product ? (product.visible === false ? 'false' : 'true') : 'true';
  const statusValue = product ? (product.status || 'active') : 'active';
  const hasCartonValue = product ? (product.has_carton === false ? 'false' : 'true') : 'true';
  const hasPackValue = product ? (product.has_pack === false ? 'false' : 'true') : 'true';
  const discountCartonValue = product ? (product.discount_carton === false ? 'false' : 'true') : 'true';
  const discountPackValue = product ? (product.discount_pack === false ? 'false' : 'true') : 'true';
  const currentCarton = product ? getBasePrice('prices_carton', product.product_id) : '';
  const currentPack = product ? getBasePrice('prices_pack', product.product_id) : '';
  return `
    <div class="grid cols-2">
      <label class="field"><span>كود المنتج</span><input id="${prefix}ProductCode" type="text" value="${escapeHtml(product?.product_id || '')}" /></label>
      <label class="field"><span>اسم المنتج</span><input id="${prefix}ProductName" type="text" value="${escapeHtml(product?.product_name || '')}" /></label>
      <label class="field"><span>الشركة</span><select id="${prefix}ProductCompany">${safeRows(state.companies).map((company) => `<option value="${escapeHtml(company.company_id)}" ${(product && String(product.company_id || '') === String(company.company_id)) ? 'selected' : ''}>${escapeHtml(company.company_name || company.company_id)}</option>`).join('')}</select></label>
      <label class="field"><span>الصورة</span><input id="${prefix}ProductImage" type="text" value="${escapeHtml(product?.product_image || '')}" /></label>
      <label class="field"><span>سعر الكرتونة الحالي</span><input id="${prefix}ProductCartonPrice" type="number" value="${escapeHtml(currentCarton)}" /></label>
      <label class="field"><span>سعر الدستة الحالي</span><input id="${prefix}ProductPackPrice" type="number" value="${escapeHtml(currentPack)}" /></label>
      <label class="field"><span>الحالة</span><select id="${prefix}ProductStatus"><option value="active" ${statusValue === 'active' ? 'selected' : ''}>متاح</option><option value="inactive" ${statusValue === 'inactive' ? 'selected' : ''}>نفذت الكمية</option></select></label>
      <label class="field"><span>الظهور</span><select id="${prefix}ProductVisible"><option value="true" ${visibleValue === 'true' ? 'selected' : ''}>ظاهر</option><option value="false" ${visibleValue === 'false' ? 'selected' : ''}>مخفي</option></select></label>
      <label class="field"><span>الوحدة كرتونة</span><select id="${prefix}ProductHasCarton"><option value="true" ${hasCartonValue === 'true' ? 'selected' : ''}>متاحة</option><option value="false" ${hasCartonValue === 'false' ? 'selected' : ''}>غير متاحة</option></select></label>
      <label class="field"><span>الوحدة دستة</span><select id="${prefix}ProductHasPack"><option value="true" ${hasPackValue === 'true' ? 'selected' : ''}>متاحة</option><option value="false" ${hasPackValue === 'false' ? 'selected' : ''}>غير متاحة</option></select></label>
      <label class="field"><span>الخصم على الكرتونة</span><select id="${prefix}ProductDiscountCarton"><option value="true" ${discountCartonValue === 'true' ? 'selected' : ''}>يطبق</option><option value="false" ${discountCartonValue === 'false' ? 'selected' : ''}>لا يطبق</option></select></label>
      <label class="field"><span>الخصم على الدستة</span><select id="${prefix}ProductDiscountPack"><option value="true" ${discountPackValue === 'true' ? 'selected' : ''}>يطبق</option><option value="false" ${discountPackValue === 'false' ? 'selected' : ''}>لا يطبق</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${product ? 'save-product-edit' : 'save-product'}" data-id="${product ? escapeHtml(product.product_id) : ''}" type="button">${product ? 'حفظ التعديل' : 'حفظ المنتج'}</button></div>
  `;
}

function renderTiersPage() {
  const rows = filteredTiers();
  const addForm = state.forms.addTier ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة شريحة</div><div class="small">تحديد نسبة الخصم والشريحة الافتراضية</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-tier" type="button">إغلاق</button></div></div>
      ${tierFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header">
        <div><div class="badge">الشرائح</div><div class="small">${integer(safeRows(state.tiers).length)} شريحة</div></div>
        <div class="toolbar"><button class="btn" data-action="toggle-add-tier" type="button">إضافة شريحة</button></div>
      </div>
      <div class="search-row"><input id="tierSearch" type="search" placeholder="بحث في الشرائح..." value="${escapeHtml(state.filters.q || '')}" /></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((tier) => {
      const summary = tierSummary(tier.tier_name);
      return listItem(tier.visible_label || tier.tier_name || '—', `
        الاسم النظامي: ${escapeHtml(tier.tier_name || '—')}<br/>
        نسبة الخصم: ${num(tier.discount_percent || 0)}%<br/>
        الحد الأدنى: ${num(tier.min_order || 0)} جنيه<br/>
        العملاء المستخدمون: ${integer(summary.uniqueCustomers)}<br/>
        إجمالي الفواتير: ${integer(summary.ordersCount)}<br/>
        الإجمالي: ${num(summary.totalAmount)} جنيه
      `, `<button class="btn primary" data-action="select-tier" data-id="${escapeHtml(tier.tier_name)}" type="button">تفاصيل</button>`, `<span class="status ${tier.is_default ? 'green' : (tier.is_active === false || tier.visible === false ? 'red' : 'gold')}">${tier.is_default ? 'افتراضية' : (tier.is_active === false ? 'معطلة' : (tier.visible === false ? 'مخفية' : 'نشطة'))}</span>`);
    }).join('') : '<div class="empty-state">لا توجد شرائح</div>'}</div>
  `;
}

function tierFormHtml(tier) {
  const prefix = tier ? 'edit' : '';
  const visibleValue = tier ? (tier.visible === false ? 'false' : 'true') : 'true';
  const activeValue = tier ? (tier.is_active === false ? 'false' : 'true') : 'true';
  const defaultValue = tier ? (tier.is_default ? 'true' : 'false') : 'false';
  return `
    <div class="grid cols-2">
      <label class="field"><span>اسم الشريحة النظامي</span><input id="${prefix}TierName" type="text" value="${escapeHtml(tier?.tier_name || '')}" /></label>
      <label class="field"><span>الاسم المعروض</span><input id="${prefix}TierLabel" type="text" value="${escapeHtml(tier?.visible_label || '')}" /></label>
      <label class="field"><span>نسبة الخصم</span><input id="${prefix}TierDiscount" type="number" value="${escapeHtml(tier?.discount_percent ?? 0)}" /></label>
      <label class="field"><span>الحد الأدنى</span><input id="${prefix}TierMinOrder" type="number" value="${escapeHtml(tier?.min_order ?? 0)}" /></label>
      <label class="field"><span>الظهور</span><select id="${prefix}TierVisible"><option value="true" ${visibleValue === 'true' ? 'selected' : ''}>ظاهر</option><option value="false" ${visibleValue === 'false' ? 'selected' : ''}>مخفي</option></select></label>
      <label class="field"><span>الحالة</span><select id="${prefix}TierActive"><option value="true" ${activeValue === 'true' ? 'selected' : ''}>نشطة</option><option value="false" ${activeValue === 'false' ? 'selected' : ''}>معطلة</option></select></label>
      <label class="field"><span>الافتراضية</span><select id="${prefix}TierDefault"><option value="true" ${defaultValue === 'true' ? 'selected' : ''}>نعم</option><option value="false" ${defaultValue === 'false' ? 'selected' : ''}>لا</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${tier ? 'save-tier-edit' : 'save-tier'}" data-id="${tier ? escapeHtml(tier.tier_name) : ''}" type="button">${tier ? 'حفظ التعديل' : 'حفظ الشريحة'}</button></div>
  `;
}

function renderDealsPage() {
  const rows = safeRows(state.dailyDeals);
  const addForm = state.forms.addDeal ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة صفقة اليوم</div><div class="small">عرض يومي أو صفقة ثابتة</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-deal" type="button">إغلاق</button></div></div>
      ${dealFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header"><div><div class="badge">صفقة اليوم</div><div class="small">${integer(rows.length)} عرض</div></div><div class="toolbar"><button class="btn" data-action="toggle-add-deal" type="button">إضافة صفقة</button></div></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((deal) => {
      const orders = dealOrders(deal.id);
      return listItem(deal.title || '—', `الوصف: ${escapeHtml(deal.description || '—')}<br/>السعر: ${num(deal.price || 0)} جنيه<br/>الطلبات: ${integer(orders.length)}<br/>الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه`, `<button class="btn primary" data-action="select-deal" data-id="${escapeHtml(deal.id)}" type="button">تفاصيل</button>`, `<span class="status ${deal.is_active === false ? 'red' : 'green'}">${deal.is_active === false ? 'منتهية' : 'متاحة'}</span>`);
    }).join('') : '<div class="empty-state">لا توجد صفقات</div>'}</div>
  `;
}

function dealFormHtml(deal) {
  const prefix = deal ? 'edit' : '';
  const activeValue = deal ? (deal.is_active === false ? 'false' : 'true') : 'true';
  return `
    <div class="grid cols-2">
      <label class="field"><span>الاسم</span><input id="${prefix}DealTitle" type="text" value="${escapeHtml(deal?.title || '')}" /></label>
      <label class="field"><span>الوصف</span><input id="${prefix}DealDescription" type="text" value="${escapeHtml(deal?.description || '')}" /></label>
      <label class="field"><span>السعر</span><input id="${prefix}DealPrice" type="number" value="${escapeHtml(deal?.price ?? 0)}" /></label>
      <label class="field"><span>الصورة</span><input id="${prefix}DealImage" type="text" value="${escapeHtml(deal?.image || '')}" /></label>
      <label class="field"><span>المخزون</span><input id="${prefix}DealStock" type="number" value="${escapeHtml(deal?.stock ?? 0)}" /></label>
      <label class="field"><span>المباع</span><input id="${prefix}DealSold" type="number" value="${escapeHtml(deal?.sold_count ?? 0)}" /></label>
      <label class="field"><span>الحالة</span><select id="${prefix}DealActive"><option value="true" ${activeValue === 'true' ? 'selected' : ''}>متاحة</option><option value="false" ${activeValue === 'false' ? 'selected' : ''}>منتهية</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${deal ? 'save-deal-edit' : 'save-deal'}" data-id="${deal ? escapeHtml(deal.id) : ''}" type="button">${deal ? 'حفظ التعديل' : 'حفظ الصفقة'}</button></div>
  `;
}

function renderFlashPage() {
  const rows = safeRows(state.flashOffers);
  const addForm = state.forms.addFlash ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة عرض الساعة</div><div class="small">تحديد البداية والنهاية</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-flash" type="button">إغلاق</button></div></div>
      ${flashFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header"><div><div class="badge">عرض الساعة</div><div class="small">${integer(rows.length)} عرض</div></div><div class="toolbar"><button class="btn" data-action="toggle-add-flash" type="button">إضافة عرض</button></div></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((offer) => {
      const orders = flashOrders(offer.id);
      return listItem(offer.title || '—', `يبدأ: ${formatDateTime(offer.start_time)}<br/>ينتهي: ${formatDateTime(offer.end_time)}<br/>السعر: ${num(offer.price || 0)} جنيه<br/>الطلبات: ${integer(orders.length)}<br/>الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه`, `<button class="btn primary" data-action="select-flash" data-id="${escapeHtml(offer.id)}" type="button">تفاصيل</button>`, `<span class="status ${offer.is_active === false ? 'red' : 'green'}">${offer.is_active === false ? 'مخفي' : 'نشط'}</span>`);
    }).join('') : '<div class="empty-state">لا توجد عروض</div>'}</div>
  `;
}

function flashFormHtml(offer) {
  const prefix = offer ? 'edit' : '';
  const activeValue = offer ? (offer.is_active === false ? 'false' : 'true') : 'true';
  return `
    <div class="grid cols-2">
      <label class="field"><span>الاسم</span><input id="${prefix}FlashTitle" type="text" value="${escapeHtml(offer?.title || '')}" /></label>
      <label class="field"><span>الوصف</span><input id="${prefix}FlashDescription" type="text" value="${escapeHtml(offer?.description || '')}" /></label>
      <label class="field"><span>السعر</span><input id="${prefix}FlashPrice" type="number" value="${escapeHtml(offer?.price ?? 0)}" /></label>
      <label class="field"><span>الصورة</span><input id="${prefix}FlashImage" type="text" value="${escapeHtml(offer?.image || '')}" /></label>
      <label class="field"><span>بداية العرض</span><input id="${prefix}FlashStart" type="datetime-local" value="${formatDateTimeInput(offer?.start_time)}" /></label>
      <label class="field"><span>نهاية العرض</span><input id="${prefix}FlashEnd" type="datetime-local" value="${formatDateTimeInput(offer?.end_time)}" /></label>
      <label class="field"><span>المخزون</span><input id="${prefix}FlashStock" type="number" value="${escapeHtml(offer?.stock ?? 0)}" /></label>
      <label class="field"><span>المباع</span><input id="${prefix}FlashSold" type="number" value="${escapeHtml(offer?.sold_count ?? 0)}" /></label>
      <label class="field"><span>الحالة</span><select id="${prefix}FlashActive"><option value="true" ${activeValue === 'true' ? 'selected' : ''}>نشط</option><option value="false" ${activeValue === 'false' ? 'selected' : ''}>مخفي</option></select></label>
    </div>
    <div class="toolbar"><button class="btn primary" data-action="${offer ? 'save-flash-edit' : 'save-flash'}" data-id="${offer ? escapeHtml(offer.id) : ''}" type="button">${offer ? 'حفظ التعديل' : 'حفظ العرض'}</button></div>
  `;
}

function orderDetailsCard(order) {
  const { customer, rep } = orderPartyInfo(order);
  const items = orderItemsFor(order.id).map((item) => `
    <div class="item compact">
      <div class="item-head">
        <div>
          <div class="item-title">${escapeHtml(lookupItemName(item))}</div>
          <div class="item-meta">كود الصنف: ${escapeHtml(lookupItemCode(item))}<br/>الوحدة: ${escapeHtml(item.unit || '—')}<br/>سعر الوحدة: ${num(item.price || 0)} جنيه<br/>الكمية: ${integer(item.qty || 0)}<br/>الإجمالي: ${num(Number(item.qty || 0) * Number(item.price || 0))} جنيه</div>
        </div>
      </div>
    </div>
  `).join('');
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات الفاتورة</div><div class="small">${escapeHtml(order.customer_type === 'rep' ? 'مندوب' : 'عميل مباشر')}</div></div><div class="toolbar"><button class="btn primary" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ</button><button class="btn" data-action="delete-order" data-id="${escapeHtml(order.id)}" type="button">حذف</button></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">رقم الفاتورة</div><div class="item-meta">${escapeHtml(order.invoice_number || order.order_number || order.id)}</div></div>
          <div class="item compact"><div class="item-title">الحالة</div><div class="item-meta">${escapeHtml(statusLabel(order.workflow_status || order.status))}</div></div>
          <div class="item compact"><div class="item-title">نوع العميل</div><div class="item-meta">${escapeHtml(order.customer_type === 'rep' ? 'مندوب' : 'عميل مباشر')}</div></div>
          <div class="item compact"><div class="item-title">تاريخ الإنشاء</div><div class="item-meta">${formatDateTime(order.created_at)}</div></div>
        </div>
        <div class="grid cols-2" style="margin-top:10px">
          <div class="item compact"><div class="item-title">بيانات المندوب</div><div class="item-meta">الاسم: ${escapeHtml(rep.name || '—')}<br/>الهاتف: ${escapeHtml(rep.phone || '—')}<br/>المنطقة: ${escapeHtml(rep.region || '—')}</div></div>
          <div class="item compact"><div class="item-title">بيانات العميل</div><div class="item-meta">الاسم: ${escapeHtml(customer.name || '—')}<br/>الهاتف: ${escapeHtml(customer.phone || '—')}<br/>العنوان: ${escapeHtml(customer.address || '—')}</div></div>
        </div>
        <div class="item compact" style="margin-top:10px"><div class="item-title">بيانات الشريحة</div><div class="item-meta">${escapeHtml(order.tier_name || 'الشريحة الأساسية')}</div></div>
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">نص الفاتورة</div><div class="small">نفس المحتوى المرسل إلى واتساب</div></div></div>
        <pre class="invoice-pre">${escapeHtml(buildInvoiceText(order))}</pre>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">تحديث حالة الطلب</div><div class="small">يحفظ مباشرة في قاعدة البيانات</div></div></div>
      <div class="toolbar">
        <select id="orderStatusSelect">
          ${AR_STATUS.map((s) => `<option value="${escapeHtml(s)}" ${statusLabel(order.workflow_status || order.status) === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
        <button class="btn primary" data-action="save-order-status" data-id="${escapeHtml(order.id)}" type="button">حفظ الحالة</button>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">تفاصيل الأصناف</div><div class="small">${integer(orderItemsFor(order.id).length)} صنف</div></div></div>
      <div class="list">${items || '<div class="empty-state">لا توجد أصناف</div>'}</div>
    </div>
  `;
}

function customerDetailsCard(customer) {
  const rep = repById(customer.sales_rep_id);
  const orders = customerOrders(customer.id);
  const editAction = customer ? `save-customer-edit` : 'save-customer';
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات العميل</div><div class="small">إضافة / تعديل / حذف</div></div><div class="toolbar"><button class="btn primary" data-action="${editAction}" data-id="${escapeHtml(customer.id)}" type="button">حفظ التعديل</button><button class="btn" data-action="toggle-customer" data-id="${escapeHtml(customer.id)}" type="button">${customer.is_active === false ? 'تفعيل' : 'تعطيل'}</button><button class="btn" data-action="delete-customer" data-id="${escapeHtml(customer.id)}" type="button">حذف</button></div></div>
        ${customerFormHtml(customer)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">معلومات العميل</div><div class="small">${escapeHtml(customer.customer_type === 'rep' ? 'عميل مندوب' : 'عميل مباشر')}</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الاسم</div><div class="item-meta">${escapeHtml(customer.name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الهاتف</div><div class="item-meta">${escapeHtml(customer.phone || '—')}</div></div>
          <div class="item compact"><div class="item-title">العنوان</div><div class="item-meta">${escapeHtml(customer.address || '—')}</div></div>
          <div class="item compact"><div class="item-title">المنطقة</div><div class="item-meta">${escapeHtml(customer.location || '—')}</div></div>
          <div class="item compact"><div class="item-title">المندوب</div><div class="item-meta">${escapeHtml(rep?.name || 'غير مرتبط')}</div></div>
          <div class="item compact"><div class="item-title">تاريخ التسجيل</div><div class="item-meta">${formatDateTime(customer.created_at)}</div></div>
        </div>
        <div class="toolbar" style="margin-top:10px">
          <select id="repCustomerSelect">${['<option value="">اختر مندوبًا</option>'].concat(safeRows(state.reps).map((r) => `<option value="${escapeHtml(r.id)}" ${String(customer.sales_rep_id || '') === String(r.id) ? 'selected' : ''}>${escapeHtml(r.name || r.id)}</option>`)).join('')}</select>
          <button class="btn primary" data-action="link-customer-to-rep" data-id="${escapeHtml(customer.id)}" type="button">ربط بمندوب</button>
          <button class="btn" data-action="unlink-customer-from-rep" data-id="${escapeHtml(customer.id)}" type="button">فصل الربط</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير العميل</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `التاريخ: ${formatDateTime(order.created_at)}<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}<br/>الإجمالي: ${num(order.total_amount || 0)} جنيه`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button><button class="btn" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function repDetailsCard(rep) {
  const customers = activeRepCustomers(rep.id);
  const orders = repOrders(rep.id);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات المندوب</div><div class="small">تعديل / حذف / ربط عملاء</div></div><div class="toolbar"><button class="btn primary" data-action="save-rep-edit" data-id="${escapeHtml(rep.id)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-rep" data-id="${escapeHtml(rep.id)}" type="button">حذف</button></div></div>
        ${repFormHtml(rep)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">معلومات المندوب</div><div class="small">إجمالي الطلبات: ${integer(orders.length)} — الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الاسم</div><div class="item-meta">${escapeHtml(rep.name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الهاتف</div><div class="item-meta">${escapeHtml(rep.phone || '—')}</div></div>
          <div class="item compact"><div class="item-title">المنطقة</div><div class="item-meta">${escapeHtml(rep.region || '—')}</div></div>
          <div class="item compact"><div class="item-title">تاريخ التسجيل</div><div class="item-meta">${formatDateTime(rep.created_at)}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">عملاء المندوب</div><div class="small">${integer(customers.length)} عميل</div></div><div class="toolbar"><select id="repCustomerSelect">${['<option value="">اختر عميلًا</option>'].concat(safeRows(state.customers).filter((c) => String(c.sales_rep_id || '') !== String(rep.id)).map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}${c.customer_type === 'rep' ? ' — مندوب' : ' — مباشر'}</option>`)).join('')}</select><button class="btn primary" data-action="link-customer-to-rep" data-id="${escapeHtml(rep.id)}" type="button">ربط عميل</button></div></div>
      <div class="list">${customers.length ? customers.map((customer) => listItem(customer.name || '—', `الهاتف: ${escapeHtml(customer.phone || '—')}<br/>النوع: ${escapeHtml(customer.customer_type === 'rep' ? 'مندوب' : 'مباشر')}<br/>تاريخ التسجيل: ${formatDateTime(customer.created_at)}`, `<button class="btn primary" data-action="select-customer" data-id="${escapeHtml(customer.id)}" type="button">تفاصيل</button><button class="btn" data-action="unlink-customer-from-rep" data-id="${escapeHtml(customer.id)}" type="button">فصل</button>`)).join('') : '<div class="empty-state">لا يوجد عملاء مرتبطون</div>'}</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير المندوب</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `العميل: ${escapeHtml(customerById(order.customer_id)?.name || '—')}<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}<br/>الإجمالي: ${num(order.total_amount || 0)} جنيه`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button><button class="btn" data-action="copy-invoice" data-id="${escapeHtml(order.id)}" type="button">نسخ</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function companyDetailsCard(company) {
  const products = safeRows(state.products).filter((p) => String(p.company_id || '') === String(company.company_id));
  const orders = companyOrders(company.company_id);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات الشركة</div><div class="small">تعديل الاسم أو الكود أو اللوجو</div></div><div class="toolbar"><button class="btn primary" data-action="save-company-edit" data-id="${escapeHtml(company.company_id)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-company" data-id="${escapeHtml(company.company_id)}" type="button">حذف</button></div></div>
        ${companyFormHtml(company)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">ملخص الشركة</div><div class="small">المنتجات: ${integer(products.length)} — الفواتير: ${integer(orders.length)} — المبيعات: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">كود الشركة</div><div class="item-meta">${escapeHtml(company.company_id || '—')}</div></div>
          <div class="item compact"><div class="item-title">اسم الشركة</div><div class="item-meta">${escapeHtml(company.company_name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الظهور</div><div class="item-meta">${company.visible === false ? 'مخفية' : 'ظاهرة'}</div></div>
          <div class="item compact"><div class="item-title">الخصم</div><div class="item-meta">${company.allow_discount === false ? 'بدون خصم' : 'تسمح بالخصم'}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">منتجات الشركة</div><div class="small">${integer(products.length)} منتج</div></div></div>
      <div class="list">${products.length ? products.map((product) => listItem(product.product_name || '—', `الكود: ${escapeHtml(product.product_id || '—')}<br/>السعر: ${num(getBasePrice('prices_carton', product.product_id) || 0)} / ${num(getBasePrice('prices_pack', product.product_id) || 0)} جنيه`, `<button class="btn primary" data-action="select-product" data-id="${escapeHtml(product.product_id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد منتجات</div>'}</div>
    </div>
  `;
}

function productDetailsCard(product) {
  const orders = productOrders(product.product_id);
  const company = companyById(product.company_id);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات المنتج</div><div class="small">تعديل/حذف/إخفاء/حالة</div></div><div class="toolbar"><button class="btn primary" data-action="save-product-edit" data-id="${escapeHtml(product.product_id)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-product" data-id="${escapeHtml(product.product_id)}" type="button">حذف</button></div></div>
        ${productFormHtml(product)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">ملخص المنتج</div><div class="small">الفواتير: ${integer(orders.length)} — الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الكود</div><div class="item-meta">${escapeHtml(product.product_id || '—')}</div></div>
          <div class="item compact"><div class="item-title">الاسم</div><div class="item-meta">${escapeHtml(product.product_name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الشركة</div><div class="item-meta">${escapeHtml(company?.company_name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الحالة</div><div class="item-meta">${escapeHtml(statusLabel(product.status))}</div></div>
          <div class="item compact"><div class="item-title">سعر الكرتونة</div><div class="item-meta">${num(getBasePrice('prices_carton', product.product_id) || 0)} جنيه</div></div>
          <div class="item compact"><div class="item-title">سعر الدستة</div><div class="item-meta">${num(getBasePrice('prices_pack', product.product_id) || 0)} جنيه</div></div>
          <div class="item compact"><div class="item-title">الظهور</div><div class="item-meta">${product.visible === false ? 'مخفي' : 'ظاهر'}</div></div>
          <div class="item compact"><div class="item-title">الخصم</div><div class="item-meta">الكرتونة: ${product.discount_carton === false ? 'لا' : 'نعم'} — الدستة: ${product.discount_pack === false ? 'لا' : 'نعم'}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير المنتج</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `العميل: ${escapeHtml(customerById(order.customer_id)?.name || '—')}<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}<br/>الإجمالي: ${num(order.total_amount || 0)} جنيه`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function tierDetailsCard(tier) {
  const summary = tierSummary(tier.tier_name);
  const orders = tierOrders(tier.tier_name);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات الشريحة</div><div class="small">تعديل / حذف / تعيين افتراضي</div></div><div class="toolbar"><button class="btn primary" data-action="save-tier-edit" data-id="${escapeHtml(tier.tier_name)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-tier" data-id="${escapeHtml(tier.tier_name)}" type="button">حذف</button></div></div>
        ${tierFormHtml(tier)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">ملخص الشريحة</div><div class="small">عملاء: ${integer(summary.uniqueCustomers)} — فواتير: ${integer(summary.ordersCount)} — الإجمالي: ${num(summary.totalAmount)} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الاسم النظامي</div><div class="item-meta">${escapeHtml(tier.tier_name || '—')}</div></div>
          <div class="item compact"><div class="item-title">الاسم المعروض</div><div class="item-meta">${escapeHtml(tier.visible_label || '—')}</div></div>
          <div class="item compact"><div class="item-title">نسبة الخصم</div><div class="item-meta">${num(tier.discount_percent || 0)}%</div></div>
          <div class="item compact"><div class="item-title">الحد الأدنى</div><div class="item-meta">${num(tier.min_order || 0)} جنيه</div></div>
          <div class="item compact"><div class="item-title">الحالة</div><div class="item-meta">${tier.is_active === false ? 'معطلة' : 'نشطة'}</div></div>
          <div class="item compact"><div class="item-title">افتراضية</div><div class="item-meta">${tier.is_default ? 'نعم' : 'لا'}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير الشريحة</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `العميل: ${escapeHtml(customerById(order.customer_id)?.name || '—')}<br/>المبلغ: ${num(order.total_amount || 0)} جنيه<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function dealDetailsCard(deal) {
  const orders = dealOrders(deal.id);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات الصفقة</div><div class="small">عرض اليوم</div></div><div class="toolbar"><button class="btn primary" data-action="save-deal-edit" data-id="${escapeHtml(deal.id)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-deal" data-id="${escapeHtml(deal.id)}" type="button">حذف</button></div></div>
        ${dealFormHtml(deal)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">ملخص الصفقة</div><div class="small">الطلبات: ${integer(orders.length)} — الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الاسم</div><div class="item-meta">${escapeHtml(deal.title || '—')}</div></div>
          <div class="item compact"><div class="item-title">السعر</div><div class="item-meta">${num(deal.price || 0)} جنيه</div></div>
          <div class="item compact"><div class="item-title">المخزون</div><div class="item-meta">${integer(deal.stock || 0)}</div></div>
          <div class="item compact"><div class="item-title">المباع</div><div class="item-meta">${integer(deal.sold_count || 0)}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير الصفقة</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `العميل: ${escapeHtml(customerById(order.customer_id)?.name || '—')}<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}<br/>الإجمالي: ${num(order.total_amount || 0)} جنيه`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function flashDetailsCard(offer) {
  const orders = flashOrders(offer.id);
  return `
    <div class="grid cols-2">
      <div class="card">
        <div class="header"><div><div class="badge">بيانات العرض</div><div class="small">عرض الساعة</div></div><div class="toolbar"><button class="btn primary" data-action="save-flash-edit" data-id="${escapeHtml(offer.id)}" type="button">حفظ التعديل</button><button class="btn" data-action="delete-flash" data-id="${escapeHtml(offer.id)}" type="button">حذف</button></div></div>
        ${flashFormHtml(offer)}
      </div>
      <div class="card">
        <div class="header"><div><div class="badge">ملخص العرض</div><div class="small">الطلبات: ${integer(orders.length)} — الإجمالي: ${num(orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} جنيه</div></div></div>
        <div class="grid cols-2">
          <div class="item compact"><div class="item-title">الاسم</div><div class="item-meta">${escapeHtml(offer.title || '—')}</div></div>
          <div class="item compact"><div class="item-title">السعر</div><div class="item-meta">${num(offer.price || 0)} جنيه</div></div>
          <div class="item compact"><div class="item-title">البداية</div><div class="item-meta">${formatDateTime(offer.start_time)}</div></div>
          <div class="item compact"><div class="item-title">النهاية</div><div class="item-meta">${formatDateTime(offer.end_time)}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="header"><div><div class="badge">فواتير العرض</div><div class="small">${integer(orders.length)} فاتورة</div></div></div>
      <div class="list">${orders.length ? orders.map((order) => listItem(`فاتورة ${order.invoice_number || order.order_number || order.id}`, `العميل: ${escapeHtml(customerById(order.customer_id)?.name || '—')}<br/>الحالة: ${escapeHtml(statusLabel(order.workflow_status || order.status))}<br/>الإجمالي: ${num(order.total_amount || 0)} جنيه`, `<button class="btn primary" data-action="select-order" data-id="${escapeHtml(order.id)}" type="button">تفاصيل</button>`)).join('') : '<div class="empty-state">لا توجد فواتير</div>'}</div>
    </div>
  `;
}

function renderUsersPage() {
  const rows = safeRows(state.users);
  const addForm = state.forms.addUser ? `
    <div class="card">
      <div class="header"><div><div class="badge">إضافة مستخدم محلي</div><div class="small">الصلاحيات المحلية فقط</div></div><div class="toolbar"><button class="btn" data-action="cancel-add-user" type="button">إغلاق</button></div></div>
      ${localUserFormHtml(null)}
    </div>
  ` : '';
  return `
    <div class="card">
      <div class="header"><div><div class="badge">إدارة المستخدمين</div><div class="small">المستخدمون المحليون فقط</div></div><div class="toolbar"><button class="btn" data-action="toggle-add-user" type="button">إضافة مستخدم</button></div></div>
    </div>
    ${addForm}
    <div class="list">${rows.length ? rows.map((user, idx) => listItem(user.name || user.username || '—', `اسم المستخدم: ${escapeHtml(user.username || '—')}<br/>الصلاحيات: ${Object.entries(user.permissions || {}).filter(([,v]) => v).map(([k]) => k).join('، ') || 'لا توجد'}`, `<button class="btn" data-action="delete-local-user" data-id="${idx}" type="button">حذف</button>`)).join('') : '<div class="empty-state">لا يوجد مستخدمون</div>'}</div>
  `;
}

function localUserFormHtml(user) {
  return `
    <div class="grid cols-2">
      <label class="field"><span>الاسم</span><input id="uName" type="text" value="${escapeHtml(user?.name || '')}" /></label>
      <label class="field"><span>اسم المستخدم</span><input id="uUsername" type="text" value="${escapeHtml(user?.username || '')}" /></label>
      <label class="field"><span>كلمة المرور</span><input id="uPassword" type="password" value="${escapeHtml(user?.password || '')}" /></label>
    </div>
    <div class="grid cols-3" style="margin-top:10px">
      ${['dashboard','orders','customers','reps','companies','products','tiers','deals','flash','reports','users'].map((key) => `
        <label class="item compact"><span class="small">${key === 'dashboard' ? 'الرئيسية' : key === 'orders' ? 'الطلبات' : key === 'customers' ? 'العملاء' : key === 'reps' ? 'المناديب' : key === 'companies' ? 'الشركات' : key === 'products' ? 'المنتجات' : key === 'tiers' ? 'الشرائح' : key === 'deals' ? 'صفقة اليوم' : key === 'flash' ? 'عرض الساعة' : key === 'reports' ? 'التقارير' : 'المستخدمين'}</span><br/><input id="perm_${key}" type="checkbox" ${user?.permissions?.[key] ? 'checked' : ''} /></label>`).join('')}
    </div>
    <div class="toolbar" style="margin-top:10px"><button class="btn primary" data-action="save-local-user" type="button">حفظ المستخدم</button></div>
  `;
}

function renderReportsPage() {
  const topCompanies = computeTopCompaniesFromRaw();
  const topProducts = computeTopProductsFromRaw();
  const topCustomers = computeTopCustomersFromRaw();
  const repsPerformance = computeRepsPerformanceFromRaw();
  const salesDaily = computeDailySalesFromRaw();
  const tierStats = safeRows(state.tiers).map((tier) => ({ tier, ...tierSummary(tier.tier_name) }));
  const dealStats = buildDealStats();
  return `
    <div class="card">
      <div class="header"><div><div class="badge">التقارير</div><div class="small">اختر من وإلى للفترة الزمنية</div></div></div>
      <div class="search-row">
        <input id="reportFrom" type="date" value="${escapeHtml(state.filters.from || '')}" />
        <input id="reportTo" type="date" value="${escapeHtml(state.filters.to || '')}" />
        <button class="btn primary" data-action="apply-report-filter" type="button">تطبيق</button>
      </div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${pageCard('تقارير الطلبات', 'ملخص الحالات والإجماليات', Object.entries(computeOrdersStatusFromRaw()).map(([label, val]) => listItem(label, `العدد: ${integer(val.count || 0)}<br/>الإجمالي: ${num(val.total || 0)} جنيه`, `<button class="btn primary" data-page="orders" type="button">عرض الطلبات</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
      ${pageCard('تقارير الشركات', 'أفضل الشركات حسب المبيعات', topCompanies.slice(0, 10).map((row) => listItem(row.company_name || row.company_id, `الأصناف: ${integer(row.total_items || 0)} — المبيعات: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-page="company-detail" data-id="${escapeHtml(row.company_id)}" type="button">فتح</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${pageCard('تقارير المنتجات', 'أفضل المنتجات حسب الكمية', topProducts.slice(0, 10).map((row) => listItem(row.product_name || row.product_id, `الكمية: ${integer(row.total_qty || 0)} — المبيعات: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-page="product-detail" data-id="${escapeHtml(row.product_id)}" type="button">فتح</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
      ${pageCard('تقارير العملاء', 'أفضل العملاء والمباشر/مندوب', topCustomers.slice(0, 10).map((row) => listItem(row.name || row.id, `الهاتف: ${escapeHtml(row.phone || '—')}<br/>الطلبات: ${integer(row.total_orders || 0)}<br/>الإجمالي: ${num(row.total_spent || 0)} جنيه`, `<button class="btn primary" data-page="customer-detail" data-id="${escapeHtml(row.id)}" type="button">فتح</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${pageCard('تقارير المناديب', 'أفضل المندوبين حسب المبيعات', repsPerformance.slice(0, 10).map((row) => listItem(row.name || row.id, `المنطقة: ${escapeHtml(row.region || '—')}<br/>الطلبات: ${integer(row.total_orders || 0)}<br/>الإجمالي: ${num(row.total_sales || 0)} جنيه`, `<button class="btn primary" data-page="rep-detail" data-id="${escapeHtml(row.id)}" type="button">فتح</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
      ${pageCard('تقارير الشرائح', 'استخدام الشرائح والإجماليات', tierStats.map((row) => listItem(row.tier.visible_label || row.tier.tier_name || '—', `الاسم: ${escapeHtml(row.tier.tier_name || '—')}<br/>العملاء: ${integer(row.uniqueCustomers)}<br/>الفواتير: ${integer(row.ordersCount)}<br/>الإجمالي: ${num(row.totalAmount)} جنيه`, `<button class="btn primary" data-page="tier-detail" data-id="${escapeHtml(row.tier.tier_name)}" type="button">فتح</button>`)).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${pageCard('تقارير صفقة اليوم', 'عدد المشتريات والإجمالي', dealStats.length ? dealStats.map((row) => listItem(row.title || row.id, `الطلبات: ${integer(row.count || 0)}<br/>الإجمالي: ${num(row.total || 0)} جنيه`, `<button class="btn primary" data-page="deal-detail" data-id="${escapeHtml(row.id)}" type="button">فتح</button>`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
      ${pageCard('تقارير عرض الساعة', 'عدد المشتريات والإجمالي', safeRows(state.flashOffers).map((offer) => {
        const orders = flashOrders(offer.id);
        const total = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
        return listItem(offer.title || offer.id, `الطلبات: ${integer(orders.length)}<br/>الإجمالي: ${num(total)} جنيه`, `<button class="btn primary" data-page="flash-detail" data-id="${escapeHtml(offer.id)}" type="button">فتح</button>`);
      }).join('') || '<div class="empty-state">لا توجد بيانات</div>')}
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${pageCard('المبيعات اليومية', 'سجل المبيعات حسب اليوم', salesDaily.length ? salesDaily.map((row) => listItem(row.day || '—', `الطلبات: ${integer(row.orders_count || 0)}<br/>الإجمالي: ${num(row.total_sales || 0)} جنيه`)).join('') : '<div class="empty-state">لا توجد بيانات</div>')}
      ${pageCard('تقارير كاملة', 'مؤشرات سريعة', `
        <div class="grid cols-2">
          ${renderMetric('أفضل شركة', topCompanies[0]?.company_name || '—', `${num(topCompanies[0]?.total_sales || 0)} جنيه`)}
          ${renderMetric('أفضل منتج', topProducts[0]?.product_name || '—', `${integer(topProducts[0]?.total_qty || 0)} وحدة`)}
          ${renderMetric('أفضل عميل', topCustomers[0]?.name || '—', `${num(topCustomers[0]?.total_spent || 0)} جنيه`)}
          ${renderMetric('أفضل مندوب', repsPerformance[0]?.name || '—', `${num(repsPerformance[0]?.total_sales || 0)} جنيه`)}
        </div>
      `)}
    </div>
  `;
}

function renderPage() {
  if (state.loading) {
    return '<section class="card"><div class="empty-state">جارٍ تحميل البيانات من قاعدة البيانات...</div></section>';
  }
  switch (state.page) {
    case 'dashboard': return renderDashboardHome();
    case 'orders': return renderOrdersPage();
    case 'order-detail': return orderDetailPage();
    case 'customers': return renderCustomersPage();
    case 'customer-detail': return customerDetailPage();
    case 'reps': return renderRepsPage();
    case 'rep-detail': return repDetailPage();
    case 'companies': return renderCompaniesPage();
    case 'company-detail': return companyDetailPage();
    case 'products': return renderProductsPage();
    case 'product-detail': return productDetailPage();
    case 'tiers': return renderTiersPage();
    case 'tier-detail': return tierDetailPage();
    case 'deals': return renderDealsPage();
    case 'deal-detail': return dealDetailPage();
    case 'flash': return renderFlashPage();
    case 'flash-detail': return flashDetailPage();
    case 'reports': return renderReportsPage();
    case 'users': return renderUsersPage();
    default: return renderDashboardHome();
  }
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fuzzyScore(haystack, needle) {
  const h = normalizeSearchText(haystack);
  const n = normalizeSearchText(needle);
  if (!n) return 0;
  if (h.includes(n)) return 100 - Math.max(0, h.length - n.length);
  let score = 0;
  let i = 0;
  for (const ch of n) {
    const idx = h.indexOf(ch, i);
    if (idx === -1) return 0;
    score += 2;
    i = idx + 1;
  }
  return score;
}

function performGlobalSearch(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const candidates = [];
  (state.orders || []).forEach((o) => {
    const { customer, rep } = orderPartyInfo(o);
    candidates.push({ type: 'order-detail', id: o.id, label: `فاتورة ${o.invoice_number || o.order_number || o.id}`, score: fuzzyScore(`${o.invoice_number} ${o.order_number} ${o.id} ${customer.name} ${customer.phone} ${rep.name} ${rep.phone} ${o.tier_name} ${o.status} ${o.workflow_status}`, q) });
  });
  (state.customers || []).forEach((c) => candidates.push({ type: 'customer-detail', id: c.id, label: c.name, score: fuzzyScore(`${c.name} ${c.phone} ${c.address} ${c.location} ${c.username} ${c.customer_type}`, q) }));
  (state.reps || []).forEach((r) => candidates.push({ type: 'rep-detail', id: r.id, label: r.name, score: fuzzyScore(`${r.name} ${r.phone} ${r.region} ${r.username}`, q) }));
  (state.products || []).forEach((p) => candidates.push({ type: 'product-detail', id: p.product_id, label: p.product_name, score: fuzzyScore(`${p.product_name} ${p.product_id} ${companyById(p.company_id)?.company_name || ''} ${statusLabel(p.status)}`, q) }));
  (state.companies || []).forEach((c) => candidates.push({ type: 'company-detail', id: c.company_id, label: c.company_name, score: fuzzyScore(`${c.company_name} ${c.company_id}`, q) }));
  (state.tiers || []).forEach((t) => candidates.push({ type: 'tier-detail', id: t.tier_name, label: t.visible_label || t.tier_name, score: fuzzyScore(`${t.tier_name} ${t.visible_label}`, q) }));
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] && candidates[0].score > 0 ? candidates[0] : null;
}
function renderLogin() {
  return `
    <section class="login-wrap">
      <div class="login-card">
        <div class="brand">
          <div>
            <div class="badge">Administrator</div>
            <h1 style="margin:12px 0 4px">لوحة تحكم شجرية عربية</h1>
            <div class="small">واجهة موبايل أول مع وصول مباشر للبيانات من Supabase</div>
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

  app.innerHTML = `
    <div class="topbar-shell">
      <div class="topbar">
        <div class="topbar-brand">
          <div class="badge">${escapeHtml(state.user.name || state.user.username || 'مستخدم')}</div>
          <div>
            <h1>لوحة التحكم</h1>
            <div class="small">موبايل أول • ربط مباشر بقاعدة البيانات</div>
          </div>
        </div>
        <div class="toolbar header-actions">
          <button class="btn" id="refreshBtn" type="button">تحديث</button>
          <button class="btn" id="backBtn" type="button">رجوع</button>
          <button class="btn primary" id="homeBtn" type="button">الرئيسية</button>
          <button class="btn" id="logoutBtn" type="button">خروج</button>
        </div>
      </div>
    </div>

    <main class="page-frame">
      ${renderPage()}
    </main>

    <footer>لوحة تحكم عربية متعددة الصفحات مرتبطة مباشرة بقاعدة البيانات الحالية.</footer>
  `;

  bindShell();
}


function render() {
  renderShell();
  bindPageEvents();
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
  document.querySelectorAll('[data-action="set-hub-section"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.hubSection = btn.getAttribute('data-value') || 'orders';
      render();
    });
  });
  document.querySelectorAll('[data-action="go-orders"]').forEach((btn) => btn.addEventListener('click', () => navigate('orders')));
  document.querySelectorAll('[data-action="go-customers"]').forEach((btn) => btn.addEventListener('click', () => navigate('customers')));
  document.querySelectorAll('[data-action="go-reps"]').forEach((btn) => btn.addEventListener('click', () => navigate('reps')));
  document.querySelectorAll('[data-action="go-companies"]').forEach((btn) => btn.addEventListener('click', () => navigate('companies')));
  document.querySelectorAll('[data-action="go-products"]').forEach((btn) => btn.addEventListener('click', () => navigate('products')));
  document.querySelectorAll('[data-action="go-tiers"]').forEach((btn) => btn.addEventListener('click', () => navigate('tiers')));
  document.querySelectorAll('[data-action="go-deals"]').forEach((btn) => btn.addEventListener('click', () => navigate('deals')));
  document.querySelectorAll('[data-action="go-flash"]').forEach((btn) => btn.addEventListener('click', () => navigate('flash')));
  document.querySelectorAll('[data-action="go-reports"]').forEach((btn) => btn.addEventListener('click', () => navigate('reports')));
  document.querySelectorAll('[data-action="go-users"]').forEach((btn) => btn.addEventListener('click', () => navigate('users')));
  document.getElementById('homeBtn')?.addEventListener('click', () => navigate(DEFAULT_PAGE));
  document.getElementById('backBtn')?.addEventListener('click', () => history.back());
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  document.getElementById('refreshBtn')?.addEventListener('click', loadAll);
  const search = document.getElementById('globalSearch');
  if (search) {
    const runSearch = () => {
      state.searchText = search.value;
      clearTimeout(bindShell._searchTimer);
      bindShell._searchTimer = setTimeout(() => render(), 220);
    };
    search.addEventListener('input', runSearch);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const result = performGlobalSearch(search.value);
        state.searchText = search.value;
        if (!result) return toast('لا توجد نتائج مطابقة');
        state.selected = {
          ...state.selected,
          orderId: result.type === 'order-detail' ? result.id : state.selected.orderId,
          customerId: result.type === 'customer-detail' ? result.id : state.selected.customerId,
          repId: result.type === 'rep-detail' ? result.id : state.selected.repId,
          companyId: result.type === 'company-detail' ? result.id : state.selected.companyId,
          productId: result.type === 'product-detail' ? result.id : state.selected.productId,
          tierName: state.selected.tierName,
          dealId: state.selected.dealId,
          flashId: state.selected.flashId,
        };
        navigate(result.type);
      }
    });
  }
  document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    state.searchText = '';
    const search = document.getElementById('globalSearch');
    if (search) search.value = '';
    render();
  });
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
    if (action === 'open-direct-orders') { state.filters.orderType = 'direct'; navigate('orders'); return; }
    if (action === 'open-rep-orders') { state.filters.orderType = 'rep'; navigate('orders'); return; }
    if (action === 'open-direct-customers') { state.filters.customerView = 'direct'; navigate('customers'); return; }
    if (action === 'open-rep-customers') { state.filters.customerView = 'rep'; navigate('customers'); return; }
    try {
      if (action === 'select-order') { state.selected.orderId = target.getAttribute('data-id'); navigate('order-detail'); return; }
      if (action === 'save-order-status') { await updateOrderStatus(target.getAttribute('data-id')); return; }
      if (action === 'delete-order') { await deleteOrder(target.getAttribute('data-id')); return; }
      if (action === 'copy-invoice') { await copyInvoice(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-customer') { state.forms.addCustomer = !state.forms.addCustomer; render(); return; }
      if (action === 'cancel-add-customer') { state.forms.addCustomer = false; render(); return; }
      if (action === 'select-customer') { state.selected.customerId = target.getAttribute('data-id'); navigate('customer-detail'); return; }
      if (action === 'save-customer') { await saveCustomer(null); return; }
      if (action === 'save-customer-edit') { await saveCustomer(target.getAttribute('data-id')); return; }
      if (action === 'toggle-customer') { await toggleCustomer(target.getAttribute('data-id')); return; }
      if (action === 'delete-customer') { await deleteCustomer(target.getAttribute('data-id')); return; }
      if (action === 'link-customer-to-rep') { await linkCustomerToRep(target.getAttribute('data-id')); return; }
      if (action === 'unlink-customer-from-rep') { await unlinkCustomerFromRep(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-rep') { state.forms.addRep = !state.forms.addRep; render(); return; }
      if (action === 'cancel-add-rep') { state.forms.addRep = false; render(); return; }
      if (action === 'select-rep') { state.selected.repId = target.getAttribute('data-id'); navigate('rep-detail'); return; }
      if (action === 'save-rep') { await saveRep(null); return; }
      if (action === 'save-rep-edit') { await saveRep(target.getAttribute('data-id')); return; }
      if (action === 'delete-rep') { await deleteRep(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-company') { state.forms.addCompany = !state.forms.addCompany; render(); return; }
      if (action === 'cancel-add-company') { state.forms.addCompany = false; render(); return; }
      if (action === 'select-company') { state.selected.companyId = target.getAttribute('data-id'); navigate('company-detail'); return; }
      if (action === 'save-company') { await saveCompany(null); return; }
      if (action === 'save-company-edit') { await saveCompany(target.getAttribute('data-id')); return; }
      if (action === 'delete-company') { await deleteCompany(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-product') { state.forms.addProduct = !state.forms.addProduct; render(); return; }
      if (action === 'cancel-add-product') { state.forms.addProduct = false; render(); return; }
      if (action === 'select-product') { state.selected.productId = target.getAttribute('data-id'); navigate('product-detail'); return; }
      if (action === 'save-product') { await saveProduct(null); return; }
      if (action === 'save-product-edit') { await saveProduct(target.getAttribute('data-id')); return; }
      if (action === 'delete-product') { await deleteProduct(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-tier') { state.forms.addTier = !state.forms.addTier; render(); return; }
      if (action === 'cancel-add-tier') { state.forms.addTier = false; render(); return; }
      if (action === 'select-tier') { state.selected.tierName = target.getAttribute('data-id'); navigate('tier-detail'); return; }
      if (action === 'save-tier') { await saveTier(null); return; }
      if (action === 'save-tier-edit') { await saveTier(target.getAttribute('data-id')); return; }
      if (action === 'delete-tier') { await deleteTier(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-deal') { state.forms.addDeal = !state.forms.addDeal; render(); return; }
      if (action === 'cancel-add-deal') { state.forms.addDeal = false; render(); return; }
      if (action === 'select-deal') { state.selected.dealId = target.getAttribute('data-id'); navigate('deal-detail'); return; }
      if (action === 'save-deal') { await saveDeal(null); return; }
      if (action === 'save-deal-edit') { await saveDeal(target.getAttribute('data-id')); return; }
      if (action === 'delete-deal') { await deleteDeal(target.getAttribute('data-id')); return; }
      if (action === 'toggle-add-flash') { state.forms.addFlash = !state.forms.addFlash; render(); return; }
      if (action === 'cancel-add-flash') { state.forms.addFlash = false; render(); return; }
      if (action === 'select-flash') { state.selected.flashId = target.getAttribute('data-id'); navigate('flash-detail'); return; }
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
    if (target.id === 'customerSearch') { state.filters.q = target.value; clearTimeout(bindPageEvents._searchTimer); bindPageEvents._searchTimer = setTimeout(render, 180); return; }
    if (target.id === 'productSearch') { state.filters.q = target.value; clearTimeout(bindPageEvents._searchTimer); bindPageEvents._searchTimer = setTimeout(render, 180); return; }
    if (target.id === 'reportFrom' || target.id === 'reportTo') { state.filters[target.id === 'reportFrom' ? 'from' : 'to'] = target.value; return; }
  };
  document.removeEventListener('change', bindPageEvents._change);
  bindPageEvents._change = onChange;
  document.addEventListener('change', onChange);

  const onInput = (event) => {
    const target = event.target;
    if (target.id === 'orderSearch') { state.filters.q = target.value; clearTimeout(bindPageEvents._searchTimer); bindPageEvents._searchTimer = setTimeout(render, 180); }
    if (target.id === 'customerSearch') { state.filters.q = target.value; clearTimeout(bindPageEvents._searchTimer); bindPageEvents._searchTimer = setTimeout(render, 180); }
    if (target.id === 'productSearch') { state.filters.q = target.value; clearTimeout(bindPageEvents._searchTimer); bindPageEvents._searchTimer = setTimeout(render, 180); }
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
  if (row && row.price !== undefined && row.price !== null) return row.price;
  const product = productById(productId);
  if (table === 'prices_carton') return product?.carton_price ?? '';
  if (table === 'prices_pack') return product?.pack_price ?? '';
  return '';
}

async function upsertPrice(table, productId, price) {
  const payload = { product_id: productId, tier_name: 'base', price: Number(price || 0), visible: true };
  const existing = await apiGet(table, { select: 'id,product_id,tier_name', product_id: `eq.${productId}`, tier_name: 'eq.base' }).catch(() => []);
  if (existing && existing.length) {
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
}

async function handleGlobalClick(event) {
  const target = event.target.closest('[data-action], [data-page]');
  if (!target) return;
  const page = target.getAttribute('data-page');
  const action = target.getAttribute('data-action');
  if (page) { navigate(page); return; }
  if (action === 'open-direct-orders') { state.filters.orderType='direct'; navigate('orders'); return; }
  if (action === 'open-rep-orders') { state.filters.orderType='rep'; navigate('orders'); return; }
  if (action === 'open-direct-customers') { state.filters.customerView='direct'; navigate('customers'); return; }
  if (action === 'open-rep-customers') { state.filters.customerView='rep'; navigate('customers'); return; }
  try {
    if (action === 'login') return attemptLogin();
    if (action === 'logout') return logout();
    if (action === 'go-home') return navigate(DEFAULT_PAGE);
    if (action === 'go-back') return history.back();
    if (action === 'select-order') { state.selected.orderId = target.getAttribute('data-id'); navigate('order-detail'); return; }
    if (action === 'set-order-type') { state.filters.orderType = target.getAttribute('data-value') || 'all'; render(); return; }
    if (action === 'clear-order-filters') { state.filters.orderType = 'all'; state.filters.status = 'all'; state.filters.q = ''; render(); return; }
    if (action === 'select-customer') { state.selected.customerId = target.getAttribute('data-id'); navigate('customer-detail'); return; }
    if (action === 'select-rep') { state.selected.repId = target.getAttribute('data-id'); navigate('rep-detail'); return; }
    if (action === 'select-company') { state.selected.companyId = target.getAttribute('data-id'); navigate('company-detail'); return; }
    if (action === 'select-product') { state.selected.productId = target.getAttribute('data-id'); navigate('product-detail'); return; }
    if (action === 'select-tier') { state.selected.tierName = target.getAttribute('data-id'); navigate('tier-detail'); return; }
    if (action === 'select-deal') { state.selected.dealId = target.getAttribute('data-id'); navigate('deal-detail'); return; }
    if (action === 'select-flash') { state.selected.flashId = target.getAttribute('data-id'); navigate('flash-detail'); return; }
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
