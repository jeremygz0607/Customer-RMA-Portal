import { getPool } from '../db/mssql';
import { getRmaRequest, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { getTroubleshootingData } from '../repositories/rmaTroubleshootingRepo';
import { getRmaLabel } from '../repositories/rmaLabelRepo';
import { getAuditLogForRma } from '../repositories/rmaAuditRepo';
import { RmaStatus } from '../domain/rmaStatus';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export interface RmaQueueItem {
  rmaId: string;
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  status: RmaStatus;
  warrantyEligible: boolean;
  isInternational: boolean;
  createdAt: Date;
  reasonCode?: string;
}

export async function getRmaQueue(filters: {
  status?: RmaStatus;
  days?: number;
  isInternational?: boolean;
  outOfWarranty?: boolean;
}): Promise<RmaQueueItem[]> {
  const pool = await getPool();
  const request = pool.request();
  let query = `
    SELECT 
      RMA_ID, Brand, OrderID, OrderItemID, SKU, Status,
      WarrantyEligible, IsInternational, CreatedAt
    FROM dbo.RMA_Request
    WHERE 1=1
  `;

  if (filters.status) {
    request.input('Status', filters.status);
    query += ' AND Status = @Status';
  }

  if (filters.days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.days);
    request.input('CutoffDate', cutoffDate);
    query += ' AND CreatedAt >= @CutoffDate';
  }

  if (filters.isInternational !== undefined) {
    request.input('IsInternational', filters.isInternational);
    query += ' AND IsInternational = @IsInternational';
  }

  if (filters.outOfWarranty !== undefined) {
    request.input('WarrantyEligible', !filters.outOfWarranty);
    query += ' AND WarrantyEligible = @WarrantyEligible';
  }

  query += ' ORDER BY CreatedAt DESC';

  const result = await request.query(query);

  return result.recordset.map((row) => ({
    rmaId: row.RMA_ID,
    brand: row.Brand,
    orderId: row.OrderID,
    orderItemId: row.OrderItemID,
    sku: row.SKU,
    status: row.Status as RmaStatus,
    warrantyEligible: row.WarrantyEligible,
    isInternational: row.IsInternational,
    createdAt: row.CreatedAt,
  }));
}

export async function getRmaDetail(rmaId: string) {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  const troubleshooting = await getTroubleshootingData(rmaId);
  const label = await getRmaLabel(rmaId);
  const auditLog = await getAuditLogForRma(rmaId);

  return {
    rma,
    troubleshooting,
    label,
    auditLog,
  };
}

export async function overrideRmaStatus(
  rmaId: string,
  newStatus: RmaStatus,
  reason: string,
  adminUser: string,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  await updateRmaRequestStatus(rmaId, newStatus);

  await createAuditLogEntry({
    rmaId,
    eventType: 'ADMIN_OVERRIDE',
    actorType: 'AGENT',
    payloadJson: {
      previousStatus: rma.status,
      newStatus,
      reason,
      adminUser,
    },
  });
}

export async function submitFeedback(
  rmaId: string,
  decisionCorrect: boolean,
  notes: string,
  adminUser: string,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  await createAuditLogEntry({
    rmaId,
    eventType: 'ADMIN_FEEDBACK',
    actorType: 'AGENT',
    payloadJson: {
      decisionCorrect,
      notes,
      adminUser,
      automatedDecision: rma.status,
    },
  });
}
