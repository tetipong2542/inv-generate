import { Hono } from 'hono';
import path from 'path';
import { readdir, mkdir } from 'fs/promises';

const app = new Hono();

// Session storage for multi-step customer creation
const sessions: Map<string, { step: string; data: any }> = new Map();

// AI Chat endpoint
app.post('/', async (c) => {
  const { message, context, sessionId } = await c.req.json();

  if (!message) {
    return c.json({ success: false, error: 'กรุณาพิมพ์ข้อความ' }, 400);
  }

  // Check for cancel command
  if (message.toLowerCase().includes('ยกเลิก') || message.toLowerCase() === 'cancel') {
    if (sessionId) {
      sessions.delete(sessionId);
    }
    return c.json({ 
      success: true, 
      data: { message: 'ยกเลิกเรียบร้อยแล้ว' }
    });
  }

  const session = sessionId ? sessions.get(sessionId) : null;

  try {
    let result;

    // Check if we're in a multi-step flow
    if (session?.step === 'awaiting_customer_data') {
      result = await processCustomerData(message, session.data);
      
      if (result.completed) {
        sessions.delete(sessionId);
      } else if (result.nextStep) {
        sessions.set(sessionId, { step: result.nextStep, data: result.data });
      }
    } else {
      // Parse intent from message
      const intent = parseIntent(message);
      result = await handleIntent(intent, message);
      
      if (result.sessionId && result.step) {
        sessions.set(result.sessionId, { step: result.step, data: result.data });
      }
    }

    return c.json({ 
      success: true, 
      data: {
        message: result.response || result.message,
        action: result.action,
        customerData: result.customerData,
        itemData: result.itemData,
        sessionId: result.sessionId || (result.completed ? undefined : sessionId)
      }
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown'}` 
    }, 500);
  }
});

async function handleIntent(intent: { action: string; data?: any }, originalMessage: string) {
  switch (intent.action) {
    case 'list_customers':
      return { response: await listCustomers() };
    case 'list_documents':
      return { response: await listDocuments() };
    case 'create_customer':
      return await initiateCustomerCreation(intent.data, originalMessage);
    case 'add_item':
      return await handleAddItem(intent.data);
    case 'create_document':
      return { response: await createDocument(intent.data) };
    case 'delete_customer':
      return { response: await deleteCustomer(intent.data?.id) };
    case 'delete_document':
      return { response: await deleteDocument(intent.data?.id) };
    case 'help':
      return { response: getHelpMessage() };
    default:
      return { response: getDefaultResponse(originalMessage) };
  }
}

// Parse user intent from Thai/English message
function parseIntent(message: string): { action: string; data?: any } {
  const msg = message.toLowerCase();

  // List commands
  if (msg.includes('รายชื่อลูกค้า') || msg.includes('ลูกค้าทั้งหมด') || msg.includes('list customer')) {
    return { action: 'list_customers' };
  }
  if (msg.includes('รายการเอกสาร') || msg.includes('เอกสารทั้งหมด') || msg.includes('list document')) {
    return { action: 'list_documents' };
  }

  // Create customer - use smart parser
  if (msg.includes('สร้างลูกค้า') || msg.includes('เพิ่มลูกค้า') || msg.includes('create customer') || msg.includes('add customer')) {
    const data = smartParseCustomerData(message);
    return { action: 'create_customer', data };
  }

  // Add line item to document
  if (msg.includes('เพิ่มรายการ') || msg.includes('add item') || msg.includes('เพิ่มสินค้า') || msg.includes('เพิ่มบริการ')) {
    const data = smartParseLineItem(message);
    return { action: 'add_item', data };
  }

  // Create document
  if (msg.includes('สร้างใบ') || msg.includes('สร้างเอกสาร') || msg.includes('create invoice') || msg.includes('create quotation') || msg.includes('create receipt')) {
    const data = extractDocumentData(message);
    return { action: 'create_document', data };
  }

  // Delete
  if (msg.includes('ลบลูกค้า') || msg.includes('delete customer')) {
    const id = extractId(message);
    return { action: 'delete_customer', data: { id } };
  }
  if (msg.includes('ลบเอกสาร') || msg.includes('delete document')) {
    const id = extractId(message);
    return { action: 'delete_document', data: { id } };
  }

  // Help
  if (msg.includes('ช่วย') || msg.includes('help') || msg.includes('คำสั่ง') || msg.includes('command')) {
    return { action: 'help' };
  }

  return { action: 'unknown' };
}

