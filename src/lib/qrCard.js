import { QRCodeLib } from "./qrcode";
import { LOGO_DATA_URI } from "./logo";
import { T } from "./theme";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Draws a QR code with the studio logo embedded in the centre. Uses 'H' (high)
// error correction so the code still scans reliably with ~20% of it covered by
// the logo — well under the ~30% safety margin that level tolerates.
export async function drawQrWithLogo(canvas, text, { size = 260, withLogo = true } = {}) {
  const qr = QRCodeLib(0, "H");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const total = n + quiet * 2;
  const cell = Math.max(1, Math.floor(size / total));
  const px = cell * total;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, px, px);
  ctx.fillStyle = T.maroonDark;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
  if (withLogo) {
    try {
      const img = await loadImage(LOGO_DATA_URI);
      const logoSize = px * 0.2;
      const logoX = (px - logoSize) / 2;
      const logoY = (px - logoSize) / 2;
      const pad = logoSize * 0.16;
      ctx.fillStyle = "#fff";
      roundRect(ctx, logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 10);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(px / 2, px / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    } catch {
      // If the logo somehow fails to load, the plain QR (already drawn) still works fine.
    }
  }
  return canvas.toDataURL("image/png");
}

// A single shareable image: logo-embedded QR, instructions, and the access code,
// composed onto one card — what actually gets downloaded or shared.
export async function buildQrCardDataUrl({ studentName, code, qrText }) {
  const cardW = 480, cardH = 640;
  const card = document.createElement("canvas");
  card.width = cardW;
  card.height = cardH;
  const ctx = card.getContext("2d");

  ctx.fillStyle = T.ivory;
  ctx.fillRect(0, 0, cardW, cardH);
  ctx.strokeStyle = T.gold;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, cardW - 6, cardH - 6);

  ctx.fillStyle = T.gold;
  ctx.font = "600 15px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NRITYA MANDALA", cardW / 2, 46);

  ctx.fillStyle = T.maroonDark;
  ctx.font = "700 28px Georgia, serif";
  ctx.fillText(studentName, cardW / 2, 84);

  ctx.fillStyle = T.ink;
  ctx.font = "400 15px Inter, sans-serif";
  wrapText(ctx, "Scan to see bookings & attendance history", cardW / 2, 112, cardW - 80, 20);

  const qrCanvas = document.createElement("canvas");
  const qrSize = 300;
  await drawQrWithLogo(qrCanvas, qrText, { size: qrSize * 2, withLogo: true });
  const qrX = (cardW - qrSize) / 2;
  const qrY = 150;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  const codeBoxY = qrY + qrSize + 24;
  ctx.fillStyle = `${T.gold}22`;
  roundRect(ctx, cardW / 2 - 120, codeBoxY, 240, 70, 10);
  ctx.fill();
  ctx.fillStyle = T.inkSoft;
  ctx.font = "400 11px Inter, sans-serif";
  ctx.fillText("ACCESS CODE", cardW / 2, codeBoxY + 24);
  ctx.fillStyle = T.maroonDark;
  ctx.font = "700 30px Georgia, serif";
  ctx.fillText(code, cardW / 2, codeBoxY + 56);

  ctx.fillStyle = T.inkSoft;
  ctx.font = "400 12px Inter, sans-serif";
  ctx.fillText("No login needed \u2014 works on any phone", cardW / 2, cardH - 20);

  return card.toDataURL("image/png");
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, curY);
      line = word + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
}
