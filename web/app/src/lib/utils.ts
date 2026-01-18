import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateThai(dateString: string): string {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  
  const [year, month, day] = dateString.split('-').map(Number);
  const thaiYear = year + 543;
  
  return `${day} ${months[month - 1]} ${thaiYear}`;
}

/**
 * Format ISO date string to Thai date/time format
 * Example: "2026-01-17T09:30:00.000Z" -> "17 มกราคม 2569 16:30 น."
 * Converts to GMT+7 timezone
 */
export function formatDateTimeThai(isoString: string): string {
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  
  try {
    const date = new Date(isoString);
    
    // Convert to GMT+7
    const gmt7Date = new Date(date.getTime() + (7 * 60 * 60 * 1000));
    
    const day = gmt7Date.getUTCDate();
    const month = gmt7Date.getUTCMonth();
    const year = gmt7Date.getUTCFullYear() + 543;
    const hours = gmt7Date.getUTCHours().toString().padStart(2, '0');
    const minutes = gmt7Date.getUTCMinutes().toString().padStart(2, '0');
    
    return `${day} ${months[month]} ${year} ${hours}:${minutes} น.`;
  } catch (error) {
    return isoString;
  }
}