/**
 * Smart Parser - ตรวจจับข้อมูลลูกค้าจากข้อความธรรมชาติ
 * รองรับหลายรูปแบบ:
 * - "สร้างลูกค้า สุขทุกคำ จำกัด(สำนักงานใหญ่)เลขที่ 1 ซอยราษฎร์บูรณะ..."
 * - "สร้างลูกค้า ชื่อ: xxx ที่อยู่: xxx taxId: xxx"
 * - "สร้างลูกค้า บริษัท ABC 123 ถ.สุขุมวิท เลขภาษี 1234567890123"
 */
function smartParseCustomerData(message: string): any {
  // Remove command prefix
  let text = message
    .replace(/^(สร้างลูกค้า|เพิ่มลูกค้า|create customer|add customer)\s*/i, '')
    .trim();

  const data: any = {};

  // 1. Try to extract Tax ID first (most reliable pattern)
  const taxIdPatterns = [
    /เลขประจ[าํ]ต[ัว]ผู้เส[ีย]ภาษ[ีี]\s*[:\s]?\s*([0-9]{13})/i,
    /(?:taxid|tax\s*id|tax_id|เลขภาษี|เลขผู้เสียภาษี)\s*[:\s]?\s*([0-9-]+)/i,
    /([0-9]{13})(?=\s|$|[ก-๙a-z@])/i, // 13-digit number standalone
    /([0-9]{1}-[0-9]{4}-[0-9]{5}-[0-9]{2}-[0-9]{1})/i, // formatted tax id
  ];

  for (const pattern of taxIdPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.taxId = match[1].replace(/-/g, '').trim();
      // Remove from text for easier parsing
      text = text.replace(match[0], ' ').trim();
      break;
    }
  }

  // 2. Extract email (if present)
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    data.email = emailMatch[1];
    text = text.replace(emailMatch[0], ' ').trim();
  }

  // 3. Extract phone number
  const phonePatterns = [
    /(?:เบอร์|โทร|phone|tel)\s*[:\s]?\s*([0-9-]+)/i,
    /([0][0-9]{1,2}-[0-9]{3,4}-[0-9]{4})/i,
    /([0][0-9]{8,9})(?=\s|$)/i,
  ];

  for (const pattern of phonePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.phone = match[1].trim();
      text = text.replace(match[0], ' ').trim();
      break;
    }
  }

  // 4. Extract postal code and use it to identify address
  const postalMatch = text.match(/([0-9]{5})(?=\s|$)/);
  let postalCode = '';
  if (postalMatch) {
    postalCode = postalMatch[1];
  }

  // 5. Try to extract company name patterns
  const companyPatterns = [
    /(?:บริษัท|หจก\.|ห้างหุ้นส่วน)\s*([^\d]+?)(?:\s*จำกัด|\s*\(มหาชน\))?(?:\s*\(สำนักงานใหญ่\))?/i,
    /(?:company|corp|inc|ltd)\s*[:\s]?\s*([^0-9]+?)(?=\s+[0-9]|\s+เลข|\s+ที่อยู่|$)/i,
  ];

  for (const pattern of companyPatterns) {
    const match = text.match(pattern);
    if (match) {
      let company = match[0].trim();
      // Clean up company name
      if (company.includes('จำกัด')) {
        company = company.substring(0, company.indexOf('จำกัด') + 5);
        if (text.includes('(สำนักงานใหญ่)')) {
          company += '(สำนักงานใหญ่)';
        }
        if (text.includes('(มหาชน)')) {
          company += '(มหาชน)';
        }
      }
      data.company = company;
      break;
    }
  }

  // 6. Extract address - look for address patterns
  const addressPatterns = [
    // Thai address pattern with building number
    /(?:เลขที่\s*)?(\d+(?:\/\d+)?)\s*(ซอย|ซ\.|ถนน|ถ\.|หมู่|ม\.|แขวง|เขต|ตำบล|อำเภอ|จังหวัด)[^\d]*(?:\d{5})?/i,
    // Full address with postal code
    /(?:ที่อยู่\s*[:\s]?\s*)?(\d+(?:\/\d+)?\s+[ก-๙a-zA-Z\s,\.]+\s*\d{5})/i,
  ];

  // Try to find address by looking for district/subdistrict patterns
  const addressKeywords = ['แขวง', 'เขต', 'ตำบล', 'อำเภอ', 'จังหวัด', 'กรุงเทพ', 'กทม'];
  let addressStart = -1;
  let addressEnd = text.length;

  for (const keyword of addressKeywords) {
    const idx = text.indexOf(keyword);
    if (idx !== -1) {
      // Find the start of address (look for number before keyword)
      const beforeKeyword = text.substring(0, idx);
      const numMatch = beforeKeyword.match(/(?:เลขที่\s*)?(\d+(?:\/\d+)?)\s*[ก-๙a-zA-Z]/);
      if (numMatch) {
        const numIdx = beforeKeyword.lastIndexOf(numMatch[1]);
        if (numIdx !== -1 && (addressStart === -1 || numIdx < addressStart)) {
          addressStart = numIdx;
        }
      }
    }
  }

  // Find address end (postal code or end of relevant text)
  if (postalCode) {
    addressEnd = text.indexOf(postalCode) + 5;
  }

  if (addressStart !== -1) {
    let address = text.substring(addressStart, addressEnd).trim();
    // Clean up address
    address = address.replace(/\s+/g, ' ').trim();
    if (address.length > 10) {
      data.address = address;
    }
  }

  // 7. Extract name if explicitly provided
  const namePatterns = [
    /ชื่อ\s*[:\s]?\s*([ก-๙a-zA-Z\s]+?)(?=\s+บริษัท|\s+ที่อยู่|\s+เลข|\s+taxid|$)/i,
    /(?:คุณ|นาย|นาง|นางสาว|mr\.|mrs\.|ms\.)\s*([ก-๙a-zA-Z\s]+?)(?=\s+บริษัท|\s+ที่อยู่|\s+เลข|$)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.name = match[1].trim();
      break;
    }
  }

  // If no name but we have company, use company as name
  if (!data.name && data.company) {
    data.name = data.company;
  }

  // If we still don't have address, try simpler extraction
  if (!data.address && postalCode) {
    // Find text between company/name and postal code
    let startIdx = 0;
    if (data.company) {
      startIdx = text.indexOf(data.company) + data.company.length;
    }
    const endIdx = text.indexOf(postalCode) + 5;
    
    if (endIdx > startIdx) {
      let address = text.substring(startIdx, endIdx).trim();
      // Look for "เลขที่" or number at start
      const numMatch = address.match(/(?:เลขที่\s*)?(\d+)/);
      if (numMatch) {
        const numIdx = address.indexOf(numMatch[0]);
        address = address.substring(numIdx).trim();
      }
      if (address.length > 10) {
        data.address = address;
      }
    }
  }

  // Determine if we have enough data
  data.hasCompany = !!data.company;
  data.hasAddress = !!data.address;
  data.hasTaxId = !!data.taxId;
  data.hasName = !!data.name;
  
  // Check if complete (at least name/company, address, and taxId)
  data.complete = (data.name || data.company) && data.address && data.taxId;
  
  // Store original text for fallback
  data.originalText = message;

  return data;
}

