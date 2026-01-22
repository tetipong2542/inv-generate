/**
 * Utility functions for invoice generation
 */

export interface LineItem {
  description: string;
  details?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface CalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/**
 * Calculate subtotal, tax, and total from line items
 */
export function calculateTotals(
  items: LineItem[],
  taxRate: number,
  taxType: "withholding" | "vat"
): CalculationResult {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const taxAmount = subtotal * taxRate;

  let total: number;
  if (taxType === "withholding") {
    // Withholding tax is deducted from subtotal
    total = subtotal - taxAmount;
  } else {
    // VAT is added to subtotal
    total = subtotal + taxAmount;
  }

  return {
    subtotal,
    taxAmount,
    total,
  };
}

/**
 * Format number with Thai thousand separators
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Convert Gregorian date to Buddhist Era (BE) format
 */
export function formatDateThai(dateString: string): string {
  const date = new Date(dateString);

  const thaiMonths = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const yearBE = date.getFullYear() + 543; // Convert to Buddhist Era

  return `${day} ${month} ${yearBE}`;
}

/**
 * Validate file path exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const file = Bun.file(path);
    return await file.exists();
  } catch {
    return false;
  }
}

/**
 * Read and parse JSON file
 */
export async function readJSON<T>(path: string): Promise<T> {
  const file = Bun.file(path);
  return await file.json();
}

/**
 * Get output file path
 */
export function getOutputPath(
  type: string,
  documentNumber: string,
  customOutput?: string
): string {
  if (customOutput) {
    return customOutput;
  }

  // Default: output/{type}-{number}.pdf
  const filename = `${type}-${documentNumber}.pdf`;
  return `output/${filename}`;
}

/**
 * Convert number to Thai text (Baht and Satang)
 * Examples:
 *   899.00 -> "แปดร้อยเก้าสิบเก้าบาทถ้วน"
 *   926.80 -> "เก้าร้อยยี่สิบหกบาทแปดสิบสตางค์"
 *   1234.50 -> "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
 */
export function bahtText(amount: number): string {
  const thaiDigits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  
  // Handle negative numbers
  if (amount < 0) {
    return "ลบ" + bahtText(Math.abs(amount));
  }
  
  // Handle zero
  if (amount === 0) {
    return "ศูนย์บาทถ้วน";
  }
  
  // Round to 2 decimal places
  const roundedAmount = Math.round(amount * 100) / 100;
  
  // Split into baht and satang
  const baht = Math.floor(roundedAmount);
  const satang = Math.round((roundedAmount - baht) * 100);
  
  /**
   * Convert a number (0-999999) to Thai text
   */
  function convertGroup(num: number): string {
    if (num === 0) return "";
    
    let result = "";
    const numStr = num.toString();
    const len = numStr.length;
    
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i], 10);
      const position = len - i - 1;
      
      if (digit === 0) continue;
      
      // Special case for "เอ็ด" (one in ones place, when there are other digits)
      if (position === 0 && digit === 1 && len > 1) {
        result += "เอ็ด";
        continue;
      }
      
      // Special case for "ยี่" (two in tens place)
      if (position === 1 && digit === 2) {
        result += "ยี่สิบ";
        continue;
      }
      
      // Special case for "สิบ" without prefix when digit is 1 in tens place
      if (position === 1 && digit === 1) {
        result += "สิบ";
        continue;
      }
      
      result += thaiDigits[digit] + thaiPositions[position];
    }
    
    return result;
  }
  
  /**
   * Convert full baht amount including millions
   */
  function convertBaht(num: number): string {
    if (num === 0) return "";
    
    let result = "";
    
    // Handle millions (ล้าน)
    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      result += convertGroup(millions) + "ล้าน";
      num = num % 1000000;
    }
    
    // Handle remaining (up to 999,999)
    if (num > 0) {
      result += convertGroup(num);
    }
    
    return result;
  }
  
  // Build final result
  let result = "";
  
  if (baht > 0) {
    result += convertBaht(baht) + "บาท";
  }
  
  if (satang === 0) {
    result += "ถ้วน";
  } else {
    result += convertGroup(satang) + "สตางค์";
  }
  
  return result;
}

/**
 * Multi-tax calculation interface
 */
export interface TaxConfig {
  vat: { enabled: boolean; rate: number };
  withholding: { enabled: boolean; rate: number };
  grossUp: boolean;
}

export interface TaxBreakdown {
  subtotal: number;       // Amount before tax (or gross amount if gross-up)
  vatAmount: number;
  withholdingAmount: number;
  total: number;          // Final amount to pay/receive
  grossUpAmount?: number; // Extra amount customer pays for tax
}

/**
 * Calculate multi-tax breakdown with optional gross-up
 */
export function calculateMultiTax(itemsSubtotal: number, taxConfig: TaxConfig): TaxBreakdown {
  const { vat, withholding, grossUp } = taxConfig;
  
  if (grossUp) {
    // Gross-up: customer pays the tax, we receive the desired net amount
    let grossAmount = itemsSubtotal;
    let vatAmount = 0;
    let withholdingAmount = 0;
    
    if (vat.enabled && withholding.enabled) {
      // Company: VAT 7% + WHT 3%
      // net = gross * (1 + 0.07 - 0.03) = gross * 1.04
      grossAmount = itemsSubtotal / (1 + vat.rate - withholding.rate);
      vatAmount = grossAmount * vat.rate;
      withholdingAmount = grossAmount * withholding.rate;
    } else if (withholding.enabled && !vat.enabled) {
      // Individual: WHT only
      // net = gross * (1 - 0.03) = gross * 0.97
      grossAmount = itemsSubtotal / (1 - withholding.rate);
      withholdingAmount = grossAmount * withholding.rate;
    } else if (vat.enabled && !withholding.enabled) {
      // VAT only
      grossAmount = itemsSubtotal / (1 + vat.rate);
      vatAmount = grossAmount * vat.rate;
    }
    
    return {
      subtotal: Math.round(grossAmount * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: itemsSubtotal, // Net amount = original price user set
      grossUpAmount: Math.round((grossAmount - itemsSubtotal) * 100) / 100,
    };
  } else {
    // Normal calculation
    const vatAmount = vat.enabled ? itemsSubtotal * vat.rate : 0;
    const withholdingAmount = withholding.enabled ? itemsSubtotal * withholding.rate : 0;
    const total = itemsSubtotal + vatAmount - withholdingAmount;
    
    return {
      subtotal: Math.round(itemsSubtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      withholdingAmount: Math.round(withholdingAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }
}
