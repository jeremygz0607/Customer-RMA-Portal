import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfig } from '../config/env';

export interface StorageConfig {
  storageRootPath: string;
  storageRetentionDays: number;
  maxUploadSizeMB: number;
  allowedExtensions: string[];
}

export function getStoragePath(
  brand: string,
  orderId: string,
  rmaId: string,
  subfolder: 'evidence' | 'pdf' | 'labels',
): string {
  const config = getConfig();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  if (subfolder === 'evidence') {
    return path.join(
      config.storageRootPath,
      'rma',
      brand,
      orderId,
      rmaId,
      'evidence',
      String(year),
      month,
    );
  }

  return path.join(
    config.storageRootPath,
    'rma',
    brand,
    orderId,
    rmaId,
    subfolder,
  );
}

export async function ensureStorageDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

export async function saveEvidenceFile(
  brand: string,
  orderId: string,
  rmaId: string,
  fileName: string,
  fileBuffer: Buffer,
): Promise<string> {
  const dirPath = getStoragePath(brand, orderId, rmaId, 'evidence');
  await ensureStorageDirectory(dirPath);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = path.extname(fileName);
  const baseName = path.basename(fileName, ext);
  const safeFileName = `evidence_${timestamp}_${baseName}${ext}`;

  const filePath = path.join(dirPath, safeFileName);
  await fs.writeFile(filePath, fileBuffer);

  return filePath;
}

export async function savePdfFile(
  brand: string,
  orderId: string,
  rmaId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const dirPath = getStoragePath(brand, orderId, rmaId, 'pdf');
  await ensureStorageDirectory(dirPath);

  const fileName = `rma_${rmaId}.pdf`;
  const filePath = path.join(dirPath, fileName);
  await fs.writeFile(filePath, pdfBuffer);

  return filePath;
}

export async function saveLabelFile(
  brand: string,
  orderId: string,
  rmaId: string,
  carrier: string,
  trackingNumber: string,
  labelBuffer: Buffer,
): Promise<string> {
  const dirPath = getStoragePath(brand, orderId, rmaId, 'labels');
  await ensureStorageDirectory(dirPath);

  const fileName = `label_${carrier}_${trackingNumber}.pdf`;
  const filePath = path.join(dirPath, fileName);
  await fs.writeFile(filePath, labelBuffer);

  return filePath;
}

export async function readFile(filePath: string): Promise<Buffer> {
  return await fs.readFile(filePath);
}

export function validateFileName(fileName: string): boolean {
  // Prevent directory traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return false;
  }
  return true;
}

export function validateFileExtension(
  fileName: string,
  allowedExtensions: string[],
): boolean {
  const ext = path.extname(fileName).toLowerCase().slice(1);
  return allowedExtensions.includes(ext);
}

export function validateFileSize(sizeBytes: number, maxSizeMB: number): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return sizeBytes <= maxSizeBytes;
}