// Extract document data from natural language
function extractDocumentData(message: string): any {
  const msg = message.toLowerCase();
  let type = 'invoice';
  
  if (msg.includes('ใบเสนอราคา') || msg.includes('quotation')) {
    type = 'quotation';
  } else if (msg.includes('ใบเสร็จ') || msg.includes('receipt')) {
    type = 'receipt';
  }

  return { type, needsMoreInfo: true };
}

/**
 * Smart Parser for Line Items
 * รองรับรูปแบบ:
 * - "เพิ่มรายการ ออกแบบเว็บไซต์ 1 งาน 50000 บาท"
 * - "เพิ่มรายการ ค่าที่ปรึกษา 10 ชม. 1500"
 * - "เพิ่มรายการ พัฒนาระบบ x 5 วัน @ 3000"
 */
function smartParseLineItem(message: string): any {
  // Remove command prefix
  let text = message
    .replace(/^(เพิ่มรายการ|เพิ่มสินค้า|เพิ่มบริการ|add item|add service)[\s:]+/i, '')
    .trim();

  const data: any = {};

  // Patterns for price extraction
  const pricePatterns = [
    /(?:ราคา|@|x|บาท)\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:บาท)?/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*(?:บาท|thb|฿)/i,
    /([0-9]{3,}(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*$/i, // large number at end
  ];

  // Extract price
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      data.unitPrice = parseFloat(match[1].replace(/,/g, ''));
      text = text.replace(match[0], ' ').trim();
      break;
    }
  }

  // Patterns for quantity extraction
  const quantityPatterns = [
    /(?:จำนวน|qty|x)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:ชิ้น|ชม\.|ชั่วโมง|วัน|งาน|รายการ|เดือน|ครั้ง)?/i,
    /([0-9]+(?:\.[0-9]+)?)\s*(ชิ้น|ชม\.|ชั่วโมง|hour|hrs|วัน|day|งาน|รายการ|เดือน|ครั้ง)/i,
  ];

  // Extract quantity and unit
  for (const pattern of quantityPatterns) {
    const match = text.match(pattern);
    if (match) {
      data.quantity = parseFloat(match[1]);
      if (match[2]) {
        data.unit = normalizeUnit(match[2]);
      }
      text = text.replace(match[0], ' ').trim();
      break;
    }
  }

  // Default values
  if (!data.quantity) data.quantity = 1;
  if (!data.unit) data.unit = 'รายการ';
  if (!data.unitPrice) data.unitPrice = 0;

  // Remaining text is description
  data.description = text.replace(/\s+/g, ' ').trim();

  // Check if we have enough data
  data.complete = data.description && data.unitPrice > 0;

  return data;
}

