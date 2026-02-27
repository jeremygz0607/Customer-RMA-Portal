import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { getRmaRequest } from '../repositories/rmaRequestRepo';
import { getRmaLabel } from '../repositories/rmaLabelRepo';
import { getEvidenceList } from './evidenceService';
import { savePdfFile, readFile } from './storageService';
import * as path from 'path';
import * as QRCode from 'qrcode';

// Generate PDF using PDFKit
async function generatePdfBuffer(rma: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).text('RMA Authorization Document', { align: 'center' });
    doc.moveDown();

    // RMA Information
    doc.fontSize(14).text('RMA Information:', { underline: true });
    doc.fontSize(12);
    doc.text(`RMA ID: ${rma.rmaId}`);
    doc.text(`Order ID: ${rma.orderId}`);
    doc.text(`Order Item ID: ${rma.orderItemId}`);
    doc.text(`SKU: ${rma.sku}`);
    doc.text(`Brand: ${rma.brand}`);
    doc.moveDown();

    // Warranty Status
    doc.fontSize(14).text('Warranty Status:', { underline: true });
    doc.fontSize(12);
    doc.text(`Status: ${rma.warrantyEligible ? 'In Warranty' : 'Out of Warranty'}`);
    if (rma.warrantyEndDate) {
      doc.text(`Warranty End Date: ${new Date(rma.warrantyEndDate).toLocaleDateString()}`);
    }
    doc.moveDown();

    // Generate QR Code
    const qrData = JSON.stringify({
      rmaId: rma.rmaId,
      orderId: rma.orderId,
      orderItemId: rma.orderItemId,
      sku: rma.sku,
    });

    QRCode.toDataURL(qrData, { width: 200 }, (err, url) => {
      if (err) {
        doc.text('QR Code: [Error generating]');
      } else {
        // Embed QR code image
        const img = Buffer.from(url.split(',')[1], 'base64');
        doc.image(img, { width: 150, align: 'center' });
      }

      doc.moveDown();

      // Instructions
      doc.fontSize(14).text('Return Instructions:', { underline: true });
      doc.fontSize(12);
      doc.text('1. Print this document and include it in your return package.');
      doc.text('2. Pack the item securely in its original packaging if possible.');
      doc.text('3. Include all accessories and documentation.');
      doc.text('4. Ship to the return address provided below.');
      doc.text('5. Keep your tracking number for reference.');
      doc.moveDown();

      // Return Address (from config)
      doc.fontSize(14).text('Return Address:', { underline: true });
      doc.fontSize(12);
      // TODO: Get from config
      doc.text('UpFix Returns');
      doc.text('123 Return Street');
      doc.text('Return City, CA 90210');
      doc.text('United States');
      doc.moveDown();

      // Footer
      doc.fontSize(10).text(
        `Generated: ${new Date().toLocaleString()}`,
        { align: 'center' },
      );

      doc.end();
    });
  });
}

export async function generateRmaPdf(rmaId: string): Promise<string> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  // Generate QR code
  const qrData = JSON.stringify({
    rmaId: rma.rmaId,
    orderId: rma.orderId,
    orderItemId: rma.orderItemId,
    sku: rma.sku,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(qrData);

  const pdfBuffer = await generatePdfBuffer(rma);

  // Save PDF
  const filePath = await savePdfFile(rma.brand, rma.orderId, rma.rmaId, pdfBuffer);
  return filePath;
}

export async function streamRmaPdf(rmaId: string, res: Response): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  // Check if PDF already exists
  const pdfPath = path.join(
    process.env.STORAGE_ROOT_PATH || './storage',
    'rma',
    rma.brand,
    rma.orderId,
    rma.rmaId,
    'pdf',
    `rma_${rmaId}.pdf`,
  );

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await readFile(pdfPath);
  } catch {
    // Generate if doesn't exist
    const newPath = await generateRmaPdf(rmaId);
    pdfBuffer = await readFile(newPath);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rma_${rmaId}.pdf"`);
  res.send(pdfBuffer);
}

export async function streamLabelPdf(rmaId: string, res: Response): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  const label = await getRmaLabel(rmaId);
  if (!label || !label.labelFilePath) {
    throw Object.assign(new Error('Label not found'), { status: 404 });
  }

  const labelBuffer = await readFile(label.labelFilePath);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="label_${label.carrier}_${label.trackingNumber}.pdf"`,
  );
  res.send(labelBuffer);
}

export async function streamEvidenceFile(
  rmaId: string,
  evidenceId: string,
  res: Response,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  const evidenceList = await getEvidenceList(rmaId);
  const evidence = evidenceList.find((e) => e.evidenceId === evidenceId);

  if (!evidence) {
    throw Object.assign(new Error('Evidence not found'), { status: 404 });
  }

  const fileBuffer = await readFile(evidence.filePath);

  res.setHeader('Content-Type', evidence.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${evidence.fileName}"`);
  res.send(fileBuffer);
}
