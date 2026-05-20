/** Petrosphere payment method block for booking / registration emails (matches guest registration UI). */

export type PaymentMethodPanelKey = "BPI" | "GCASH" | "COUNTER"

function assetUrl(baseUrl: string, path: string) {
  const base = (baseUrl || "").replace(/\/$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}

function optionRow(
  baseUrl: string,
  iconPath: string,
  label: string,
  selected: boolean
): string {
  const bg = selected ? "#eff6ff" : "#fafafa"
  const bar = selected ? "border-left:4px solid #2563eb;" : ""
  const mark = selected
    ? `<span style="color:#2563eb;font-weight:700;font-size:16px;line-height:1;">&#9679;</span>`
    : `<span style="color:#d1d5db;font-size:16px;line-height:1;">&#9675;</span>`
  const src = assetUrl(baseUrl, iconPath)
  return `<tr><td style="padding:0;border-bottom:1px solid #e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${bg};${bar}">
      <tr>
        <td style="padding:10px 12px;width:40px;vertical-align:middle;"><img src="${src}" alt="" width="28" height="28" style="display:block;border-radius:4px;object-fit:contain;"/></td>
        <td style="padding:10px 8px 10px 0;vertical-align:middle;font-size:14px;color:#111827;font-weight:500;">${label}</td>
        <td style="padding:10px 12px;width:36px;text-align:right;vertical-align:middle;">${mark}</td>
      </tr>
    </table>
  </td></tr>`
}

function detailsBpi(): string {
  return `<div style="padding:0;">
    <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#111827;">BPI Bank Deposit/Transfer</p>
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.55;">Make your payment via deposit at any nearest BPI branches or via bank transfer with the following details:</p>
    <div style="padding:12px 14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <p style="margin:4px 0;font-size:14px;color:#111827;"><strong>Account Name:</strong> PETROSPHERE INCORPORATED</p>
      <p style="margin:4px 0;font-size:14px;color:#111827;"><strong>Account Number:</strong> 3481 0038 99</p>
    </div>
  </div>`
}

function detailsGcash(): string {
  return `<div style="padding:0;">
    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#111827;">GCash</p>
    <ol style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:1.65;">
      <li style="margin-bottom:6px;">Login in your GCash App and tap Bank Transfer.</li>
      <li style="margin-bottom:6px;">Select BPI from the list of banks.</li>
      <li style="margin-bottom:6px;">Enter the corresponding training fee and the following details:</li>
    </ol>
    <div style="margin:8px 0 12px 0;padding:12px 14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <p style="margin:4px 0;font-size:14px;color:#111827;"><strong>Account Name:</strong> PETROSPHERE INCORPORATED</p>
      <p style="margin:4px 0;font-size:14px;color:#111827;"><strong>Account Number:</strong> 3481 0038 99</p>
    </div>
    <ol start="4" style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:1.65;">
      <li style="margin-bottom:6px;">Tap send money, review the details, then tap confirm to complete your transaction.</li>
      <li style="margin-bottom:6px;">Download receipt and upload it using the upload link in this email.</li>
    </ol>
    <p style="margin:12px 0 0 0;font-size:13px;color:#6b7280;">If you have questions, feel free to contact us at 0917 708 7994.</p>
  </div>`
}

function detailsCounter(): string {
  return `<div style="padding:0;">
    <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#111827;">Pay Over the Counter</p>
    <p style="margin:0 0 10px 0;font-size:14px;color:#374151;line-height:1.55;">To process your payment, drop by the office at:</p>
    <div style="padding:12px 14px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
      <p style="margin:4px 0;font-size:14px;color:#111827;">Unit 305 3F, Trigold Business Park,</p>
      <p style="margin:4px 0;font-size:14px;color:#111827;">Barangay San Pedro National Highway,</p>
      <p style="margin:4px 0;font-size:14px;color:#111827;">Puerto Princesa City, 5300 Palawan, Philippines</p>
    </div>
  </div>`
}

/**
 * Email-safe “Payment Method” card: three options with selection state + Petrosphere payment details for the trainee’s method.
 */
export function buildPaymentMethodPanelHtml(
  baseUrl: string,
  method: PaymentMethodPanelKey
): string {
  const bpi = optionRow(baseUrl, "/bpi.svg", "BPI Bank Deposit/Transfer", method === "BPI")
  const gcash = optionRow(baseUrl, "/gcash.jpeg", "GCash", method === "GCASH")
  const counter = optionRow(baseUrl, "/otc.svg", "Pay Over the Counter", method === "COUNTER")

  const details =
    method === "BPI" ? detailsBpi() : method === "GCASH" ? detailsGcash() : detailsCounter()

  return `<div style="padding:0 2rem;margin-bottom:1.25rem;">
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#ffffff;">
      <div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#f9fafb;">
        <span style="font-size:16px;vertical-align:middle;">&#128179;</span>
        <span style="margin-left:8px;font-weight:700;color:#111827;font-size:14px;vertical-align:middle;">Payment Method</span>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${bpi}
        ${gcash}
        ${counter}
      </table>
      <div style="border-top:1px solid #e5e7eb;padding:14px 16px;background:#ffffff;">
        ${details}
      </div>
    </div>
  </div>`
}