function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    'ชิ้น': 'ชิ้น',
    'ชม.': 'ชั่วโมง',
    'ชั่วโมง': 'ชั่วโมง',
    'hour': 'ชั่วโมง',
    'hrs': 'ชั่วโมง',
    'วัน': 'วัน',
    'day': 'วัน',
    'งาน': 'งาน',
    'รายการ': 'รายการ',
    'เดือน': 'เดือน',
    'ครั้ง': 'ครั้ง',
  };
  return unitMap[unit.toLowerCase()] || unit;
}

// Handle add item action
async function handleAddItem(data: any) {
  if (!data?.description) {
    return {
      response: `**เพิ่มรายการสินค้า/บริการ**\n\nตัวอย่างการใช้งาน:\n- "เพิ่มรายการ ออกแบบเว็บไซต์ 1 งาน 50000 บาท"\n- "เพิ่มรายการ ค่าที่ปรึกษา 10 ชม. 1500"\n- "เพิ่มรายการ พัฒนาระบบ 5 วัน @ 3000"`,
    };
  }

  const item = {
    description: data.description,
    quantity: data.quantity || 1,
    unit: data.unit || 'รายการ',
    unitPrice: data.unitPrice || 0,
  };

  const total = item.quantity * item.unitPrice;

  return {
    response: `ตรวจพบรายการ:\n✓ รายละเอียด: ${item.description}\n✓ จำนวน: ${item.quantity} ${item.unit}\n✓ ราคา/หน่วย: ${item.unitPrice.toLocaleString()} บาท\n✓ รวม: ${total.toLocaleString()} บาท\n\n${item.unitPrice === 0 ? '⚠️ กรุณาระบุราคา\n\n' : ''}กำลัง autofill ไปที่ฟอร์ม...`,
    action: 'add_item',
    itemData: item,
  };
}

// Extract ID from message
function extractId(message: string): string | null {
  const match = message.match(/[a-zA-Z0-9-_]+/g);
  return match ? match[match.length - 1] : null;
}

