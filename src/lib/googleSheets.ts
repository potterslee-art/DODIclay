import type { Order, OrderStatus, ShippingMethod } from '../types.ts';

export const SHEET_TAB_NAME = '주문내역';

export const SHEET_HEADERS = [
  '주문번호',
  '주문일시',
  '주문자명',
  '연락처',
  '상품명',
  '수량',
  '단가(원)',
  '상품금액(원)',
  '운송방법',
  '운송료(원)',
  '총입금액(원)',
  '배송지',
  '발송예정일',
  '진행상태',
  '택배/화물사',
  '송장번호',
  '최종수정일',
];

/**
 * Converts an Order object to a row array for Google Sheets
 */
export function orderToRow(order: Order): (string | number)[] {
  const method: ShippingMethod = order.shippingMethod || '택배';
  const unitPrice = order.unitPrice || (order.productId === 'slip' || order.product.includes('슬립') ? 30000 : 24000);
  const productPrice = order.productPrice || (unitPrice * order.quantity);
  const feeDisplay = method === '택배' 
    ? (order.shippingFee !== undefined ? order.shippingFee : order.quantity * 6600)
    : method === '화물' ? '별도문의' : 0;
  const totalPrice = order.totalPrice || (productPrice + (typeof feeDisplay === 'number' ? feeDisplay : 0));

  return [
    order.orderId,
    order.orderDate,
    order.customerName,
    order.phoneNumber,
    order.product,
    order.quantity,
    unitPrice,
    productPrice,
    method,
    feeDisplay,
    totalPrice,
    order.address,
    order.shippingScheduledDate,
    order.status,
    order.courierName || '',
    order.trackingNumber || '',
    order.updatedAt || order.orderDate,
  ];
}

/**
 * Converts a row array from Google Sheets back into an Order object
 * Supports both new 17-column format (with shipping details) and legacy 14-column format.
 */
export function rowToOrder(row: any[]): Order | null {
  if (!row || row.length < 5 || !row[0]) return null;

  const orderId = String(row[0]).trim();
  if (!orderId || orderId === '주문번호') return null;

  const orderDate = String(row[1] || '').trim();
  const customerName = String(row[2] || '').trim();
  const phoneNumber = String(row[3] || '').trim();
  const product = String(row[4] || '점토').trim();
  const quantity = parseInt(row[5], 10) || 1;
  const unitPrice = parseInt(row[6], 10) || (product.includes('슬립') ? 30000 : 24000);

  // Check if row matches the 17-column layout (운송방법 present at row[8])
  const col8Str = String(row[8] || '').trim();
  const isNewLayout = col8Str === '택배' || col8Str === '화물' || col8Str === '직접수령' || row.length >= 15;

  let productPrice = unitPrice * quantity;
  let shippingMethod: ShippingMethod = '택배';
  let shippingFee = quantity * 6600;
  let totalPrice = productPrice + shippingFee;
  let address = '';
  let shippingScheduledDate = '';
  let rawStatus = '';
  let courierName: string | undefined;
  let trackingNumber: string | undefined;
  let updatedAt: string | undefined;

  if (isNewLayout) {
    productPrice = parseInt(row[7], 10) || (unitPrice * quantity);
    shippingMethod = (col8Str === '화물' || col8Str === '직접수령') ? col8Str : '택배';
    shippingFee = shippingMethod === '택배' ? (parseInt(row[9], 10) || quantity * 6600) : 0;
    totalPrice = parseInt(row[10], 10) || (productPrice + shippingFee);
    address = String(row[11] || '').trim();
    shippingScheduledDate = String(row[12] || '').trim();
    rawStatus = String(row[13] || '').trim();
    courierName = row[14] ? String(row[14]).trim() : undefined;
    trackingNumber = row[15] ? String(row[15]).trim() : undefined;
    updatedAt = row[16] ? String(row[16]).trim() : undefined;
  } else {
    // Legacy 14-column format
    totalPrice = parseInt(row[7], 10) || unitPrice * quantity;
    productPrice = unitPrice * quantity;
    shippingMethod = '택배';
    shippingFee = totalPrice > productPrice ? totalPrice - productPrice : 0;
    address = String(row[8] || '').trim();
    shippingScheduledDate = String(row[9] || '').trim();
    rawStatus = String(row[10] || '').trim();
    courierName = row[11] ? String(row[11]).trim() : undefined;
    trackingNumber = row[12] ? String(row[12]).trim() : undefined;
    updatedAt = row[13] ? String(row[13]).trim() : undefined;
  }

  let status: OrderStatus = '입금 대기';
  if (['입금 대기', '입금 완료', '택배 발송', '도착 완료'].includes(rawStatus)) {
    status = rawStatus as OrderStatus;
  }

  return {
    orderId,
    orderDate,
    customerName,
    phoneNumber,
    address,
    productId: product.includes('슬립') ? 'slip' : 'clay',
    product,
    quantity,
    unitPrice,
    productPrice,
    shippingMethod,
    shippingFee,
    totalPrice,
    shippingScheduledDate,
    status,
    courierName,
    trackingNumber,
    updatedAt,
  };
}

/**
 * Creates a brand new Google Spreadsheet dedicated to pottery orders with formatted headers.
 */
