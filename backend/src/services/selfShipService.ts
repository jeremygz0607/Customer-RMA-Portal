import { getRmaRequest, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { upsertRmaLabel } from '../repositories/rmaLabelRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export async function recordSelfShip(
  rmaId: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  if (
    rma.status !== 'AUTHORIZED' &&
    rma.status !== 'LABEL_OPTIONS_PRESENTED' &&
    rma.status !== 'AWAITING_CUSTOMER_SHIPMENT'
  ) {
    throw Object.assign(
      new Error(`Cannot record self-ship in status: ${rma.status}`),
      { status: 400 },
    );
  }

  await upsertRmaLabel(rmaId, {
    carrier,
    trackingNumber,
  });

  await updateRmaRequestStatus(rmaId, 'TRACKING_RECORDED');

  await createAuditLogEntry({
    rmaId,
    eventType: 'TRACKING_RECORDED',
    actorType: 'CUSTOMER',
    payloadJson: {
      carrier,
      trackingNumber,
      method: 'SELF_SHIP',
    },
  });
}