// Initiate customer creation flow
async function initiateCustomerCreation(data: any, originalMessage: string) {
  // If we have complete data, offer to create or autofill
  if (data?.complete) {
    // Create customer and return with autofill action
    const createResult = await createCustomerDirectly(data);
    
    if (createResult.success) {
      return {
        response: createResult.response,
        action: 'customer_created',
        customerData: {
          id: createResult.customerId,
          name: data.name,
          company: data.company || '',
          address: data.address,
          taxId: data.taxId,
          phone: data.phone || '',
          email: data.email || '',
        },
        completed: true
      };
    } else {
      // If creation failed (e.g., already exists), still offer to autofill form
      return {
        response: createResult.response + '\n\nหรือต้องการให้ autofill ข้อมูลไปที่ฟอร์มเพื่อแก้ไขเองไหมครับ?',
        action: 'autofill_suggestion',
        customerData: {
          name: data.name,
          company: data.company || '',
          address: data.address,
          taxId: data.taxId,
          phone: data.phone || '',
          email: data.email || '',
        }
      };
    }
  }

  // If we have partial data, offer to autofill for user to complete
  if (data?.hasAddress || data?.hasTaxId || data?.hasCompany) {
    const parsed = [];
    if (data.company) parsed.push(`บริษัท: ${data.company}`);
    if (data.name && data.name !== data.company) parsed.push(`ชื่อ: ${data.name}`);
    if (data.address) parsed.push(`ที่อยู่: ${data.address}`);
    if (data.taxId) parsed.push(`เลขภาษี: ${data.taxId}`);
    if (data.phone) parsed.push(`เบอร์: ${data.phone}`);
    if (data.email) parsed.push(`อีเมล: ${data.email}`);

    const missing = [];
    if (!data.name && !data.company) missing.push('ชื่อ/บริษัท');
    if (!data.address) missing.push('ที่อยู่');
    if (!data.taxId) missing.push('เลขประจำตัวผู้เสียภาษี');

    return {
      response: `ตรวจพบข้อมูล:\n${parsed.map(p => `✓ ${p}`).join('\n')}${missing.length > 0 ? `\n\nยังขาด:\n${missing.map(m => `✗ ${m}`).join('\n')}` : ''}\n\nกำลัง autofill ไปที่ฟอร์ม... คุณสามารถแก้ไขได้ในฟอร์มด้านซ้าย`,
      action: 'autofill',
      customerData: {
        name: data.name || data.company || '',
        company: data.company || '',
        address: data.address || '',
        taxId: data.taxId || '',
        phone: data.phone || '',
        email: data.email || '',
      }
    };
  }

  // No data provided, show help
  const sessionId = `session_${Date.now()}`;
  
  return {
    response: `สร้างลูกค้าใหม่\n\nวิธีใช้งาน:\n1. **พิมพ์ข้อมูลแบบธรรมชาติ** เช่น:\n   "สร้างลูกค้า บริษัท ABC จำกัด เลขที่ 123 ถ.สุขุมวิท กรุงเทพ 10110 เลขภาษี 1234567890123"\n\n2. **หรือพิมพ์แบบมี label** เช่น:\n   "สร้างลูกค้า ชื่อ: xxx ที่อยู่: xxx taxId: xxx"\n\nระบบจะ detect ข้อมูลและ autofill ให้อัตโนมัติ`,
    sessionId,
    step: 'awaiting_customer_data',
    data: {}
  };
}