export async function createPotteryOrderSpreadsheet(
  accessToken: string,
  title: string = '도디(DODI) 점토·슬립 주문 관리 대장'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const requestBody = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: SHEET_TAB_NAME,
          gridProperties: {
            frozenRowCount: 1,
            rowCount: 200,
            columnCount: 17,
          },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`구글 시트 생성 실패: ${errText}`);
  }

  const data = await createRes.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Apply initial header values and bold styling
  await initializeSheetHeader(accessToken, spreadsheetId);

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: data.properties?.title || title,
  };
}

/**
 * Initializes the header row in the spreadsheet and formats it
 */
export async function initializeSheetHeader(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string = SHEET_TAB_NAME
) {
  const cleanId = extractSpreadsheetId(spreadsheetId);

  // 1. Write Header row
  const valueRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
      sheetName
    )}!A1:Q1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [SHEET_HEADERS],
      }),
    }
  );

  if (!valueRes.ok) {
    // If sheetName doesn't exist, write to first sheet
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/A1:Q1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [SHEET_HEADERS],
        }),
      }
    );
  }

  // 2. Format header row styling (Terracotta/Warm Clay #8A502E background, white bold text, freeze top row)
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const targetSheet = (meta.sheets || []).find((s: any) => s.properties?.title === sheetName) || meta.sheets?.[0];
      const sheetId = targetSheet?.properties?.sheetId ?? 0;

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: SHEET_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.54, green: 0.31, blue: 0.18 }, // #8A502E
                    textFormat: {
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      bold: true,
                      fontSize: 10,
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        }),
      });
    }
  } catch (err) {
    console.warn('Could not apply custom header style, basic headers set:', err);
  }
}

/**
 * Validates access to a spreadsheet and returns its title and first sheet name
 */
export async function getSpreadsheetInfo(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; sheetName: string; spreadsheetUrl: string }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error('구글 시트에 접근할 수 없습니다. 시트 ID 또는 권한을 확인해주세요.');
  }

  const data = await res.json();
  const firstSheetName = data.sheets?.[0]?.properties?.title || SHEET_TAB_NAME;

  return {
    title: data.properties?.title || '스프레드시트',
    sheetName: firstSheetName,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
  };
}

/**
 * Extracts spreadsheet ID from either a full Google Sheets URL or raw ID
 */
export function extractSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Syncs all orders to the Google Sheet (Writes headers + all orders)
 */
export async function syncAllOrdersToSheet(
  accessToken: string,
  spreadsheetId: string,
  orders: Order[],
  sheetName: string = SHEET_TAB_NAME
): Promise<{ count: number }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);

  // Prepare 2D values array
  const rows = [SHEET_HEADERS, ...orders.map(orderToRow)];

  // Clear existing values in sheet
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
        sheetName
      )}!A1:Q200:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch {
    // ignore clear failure
  }

  // Put new values
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
      sheetName
    )}!A1:Q${rows.length}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`동기화 실패: ${err}`);
  }

  // Ensure header styling and frozen row are preserved
  try {
    await initializeSheetHeader(accessToken, cleanId, sheetName);
  } catch (err) {
    console.warn('Non-fatal: could not re-format header style during sync', err);
  }

  return { count: orders.length };
}

/**
 * Appends a new order to the connected Google Sheet
 */
export async function appendOrderToSheet(
  accessToken: string,
  spreadsheetId: string,
  order: Order,
  sheetName: string = SHEET_TAB_NAME
): Promise<boolean> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);
    const row = orderToRow(order);

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
        sheetName
      )}!A:Q:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [row],
        }),
      }
    );

    return res.ok;
  } catch (err) {
    console.error('Error appending order to sheet:', err);
    return false;
  }
}

/**
 * Updates an existing order row in the Google Sheet, or appends it if not found.
 */
export async function updateOrderRowInSheet(
  accessToken: string,
  spreadsheetId: string,
  order: Order,
  sheetName: string = SHEET_TAB_NAME
): Promise<boolean> {
  try {
    const cleanId = extractSpreadsheetId(spreadsheetId);

    // 1. Fetch column A (Order IDs) to find matching row
    const colRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
        sheetName
      )}!A:A`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!colRes.ok) {
      // Fallback to append
      return await appendOrderToSheet(accessToken, cleanId, order, sheetName);
    }

    const colData = await colRes.json();
    const values: string[][] = colData.values || [];

    let rowIndex = -1;
    for (let i = 0; i < values.length; i++) {
      if (values[i] && String(values[i][0]).trim().toUpperCase() === order.orderId.toUpperCase()) {
        rowIndex = i + 1; // 1-based index
        break;
      }
    }

    if (rowIndex > 0) {
      // Row found: update specific row A{rowIndex}:Q{rowIndex}
      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
          sheetName
        )}!A${rowIndex}:Q${rowIndex}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [orderToRow(order)],
          }),
        }
      );
      return updateRes.ok;
    } else {
      // Not found, append
      return await appendOrderToSheet(accessToken, cleanId, order, sheetName);
    }
  } catch (err) {
    console.error('Error updating order row in sheet:', err);
    return false;
  }
}

/**
 * Reads all rows from Google Sheet and parses them into Orders list
 */
export async function fetchOrdersFromSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string = SHEET_TAB_NAME
): Promise<Order[]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
      sheetName
    )}!A2:Q`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    throw new Error('구글 시트에서 주문 목록을 가져오지 못했습니다.');
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  const parsedOrders: Order[] = [];
  for (const row of rows) {
    const order = rowToOrder(row);
    if (order) {
      parsedOrders.push(order);
    }
  }

  return parsedOrders;
}
