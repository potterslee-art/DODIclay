import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import type { Product, Order, StudioSettings, OrderStatus, ShippingMethod } from './src/types.ts';

dotenv.config();

const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clay1234';

// In-memory token store for admin session validation
const validAdminTokens = new Set<string>();

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

interface StoreData {
  products: Product[];
  orders: Order[];
  settings: StudioSettings;
}

function getNextWednesday(from: Date = new Date()): string {
  const d = new Date(from);
  const day = d.getDay(); // 0 = Sun, 3 = Wed
  let diff = 3 - day;
  // If it's Wednesday afternoon or later, schedule for next Wednesday
  if (diff <= 0) {
    diff += 7;
  }
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}년 ${mm}월 ${dd}일 (수)`;
}

function getDefaultStore(): StoreData {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const scheduledDate = getNextWednesday(now);

  return {
    products: [
      {
        id: 'clay',
        name: '점토',
        price: 24000,
        capacity: '20L',
        weight: '약 19kg',
        isAvailable: true,
        description: '도예 작업실 및 대학 실기실용 고품질 조합 점토 (소성온도 1240~1280℃)',
        tags: ['작업용', '물레 성형', '손성형'],
      },
      {
        id: 'slip',
        name: '슬립',
        price: 30000,
        capacity: '20L',
        weight: '약 19kg',
        isAvailable: true,
        description: '석고 몰드 주입 성형(캐스팅) 및 기물 부착용 고균일 액상 백자 슬립',
        tags: ['캐스팅용', '석고 몰드 주입', '접합용'],
      },
    ],
    settings: {
      studioName: '도디[DODI] 도예재료 보급소',
      bankName: '농협은행',
      accountNumber: '302-1234-5678-91',
      accountHolder: '도디공방(DODI)',
      shippingNotice: '택배 및 운송은 매주 수요일입니다.',
      studioPhone: '010-8921-4500',
    },
    orders: [
      {
        orderId: 'POT-260908-1042',
        customerName: '이서윤',
        phoneNumber: '010-3456-7890',
        address: '서울시 마포구 와우산로 94 홍익대학교 조형관 402호',
        productId: 'clay',
        product: '점토',
        quantity: 2,
        unitPrice: 24000,
        productPrice: 48000,
        shippingMethod: '택배',
        shippingFee: 13200,
        totalPrice: 61200,
        shippingScheduledDate: scheduledDate,
        status: '입금 완료',
        orderDate: `${dateStr} 10:25`,
        updatedAt: `${dateStr} 11:40`,
      },
      {
        orderId: 'POT-260907-3918',
        customerName: '박준혁',
        phoneNumber: '010-9876-5432',
        address: '경기도 이천시 신둔면 도자예술로 62 백자스튜디오',
        productId: 'slip',
        product: '슬립',
        quantity: 1,
        unitPrice: 30000,
        productPrice: 30000,
        shippingMethod: '택배',
        shippingFee: 6600,
        totalPrice: 36600,
        shippingScheduledDate: scheduledDate,
        status: '택배 발송',
        courierName: '경동택배',
        trackingNumber: '70182940192',
        orderDate: `${dateStr} 09:12`,
        updatedAt: `${dateStr} 14:30`,
      },
      {
        orderId: 'POT-260905-8812',
        customerName: '최유진',
        phoneNumber: '010-5544-3322',
        address: '대전광역시 유성구 대학로 99 충남대학교 예술대학 도예전공',
        productId: 'clay',
        product: '점토',
        quantity: 3,
        unitPrice: 24000,
        productPrice: 72000,
        shippingMethod: '택배',
        shippingFee: 19800,
        totalPrice: 91800,
        shippingScheduledDate: '2026년 09월 09일 (수)',
        status: '도착 완료',
        courierName: '경동택배',
        trackingNumber: '68291048201',
        orderDate: '2026-09-05 15:40',
        updatedAt: '2026-09-09 17:10',
      },
    ],
  };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const data: StoreData = JSON.parse(raw);
      // Ensure all orders have shippingMethod and shippingFee
      if (data && Array.isArray(data.orders)) {
        let changed = false;
        data.orders = data.orders.map((o: any) => {
          const method: ShippingMethod = (o.shippingMethod === '화물' || o.shippingMethod === '직접수령')
            ? o.shippingMethod
            : '택배';
          const pPrice = o.productPrice || (o.unitPrice * o.quantity);
          const fee = o.shippingFee !== undefined
            ? o.shippingFee
            : (method === '택배' ? (o.quantity || 1) * 6600 : 0);
          const total = o.totalPrice || (pPrice + fee);
          if (!o.shippingMethod || o.shippingFee === undefined || !o.productPrice) {
            changed = true;
          }
          return {
            ...o,
            shippingMethod: method,
            shippingFee: fee,
            productPrice: pPrice,
            totalPrice: total,
          };
        });
        if (changed) {
          saveStore(data);
        }
      }
      return data;
    }
  } catch (err) {
    console.error('Error reading store file, initializing default:', err);
  }
  const initial = getDefaultStore();
  saveStore(initial);
  return initial;
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store file:', err);
  }
}

let store = loadStore();

function generateOrderId(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `POT-${yy}${mm}${dd}-${rand}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Middleware to authenticate admin requests
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '관리자 인증이 필요합니다.' });
      return;
    }
    const token = authHeader.substring(7);
    if (!validAdminTokens.has(token)) {
      res.status(401).json({ error: '인증 세션이 만료되었거나 올바르지 않습니다.' });
      return;
    }
    next();
  };

  // ----------------------------------------------------
  // PUBLIC APIS
  // ----------------------------------------------------

  // 1. Get products list and availability
  app.get('/api/products', (_req, res) => {
    res.json({ products: store.products });
  });

  // 2. Get studio settings (bank account info, shipping notice)
  app.get('/api/settings', (_req, res) => {
    const nextWednesday = getNextWednesday();
    res.json({
      settings: store.settings,
      nextShippingDate: nextWednesday,
    });
  });

  // 3. Create a new order (Customer)
  app.post('/api/orders', (req, res) => {
    const { productId, quantity, customerName, phoneNumber, address, shippingMethod } = req.body;

    const chosenMethod: ShippingMethod = (shippingMethod === '화물' || shippingMethod === '직접수령')
      ? shippingMethod
      : '택배';

    const effectiveAddress = (chosenMethod === '직접수령' && (!address || !address.trim()))
      ? '도디 공방 직접 방문 수령'
      : (address ? address.trim() : '');

    if (!productId || !quantity || !customerName || !phoneNumber || !effectiveAddress) {
      res.status(400).json({ error: '모든 주문 필수 정보를 입력해주세요.' });
      return;
    }

    const product = store.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: '선택한 상품을 찾을 수 없습니다.' });
      return;
    }

    if (!product.isAvailable) {
      res.status(400).json({ error: `현재 [${product.name}] 상품은 주문 마감 상태입니다.` });
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      res.status(400).json({ error: '수량은 1개 이상이어야 합니다.' });
      return;
    }

    const productPrice = product.price * qtyNum;
    // 택배일 경우 1개당 6,600원 / 화물: 별도문의(0원) / 직접수령: 후불(0원)
    const shippingFee = chosenMethod === '택배' ? qtyNum * 6600 : 0;
    const totalPrice = productPrice + shippingFee;

    const now = new Date();
    const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newOrder: Order = {
      orderId: generateOrderId(),
      customerName: customerName.trim(),
      phoneNumber: phoneNumber.trim(),
      address: effectiveAddress,
      productId: product.id,
      product: product.name,
      quantity: qtyNum,
      unitPrice: product.price,
      productPrice,
      shippingMethod: chosenMethod,
      shippingFee,
      totalPrice,
      shippingScheduledDate: chosenMethod === '직접수령' ? '공방 방문 수령 (협의)' : getNextWednesday(now),
      status: '입금 대기', // Initial status is strictly "입금 대기"
      orderDate: dateFormatted,
    };

    // Prepend to orders list
    store.orders.unshift(newOrder);
    saveStore(store);

    res.status(201).json({
      success: true,
      message: '주문이 성공적으로 접수되었습니다.',
      order: newOrder,
    });
  });

  // 4. Get order details by orderId (Customer)
  app.get('/api/orders/:orderId', (req, res) => {
    const order = store.orders.find((o) => o.orderId.toUpperCase() === req.params.orderId.toUpperCase());
    if (!order) {
      res.status(404).json({ error: '주문 내역을 찾을 수 없습니다.' });
      return;
    }
    res.json({ order });
  });

  // 5. Look up orders by phone number or order id (Customer lookup)
  app.get('/api/orders-lookup', (req, res) => {
    const query = (req.query.q as string || '').trim().replace(/[^0-9a-zA-Z-]/g, '');
    if (!query) {
      res.json({ orders: [] });
      return;
    }

    const sanitizedDigits = query.replace(/[^0-9]/g, '');
    const matched = store.orders.filter((o) => {
      const orderCleanDigits = o.phoneNumber.replace(/[^0-9]/g, '');
      const orderIdUpper = o.orderId.toUpperCase();
      const queryUpper = query.toUpperCase();

      const phoneMatch = sanitizedDigits.length >= 4 && orderCleanDigits.includes(sanitizedDigits);
      const idMatch = orderIdUpper.includes(queryUpper);

      return phoneMatch || idMatch;
    });

    res.json({ orders: matched });
  });

  // ----------------------------------------------------
  // ADMIN AUTHENTICATION
  // ----------------------------------------------------

  // Admin login
  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: '비밀번호를 입력해주세요.' });
      return;
    }

    if (password === ADMIN_PASSWORD) {
      const token = crypto.randomBytes(24).toString('hex');
      validAdminTokens.add(token);
      res.json({
        success: true,
        token,
        message: '관리자 인증에 성공하였습니다.',
      });
    } else {
      res.status(401).json({ error: '관리자 비밀번호가 일치하지 않습니다.' });
    }
  });

  // Verify admin token
  app.get('/api/admin/check', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (validAdminTokens.has(token)) {
        res.json({ valid: true });
        return;
      }
    }
    res.json({ valid: false });
  });

  // Admin logout
  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      validAdminTokens.delete(token);
    }
    res.json({ success: true });
  });

  // ----------------------------------------------------
  // ADMIN PROTECTED APIS
  // ----------------------------------------------------

  // 1. Get all orders with optional status filter
  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    const status = req.query.status as string;
    let list = store.orders;
    if (status && status !== '전체') {
      list = list.filter((o) => o.status === status);
    }
    res.json({ orders: list });
  });

  // 2. Direct status change & tracking number update
  app.patch('/api/admin/orders/:orderId/status', requireAdmin, (req, res) => {
    const { orderId } = req.params;
    const { status, courierName, trackingNumber } = req.body;

    const allowedStatuses: OrderStatus[] = ['입금 대기', '입금 완료', '택배 발송', '도착 완료'];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400).json({ error: '유효하지 않은 주문 상태입니다.' });
      return;
    }

    const orderIndex = store.orders.findIndex((o) => o.orderId.toUpperCase() === orderId.toUpperCase());
    if (orderIndex === -1) {
      res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      return;
    }

    const now = new Date();
    const updatedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (status) {
      store.orders[orderIndex].status = status;
    }
    if (courierName !== undefined) {
      store.orders[orderIndex].courierName = courierName.trim();
    }
    if (trackingNumber !== undefined) {
      store.orders[orderIndex].trackingNumber = trackingNumber.trim();
    }
    store.orders[orderIndex].updatedAt = updatedTime;

    saveStore(store);

    res.json({
      success: true,
      message: '주문 정보가 변경되었습니다.',
      order: store.orders[orderIndex],
    });
  });

  // 3. Toggle product availability (주문 가능 / 주문 마감) or update price
  app.patch('/api/admin/products/:productId/availability', requireAdmin, (req, res) => {
    const { productId } = req.params;
    const { isAvailable, price } = req.body;

    const product = store.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }

    if (typeof isAvailable === 'boolean') {
      product.isAvailable = isAvailable;
    }
    if (typeof price === 'number' && price > 0) {
      product.price = price;
    }

    saveStore(store);

    res.json({
      success: true,
      message: `[${product.name}] 상태가 변경되었습니다.`,
      product,
    });
  });

  // 4. Update studio settings (bank account info, google sheet info, etc.)
  app.patch('/api/admin/settings', requireAdmin, (req, res) => {
    const {
      bankName,
      accountNumber,
      accountHolder,
      shippingNotice,
      studioName,
      studioPhone,
      googleSheetId,
      googleSheetUrl,
      googleSheetName,
      lastSyncedAt,
      autoSyncEnabled,
    } = req.body;

    if (bankName !== undefined) store.settings.bankName = bankName.trim();
    if (accountNumber !== undefined) store.settings.accountNumber = accountNumber.trim();
    if (accountHolder !== undefined) store.settings.accountHolder = accountHolder.trim();
    if (shippingNotice !== undefined) store.settings.shippingNotice = shippingNotice.trim();
    if (studioName !== undefined) store.settings.studioName = studioName.trim();
    if (studioPhone !== undefined) store.settings.studioPhone = studioPhone.trim();
    if (googleSheetId !== undefined) store.settings.googleSheetId = googleSheetId ? googleSheetId.trim() : '';
    if (googleSheetUrl !== undefined) store.settings.googleSheetUrl = googleSheetUrl ? googleSheetUrl.trim() : '';
    if (googleSheetName !== undefined) store.settings.googleSheetName = googleSheetName ? googleSheetName.trim() : '';
    if (lastSyncedAt !== undefined) store.settings.lastSyncedAt = lastSyncedAt;
    if (typeof autoSyncEnabled === 'boolean') store.settings.autoSyncEnabled = autoSyncEnabled;

    saveStore(store);

    res.json({
      success: true,
      message: '공방 설정 및 구글 시트 연동 정보가 저장되었습니다.',
      settings: store.settings,
    });
  });

  // 5. Import / Sync orders from Google Sheet into server store
  app.post('/api/admin/sync-orders-from-sheet', requireAdmin, (req, res) => {
    const { orders: importedOrders } = req.body;
    if (!Array.isArray(importedOrders)) {
      res.status(400).json({ error: '올바른 주문 목록 데이터가 아닙니다.' });
      return;
    }

    // Merge or replace orders by orderId
    let updatedCount = 0;
    let addedCount = 0;

    for (const imp of importedOrders as Order[]) {
      if (!imp.orderId) continue;
      const idx = store.orders.findIndex((o) => o.orderId.toUpperCase() === imp.orderId.toUpperCase());
      if (idx >= 0) {
        store.orders[idx] = { ...store.orders[idx], ...imp };
        updatedCount++;
      } else {
        store.orders.unshift(imp);
        addedCount++;
      }
    }

    const now = new Date();
    store.settings.lastSyncedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    saveStore(store);

    res.json({
      success: true,
      message: `구글 시트에서 총 ${importedOrders.length}건을 동기화했습니다. (신규: ${addedCount}건, 갱신: ${updatedCount}건)`,
      orders: store.orders,
      lastSyncedAt: store.settings.lastSyncedAt,
    });
  });

  // ----------------------------------------------------
  // VITE DEV MIDDLEWARE / STATIC ASSETS
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`도예 재료 주문 앱 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

startServer();