// Process customer data from follow-up message
async function processCustomerData(message: string, existingData: any) {
  const newData = smartParseCustomerData(message);
  const mergedData = { 
    ...existingData, 
    ...Object.fromEntries(Object.entries(newData).filter(([_, v]) => v)) 
  };

  // Check if we have complete data now
  if ((mergedData.name || mergedData.company) && mergedData.address && mergedData.taxId) {
    // Create customer
    const createResult = await createCustomerDirectly(mergedData);
    
    return {
      response: createResult.response,
      action: createResult.success ? 'customer_created' : undefined,
      customerData: createResult.success ? {
        id: createResult.customerId,
        name: mergedData.name || mergedData.company,
        company: mergedData.company || '',
        address: mergedData.address,
        taxId: mergedData.taxId,
        phone: mergedData.phone || '',
      } : undefined,
      completed: true
    };
  }

  // If we have some data, autofill
  if (mergedData.address || mergedData.taxId || mergedData.company) {
    const parsed = [];
    if (mergedData.company) parsed.push(`บริษัท: ${mergedData.company}`);
    if (mergedData.name) parsed.push(`ชื่อ: ${mergedData.name}`);
    if (mergedData.address) parsed.push(`ที่อยู่: ${mergedData.address}`);
    if (mergedData.taxId) parsed.push(`เลขภาษี: ${mergedData.taxId}`);

    const missing = [];
    if (!mergedData.name && !mergedData.company) missing.push('ชื่อ/บริษัท');
    if (!mergedData.address) missing.push('ที่อยู่');
    if (!mergedData.taxId) missing.push('เลขประจำตัวผู้เสียภาษี');

    return {
      response: `ตรวจพบข้อมูล:\n${parsed.map(p => `✓ ${p}`).join('\n')}\n\n${missing.length > 0 ? `ยังขาด: ${missing.join(', ')}\n\n` : ''}Autofill ไปที่ฟอร์มแล้ว กรุณาตรวจสอบและเพิ่มข้อมูลที่ขาด`,
      action: 'autofill',
      customerData: {
        name: mergedData.name || mergedData.company || '',
        company: mergedData.company || '',
        address: mergedData.address || '',
        taxId: mergedData.taxId || '',
        phone: mergedData.phone || '',
      },
      completed: true
    };
  }

  return {
    response: `ไม่สามารถ detect ข้อมูลได้\n\nกรุณาพิมพ์ข้อมูลใหม่ เช่น:\n"บริษัท ABC จำกัด เลขที่ 123 ถ.สุขุมวิท กรุงเทพ 10110 เลขภาษี 1234567890123"`,
    completed: false,
    nextStep: 'awaiting_customer_data',
    data: mergedData
  };
}

// Create customer directly with complete data
async function createCustomerDirectly(data: any): Promise<{ success: boolean; response: string; customerId?: string }> {
  try {
    const customersDir = path.join(process.cwd(), 'customers');
    await mkdir(customersDir, { recursive: true });

    // Generate ID from company or name
    const baseName = data.company || data.name || '';
    const id = baseName
      .toLowerCase()
      .replace(/บริษัท|จำกัด|\(สำนักงานใหญ่\)|\(มหาชน\)/gi, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9ก-๙-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || `customer-${Date.now()}`;

    const filePath = path.join(customersDir, `${id}.json`);
    const file = Bun.file(filePath);
    
    if (await file.exists()) {
      return {
        success: false,
        response: `ลูกค้า ID "${id}" มีอยู่แล้วในระบบ`
      };
    }

    const customerData = {
      name: data.name || data.company,
      company: data.company || '',
      address: data.address,
      taxId: data.taxId,
      phone: data.phone || ''
    };

    await Bun.write(filePath, JSON.stringify(customerData, null, 2));

    return {
      success: true,
      response: `สร้างลูกค้าสำเร็จ!\n\n**${customerData.name}**${customerData.company && customerData.company !== customerData.name ? ` (${customerData.company})` : ''}\nID: \`${id}\`\nที่อยู่: ${customerData.address}\nTax ID: ${customerData.taxId}${customerData.phone ? `\nเบอร์: ${customerData.phone}` : ''}\n\n✅ ลูกค้าพร้อมใช้งานแล้ว`,
      customerId: id
    };
  } catch (error) {
    return {
      success: false,
      response: `เกิดข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown'}`
    };
  }
}

// List all customers
async function listCustomers(): Promise<string> {
  const customersDir = path.join(process.cwd(), 'customers');
  
  try {
    const files = await readdir(customersDir);
    const customers = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(customersDir, file);
        const content = await Bun.file(filePath).json();
        customers.push({
          id: file.replace('.json', ''),
          name: content.name,
          company: content.company,
        });
      }
    }

    if (customers.length === 0) {
      return 'ยังไม่มีลูกค้าในระบบ\n\nสร้างลูกค้าใหม่โดยพิมพ์ข้อมูลบริษัท เช่น:\n"สร้างลูกค้า บริษัท ABC จำกัด เลขที่ 123 ถ.สุขุมวิท กรุงเทพ 10110 เลขภาษี 1234567890123"';
    }

    let response = `พบลูกค้า ${customers.length} ราย:\n\n`;
    customers.forEach((c, i) => {
      response += `${i + 1}. **${c.name}**${c.company && c.company !== c.name ? ` (${c.company})` : ''}\n   ID: \`${c.id}\`\n`;
    });

    return response;
  } catch (error) {
    return 'ไม่สามารถอ่านรายชื่อลูกค้าได้';
  }
}

