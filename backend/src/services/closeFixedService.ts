import { getRmaRequest, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export async function closeFixed(rmaId: string): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  // Allow closing from any active troubleshooting status
  const allowedStatuses = [
    'TROUBLESHOOTING_IN_PROGRESS',
    'TROUBLESHOOTING_COMPLETE',
    'AWAITING_TERMS_ACCEPTANCE',
  ];

  if (!allowedStatuses.includes(rma.status)) {
    throw Object.assign(
      new Error(`Cannot close as fixed in status: ${rma.status}`),
      { status: 400 },
    );
  }

  await updateRmaRequestStatus(rmaId, 'CLOSED_FIXED');

  await createAuditLogEntry({
    rmaId,
    eventType: 'CUSTOMER_MARKED_FIXED',
    actorType: 'CUSTOMER',
    payloadJson: {},
  });
}
