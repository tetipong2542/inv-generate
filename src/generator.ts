/**
 * PDF generation using Puppeteer
 */

import puppeteer from "puppeteer";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { calculateTotals, formatNumber, formatDateThai, bahtText, calculateMultiTax, type TaxConfig, type TaxBreakdown } from "./utils";
import type {
  DocumentData,
  InvoiceData,
  QuotationData,
  ReceiptData,
  FreelancerConfig,
  Customer,
} from "./validator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load signature image as base64 data URI
 */
async function loadSignatureBase64(
  signaturePath: string
): Promise<string | null> {
  try {
    const file = Bun.file(signaturePath);
    if (!(await file.exists())) {
      console.warn(`Warning: Signature file not found: ${signaturePath}`);
      return null;
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const ext = signaturePath.split(".").pop()?.toLowerCase();
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`Warning: Failed to load signature: ${error}`);
    return null;
  }
}

/**
 * Inject data into HTML template
 */
async function injectDataIntoTemplate(
  template: string,
  data: DocumentData,
  customer: Customer,
  config: FreelancerConfig,
  signatureDataUri: string | null,
  documentType: "invoice" | "quotation" | "receipt"
): Promise<string> {
  let html = template;

  // Calculate totals
  const { subtotal, taxAmount, total } = calculateTotals(
    data.items,
    data.taxRate,
    data.taxType
  );

  // Freelancer information
  html = html.replace(/\{\{freelancer\.name\}\}/g, config.name);
  html = html.replace(/\{\{freelancer\.title\}\}/g, config.title || "");
  html = html.replace(/\{\{freelancer\.email\}\}/g, config.email);
  html = html.replace(/\{\{freelancer\.phone\}\}/g, config.phone ? ` | โทร: ${config.phone}` : "");
  html = html.replace(/\{\{freelancer\.address\}\}/g, config.address);
  html = html.replace(/\{\{freelancer\.taxId\}\}/g, config.taxId);

  // Bank information
  html = html.replace(/\{\{bank\.name\}\}/g, config.bankInfo.bankName);
  html = html.replace(
    /\{\{bank\.accountName\}\}/g,
    config.bankInfo.accountName
  );
  html = html.replace(
    /\{\{bank\.accountNumber\}\}/g,
    config.bankInfo.accountNumber
  );
  html = html.replace(/\{\{bank\.branch\}\}/g, config.bankInfo.branch || "");

  // Document information
  html = html.replace(/\{\{documentNumber\}\}/g, data.documentNumber);
  html = html.replace(
    /\{\{issueDate\}\}/g,
    formatDateThai(data.issueDate)
  );

  // Type-specific dates
  if ("dueDate" in data) {
    html = html.replace(/\{\{dueDate\}\}/g, formatDateThai(data.dueDate));
  }
  if ("validUntil" in data) {
    html = html.replace(
      /\{\{validUntil\}\}/g,
      formatDateThai(data.validUntil)
    );
  }
  if ("paymentDate" in data) {
    html = html.replace(
      /\{\{paymentDate\}\}/g,
      formatDateThai(data.paymentDate)
    );
  }

  // Receipt-specific fields
  if ("paymentMethod" in data) {
    html = html.replace(/\{\{paymentMethod\}\}/g, data.paymentMethod);
  }
  html = html.replace(
    /\{\{referenceNumber\}\}/g,
    ("referenceNumber" in data && data.referenceNumber) ? data.referenceNumber : "-"
  );

  // Customer information
  html = html.replace(/\{\{customer\.name\}\}/g, customer.name);
  html = html.replace(
    /\{\{customer\.company\}\}/g,
    customer.company || ""
  );
  html = html.replace(/\{\{customer\.address\}\}/g, customer.address);
  html = html.replace(/\{\{customer\.taxId\}\}/g, customer.taxId);
  html = html.replace(/\{\{customer\.phone\}\}/g, customer.phone ? `<br>โทร: ${customer.phone}` : "");

  // Generate items rows
  const itemsHTML = data.items
    .map((item, index) => {
      const lineTotal = item.quantity * item.unitPrice;
      const descriptionHtml = item.details 
        ? `<span class="item-main"><strong>${item.description}</strong></span><br><span class="item-details">${item.details}</span>`
        : `<span class="item-main"><strong>${item.description}</strong></span>`;
      return `
        <tr>
          <td>${index + 1}</td>
          <td class="description-cell">${descriptionHtml}</td>
          <td class="text-center">${item.quantity} ${item.unit}</td>
          <td class="text-right">${formatNumber(item.unitPrice)}</td>
          <td class="text-right">${formatNumber(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  html = html.replace(/\{\{items\}\}/g, itemsHTML);

  // Payment terms for invoices
  if ("paymentTerms" in data && data.paymentTerms) {
    const termsHTML = data.paymentTerms
      .map((term) => `<li>${term}</li>`)
      .join("");
    html = html.replace(/\{\{paymentTerms\}\}/g, termsHTML);
  } else {
    html = html.replace(/\{\{paymentTerms\}\}/g, "");
  }

  // Financial calculations
  // Check if we have multi-tax config
  if ((data as any).taxConfig) {
    const taxConfig = (data as any).taxConfig as TaxConfig;
    const itemsSubtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const breakdown = calculateMultiTax(itemsSubtotal, taxConfig);
    
    // Subtotal (gross amount if gross-up, otherwise items total)
    html = html.replace(/\{\{subtotal\}\}/g, formatNumber(breakdown.subtotal));
    
    // Build tax rows HTML
    let taxRowsHTML = "";
    
    if (taxConfig.vat.enabled) {
      const vatLabel = `ภาษีมูลค่าเพิ่ม ${taxConfig.vat.rate * 100}%`;
      taxRowsHTML += `
        <div class="summary-row">
          <span>${vatLabel}</span>
          <span class="amount">${formatNumber(breakdown.vatAmount)}</span>
        </div>
      `;
    }
    
    if (taxConfig.withholding.enabled) {
      const whtLabel = `หักภาษี ณ ที่จ่าย ${taxConfig.withholding.rate * 100}%`;
      taxRowsHTML += `
        <div class="summary-row">
          <span>${whtLabel}</span>
          <span class="amount">(${formatNumber(breakdown.withholdingAmount)})</span>
        </div>
      `;
    }
    
    // If no taxes enabled, show a "no tax" row
    if (!taxConfig.vat.enabled && !taxConfig.withholding.enabled) {
      taxRowsHTML = `
        <div class="summary-row">
          <span>ภาษี</span>
          <span class="amount">-</span>
        </div>
      `;
    }
    
    // Replace the tax row in templates with our multi-tax rows
    // First try to match the pattern, if not found, just replace placeholders
    const taxRowPattern = /<div class="summary-row">\s*<span>\{\{taxLabel\}\}<\/span>\s*<span class="amount">\{\{taxAmount\}\}<\/span>\s*<\/div>/;
    if (taxRowPattern.test(html)) {
      html = html.replace(taxRowPattern, taxRowsHTML);
    } else {
      // Fallback: just replace the placeholders
      html = html.replace(/\{\{taxLabel\}\}/g, "");
      html = html.replace(/\{\{taxAmount\}\}/g, "");
    }
    
    // Total
    html = html.replace(/\{\{total\}\}/g, formatNumber(breakdown.total));
    
    // Discount section (optional)
    const discount = (data as any).discount;
    let finalTotal = breakdown.total;
    if (discount?.enabled && discount.value > 0) {
      const discountAmount = discount.type === 'percent' 
        ? breakdown.subtotal * discount.value / 100 
        : discount.value;
      const discountLabel = discount.type === 'percent' 
        ? `ส่วนลด ${discount.value}%` 
        : 'ส่วนลด';
      html = html.replace(/\{\{discountRow\}\}/g, `
        <div class="summary-row">
          <span>${discountLabel}</span>
          <span class="amount">(${formatNumber(discountAmount)})</span>
        </div>
      `);
      html = html.replace(/\{\{discountAmount\}\}/g, formatNumber(discountAmount));
      finalTotal = finalTotal - discountAmount;
    } else {
      html = html.replace(/\{\{discountRow\}\}/g, '');
      html = html.replace(/\{\{discountAmount\}\}/g, '');
    }
    
    // Partial payment section (optional)
    const partialPayment = (data as any).partialPayment;
    const installmentData = (data as any).installment;
    let amountForThaiText = finalTotal;
    if (partialPayment?.enabled && partialPayment.value > 0) {
      const baseAmount = partialPayment.baseAmount || installmentData?.remainingAmount || finalTotal;
      const paymentAmount = partialPayment.type === 'percent' 
        ? baseAmount * partialPayment.value / 100 
        : partialPayment.value;
      const paymentLabel = partialPayment.type === 'percent' 
        ? `${partialPayment.value}%` 
        : '';
      
      const totalContract = installmentData?.totalContractAmount || finalTotal;
      const paidToDate = installmentData?.paidToDate || 0;
      const remainingBeforeThis = totalContract - paidToDate;
      const remainingAfterThis = remainingBeforeThis - paymentAmount;
      
      let installmentInfo = '';
      if (installmentData?.isInstallment && paidToDate > 0) {
        installmentInfo = `
          <div class="summary-row" style="color: #666; font-size: 0.85em; border-top: 1px dashed #ddd; padding-top: 8px; margin-top: 8px;">
            <span>ชำระแล้ว (งวดก่อนหน้า)</span>
            <span class="amount">${formatNumber(paidToDate)}</span>
          </div>
          <div class="summary-row" style="color: #666; font-size: 0.85em;">
            <span>ยอดคงเหลือก่อนงวดนี้</span>
            <span class="amount">${formatNumber(remainingBeforeThis)}</span>
          </div>
        `;
      }
      
      const highlightColors = {
        quotation: { bg: '#f3e8ff', text: '#7c3aed' },
        invoice: { bg: '#f3f4f6', text: '#374151' },
        receipt: { bg: '#dcfce7', text: '#16a34a' },
      };
      const colors = highlightColors[documentType];
      
      const mainPaymentRow = `
        <div class="summary-row" style="font-size: 1em; font-weight: bold; color: ${colors.text}; background: ${colors.bg}; padding: 10px; margin: 8px -10px; border-radius: 6px;">
          <span>งวดนี้ชำระ ${paymentLabel}</span>
          <span class="amount" style="font-size: 1.1em;">${formatNumber(paymentAmount)}</span>
        </div>
      `;
      
      let remainingRow = '';
      if (remainingAfterThis > 0) {
        remainingRow = `
          <div class="summary-row" style="color: #ea580c; font-size: 0.9em;">
            <span>ยอดคงเหลือหลังงวดนี้</span>
            <span class="amount">${formatNumber(remainingAfterThis)}</span>
          </div>
        `;
      }
      
      html = html.replace(/\{\{partialPaymentRow\}\}/g, `
        ${installmentInfo}
        ${mainPaymentRow}
        ${remainingRow}
      `);
      html = html.replace(/\{\{partialPaymentAmount\}\}/g, formatNumber(paymentAmount));
      amountForThaiText = paymentAmount;
    } else {
      html = html.replace(/\{\{partialPaymentRow\}\}/g, '');
      html = html.replace(/\{\{partialPaymentAmount\}\}/g, '');
    }
    
    // Thai text for amount (partial payment amount if enabled, otherwise total)
    html = html.replace(/\{\{totalInWords\}\}/g, bahtText(amountForThaiText));
  } else {
    // Legacy single-tax calculation
    html = html.replace(/\{\{subtotal\}\}/g, formatNumber(subtotal));
    html = html.replace(/\{\{taxLabel\}\}/g, data.taxLabel);

    // Tax amount with sign
    const taxDisplay =
      data.taxType === "withholding"
        ? `(${formatNumber(taxAmount)})`
        : formatNumber(taxAmount);
    html = html.replace(/\{\{taxAmount\}\}/g, taxDisplay);
    html = html.replace(/\{\{total\}\}/g, formatNumber(total));
    
    // Discount (legacy mode)
    const discount = (data as any).discount;
    let finalTotal = total;
    if (discount?.enabled && discount.value > 0) {
      const discountAmount = discount.type === 'percent' 
        ? subtotal * discount.value / 100 
        : discount.value;
      const discountLabel = discount.type === 'percent' 
        ? `ส่วนลด ${discount.value}%` 
        : 'ส่วนลด';
      html = html.replace(/\{\{discountRow\}\}/g, `
        <div class="summary-row">
          <span>${discountLabel}</span>
          <span class="amount">(${formatNumber(discountAmount)})</span>
        </div>
      `);
      html = html.replace(/\{\{discountAmount\}\}/g, formatNumber(discountAmount));
      finalTotal = finalTotal - discountAmount;
    } else {
      html = html.replace(/\{\{discountRow\}\}/g, '');
      html = html.replace(/\{\{discountAmount\}\}/g, '');
    }
    
    // Partial payment (legacy mode)
    const partialPayment = (data as any).partialPayment;
    const installmentData = (data as any).installment;
    let amountForThaiText = finalTotal;
    if (partialPayment?.enabled && partialPayment.value > 0) {
      const baseAmount = partialPayment.baseAmount || installmentData?.remainingAmount || finalTotal;
      const paymentAmount = partialPayment.type === 'percent' 
        ? baseAmount * partialPayment.value / 100 
        : partialPayment.value;
      const paymentLabel = partialPayment.type === 'percent' 
        ? `${partialPayment.value}%` 
        : '';
      
      const totalContract = installmentData?.totalContractAmount || finalTotal;
      const paidToDate = installmentData?.paidToDate || 0;
      const remainingBeforeThis = totalContract - paidToDate;
      const remainingAfterThis = remainingBeforeThis - paymentAmount;
      
      let installmentInfo = '';
      if (installmentData?.isInstallment && paidToDate > 0) {
        installmentInfo = `
          <div class="summary-row" style="color: #666; font-size: 0.85em; border-top: 1px dashed #ddd; padding-top: 8px; margin-top: 8px;">
            <span>ชำระแล้ว (งวดก่อนหน้า)</span>
            <span class="amount">${formatNumber(paidToDate)}</span>
          </div>
          <div class="summary-row" style="color: #666; font-size: 0.85em;">
            <span>ยอดคงเหลือก่อนงวดนี้</span>
            <span class="amount">${formatNumber(remainingBeforeThis)}</span>
          </div>
        `;
      }
      
      const highlightColors = {
        quotation: { bg: '#f3e8ff', text: '#7c3aed' },
        invoice: { bg: '#f3f4f6', text: '#374151' },
        receipt: { bg: '#dcfce7', text: '#16a34a' },
      };
      const colors = highlightColors[documentType];
      
      const mainPaymentRow = `
        <div class="summary-row" style="font-size: 1em; font-weight: bold; color: ${colors.text}; background: ${colors.bg}; padding: 10px; margin: 8px -10px; border-radius: 6px;">
          <span>งวดนี้ชำระ ${paymentLabel}</span>
          <span class="amount" style="font-size: 1.1em;">${formatNumber(paymentAmount)}</span>
        </div>
      `;
      
      let remainingRow = '';
      if (remainingAfterThis > 0) {
        remainingRow = `
          <div class="summary-row" style="color: #ea580c; font-size: 0.9em;">
            <span>ยอดคงเหลือหลังงวดนี้</span>
            <span class="amount">${formatNumber(remainingAfterThis)}</span>
          </div>
        `;
      }
      
      html = html.replace(/\{\{partialPaymentRow\}\}/g, `
        ${installmentInfo}
        ${mainPaymentRow}
        ${remainingRow}
      `);
      html = html.replace(/\{\{partialPaymentAmount\}\}/g, formatNumber(paymentAmount));
      amountForThaiText = paymentAmount;
    } else {
      html = html.replace(/\{\{partialPaymentRow\}\}/g, '');
      html = html.replace(/\{\{partialPaymentAmount\}\}/g, '');
    }
    
    // Thai text for amount (partial payment amount if enabled, otherwise total)
    html = html.replace(/\{\{totalInWords\}\}/g, bahtText(amountForThaiText));
  }

  // Notes
  html = html.replace(/\{\{notes\}\}/g, data.notes || "");

  // Signature
  if (signatureDataUri) {
    html = html.replace(
      /\{\{signature\}\}/g,
      `<img src="${signatureDataUri}" alt="Signature" style="max-width: 200px; height: auto;">`
    );
  } else {
    // Leave blank for manual signing
    html = html.replace(/\{\{signature\}\}/g, "");
  }

  return html;
}

/**
 * Resolve template path
 * Looks in user's local templates/ first, then falls back to package templates/
 */
function resolveTemplatePath(type: string): string {
  // Try user's local templates first (in current working directory)
  const localTemplatePath = join(process.cwd(), "templates", `${type}.html`);
  if (existsSync(localTemplatePath)) {
    return localTemplatePath;
  }

  // Fall back to package's bundled templates
  // When running from source: src/generator.ts -> ../templates/
  // When running from installed: dist/generator.js -> ../templates/
  const packageRoot = join(__dirname, "..");
  const packageTemplatePath = join(packageRoot, "templates", `${type}.html`);

  if (existsSync(packageTemplatePath)) {
    return packageTemplatePath;
  }

  throw new Error(
    `Template not found: ${type}.html\n` +
    `  Searched in:\n` +
    `    - ${localTemplatePath}\n` +
    `    - ${packageTemplatePath}\n` +
    `  Tip: Run 'pacioli init' to create templates/ directory`
  );
}

/**
 * Generate PDF from document data
 */
export async function generatePDF(
  type: "invoice" | "quotation" | "receipt",
  data: DocumentData,
  customer: Customer,
  config: FreelancerConfig,
  outputPath: string
): Promise<void> {
  // Resolve template path
  const templatePath = resolveTemplatePath(type);
  const templateFile = Bun.file(templatePath);

  if (!(await templateFile.exists())) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const template = await templateFile.text();

  // Load signature if provided
  const signatureDataUri = config.signature
    ? await loadSignatureBase64(config.signature)
    : null;

  // Inject data into template
  const html = await injectDataIntoTemplate(template, data, customer, config, signatureDataUri, type);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    // Set content
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // Generate PDF in A4 format
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    console.log(`✓ PDF generated successfully: ${outputPath}`);
  } finally {
    await browser.close();
  }
}