// List all documents
async function listDocuments(): Promise<string> {
  const examplesDir = path.join(process.cwd(), 'examples');
  
  try {
    const files = await readdir(examplesDir);
    const documents = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(examplesDir, file);
        const content = await Bun.file(filePath).json();
        
        let type = 'ไม่ทราบ';
        if (file.includes('invoice') || content.dueDate) type = 'ใบแจ้งหนี้';
        else if (file.includes('quotation') || content.validUntil) type = 'ใบเสนอราคา';
        else if (file.includes('receipt') || content.paymentDate) type = 'ใบเสร็จ';

        documents.push({
          id: file.replace('.json', ''),
          type,
          documentNumber: content.documentNumber || 'auto',
        });
      }
    }

    if (documents.length === 0) {
      return 'ยังไม่มีเอกสารในระบบ';
    }

    let response = `พบเอกสาร ${documents.length} รายการ:\n\n`;
    documents.forEach((d, i) => {
      response += `${i + 1}. **${d.type}** - ${d.documentNumber}\n   ID: \`${d.id}\`\n`;
    });

    return response;
  } catch (error) {
    return 'ไม่สามารถอ่านรายการเอกสารได้';
  }
}

// Create document helper
async function createDocument(data: any): Promise<string> {
  const typeNames: Record<string, string> = {
    invoice: 'ใบแจ้งหนี้',
    quotation: 'ใบเสนอราคา',
    receipt: 'ใบเสร็จรับเงิน',
  };

  return `เพื่อสร้าง${typeNames[data.type] || 'เอกสาร'} กรุณากรอกข้อมูลในฟอร์มด้านซ้าย`;
}

// Delete customer
async function deleteCustomer(id: string | null): Promise<string> {
  if (!id) {
    return 'กรุณาระบุ ID ของลูกค้า เช่น "ลบลูกค้า acme-corp"';
  }

  const filePath = path.join(process.cwd(), 'customers', `${id}.json`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return `ไม่พบลูกค้า ID: ${id}`;
  }

  const fs = await import('fs/promises');
  await fs.unlink(filePath);

  return `ลบลูกค้า "${id}" เรียบร้อยแล้ว`;
}

// Delete document
async function deleteDocument(id: string | null): Promise<string> {
  if (!id) {
    return 'กรุณาระบุ ID ของเอกสาร เช่น "ลบเอกสาร invoice-001"';
  }

  const filePath = path.join(process.cwd(), 'examples', `${id}.json`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return `ไม่พบเอกสาร ID: ${id}`;
  }

  const fs = await import('fs/promises');
  await fs.unlink(filePath);

  return `ลบเอกสาร "${id}" เรียบร้อยแล้ว`;
}

// Help message
function getHelpMessage(): string {
  return `**คำสั่งที่ใช้ได้:**

**สร้างลูกค้า (Smart Mode):**
พิมพ์ข้อมูลแบบธรรมชาติ ระบบจะ detect อัตโนมัติ:
\`สร้างลูกค้า บริษัท ABC จำกัด เลขที่ 123 ถ.สุขุมวิท กรุงเทพ 10110 เลขภาษี 1234567890123\`

**เพิ่มรายการสินค้า/บริการ:**
\`เพิ่มรายการ ออกแบบเว็บไซต์ 1 งาน 50000 บาท\`
\`เพิ่มรายการ ค่าที่ปรึกษา 10 ชม. 1500\`

**ดูข้อมูล:**
- "รายชื่อลูกค้า" - ดูลูกค้าทั้งหมด
- "รายการเอกสาร" - ดูเอกสารทั้งหมด

**ลบข้อมูล:**
- "ลบลูกค้า [id]"
- "ลบเอกสาร [id]"

**อื่นๆ:**
- "ยกเลิก" - ยกเลิกการทำงาน
- "ช่วยเหลือ" - แสดงคำสั่งนี้`;
}

// Default response
function getDefaultResponse(message: string): string {
  return `ไม่เข้าใจคำสั่ง "${message.substring(0, 50)}..."

ลองพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งที่ใช้ได้`;
}

export default app;
