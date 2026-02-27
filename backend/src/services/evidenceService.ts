import { getRmaRequest } from '../repositories/rmaRequestRepo';
import {
  getTroubleshootingData,
  upsertTroubleshootingData,
} from '../repositories/rmaTroubleshootingRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';
import {
  saveEvidenceFile,
  validateFileName,
  validateFileExtension,
  validateFileSize,
  getConfig,
} from './storageService';
import { v4 as uuid } from 'uuid';

export interface EvidenceRecord {
  evidenceId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export async function uploadEvidence(
  rmaId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<EvidenceRecord> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  // Validate file
  if (!validateFileName(fileName)) {
    throw Object.assign(new Error('Invalid file name'), { status: 400 });
  }

  const config = getConfig();
  if (!validateFileExtension(fileName, config.allowedExtensions)) {
    throw Object.assign(
      new Error(`File type not allowed. Allowed: ${config.allowedExtensions.join(', ')}`),
      { status: 400 },
    );
  }

  if (!validateFileSize(fileBuffer.length, config.maxUploadSizeMB)) {
    throw Object.assign(
      new Error(`File too large. Max: ${config.maxUploadSizeMB}MB`),
      { status: 400 },
    );
  }

  // Save file
  const filePath = await saveEvidenceFile(
    rma.brand,
    rma.orderId,
    rma.rmaId,
    fileName,
    fileBuffer,
  );

  const evidenceId = uuid();
  const evidenceRecord: EvidenceRecord = {
    evidenceId,
    fileName,
    filePath,
    fileSize: fileBuffer.length,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };

  // Update troubleshooting data
  const troubleshooting = await getTroubleshootingData(rmaId);
  const evidenceJson = troubleshooting?.evidenceJson || [];
  if (!Array.isArray(evidenceJson)) {
    throw new Error('Invalid evidence JSON structure');
  }

  evidenceJson.push(evidenceRecord);

  await upsertTroubleshootingData(rmaId, {
    evidenceJson,
  });

  await createAuditLogEntry({
    rmaId,
    eventType: 'EVIDENCE_UPLOADED',
    actorType: 'CUSTOMER',
    payloadJson: {
      evidenceId,
      fileName,
      fileSize: fileBuffer.length,
      mimeType,
    },
  });

  return evidenceRecord;
}

export async function getEvidenceList(rmaId: string): Promise<EvidenceRecord[]> {
  const troubleshooting = await getTroubleshootingData(rmaId);
  if (!troubleshooting || !troubleshooting.evidenceJson) {
    return [];
  }

  const evidenceJson = troubleshooting.evidenceJson;
  if (!Array.isArray(evidenceJson)) {
    return [];
  }

  return evidenceJson as EvidenceRecord[];
}
