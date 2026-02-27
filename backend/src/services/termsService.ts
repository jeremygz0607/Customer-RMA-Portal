import { getRmaRequest, updateRmaRequestTerms, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export async function acceptTerms(
  rmaId: string,
  acceptedIP: string,
  acceptedUserAgent: string,
): Promise<void> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  if (rma.status !== 'TROUBLESHOOTING_COMPLETE' && rma.status !== 'AWAITING_TERMS_ACCEPTANCE') {
    throw Object.assign(
      new Error(`Cannot accept terms in status: ${rma.status}`),
      { status: 400 },
    );
  }

  await updateRmaRequestTerms(rmaId, acceptedIP, acceptedUserAgent);
  await updateRmaRequestStatus(rmaId, 'AWAITING_TERMS_ACCEPTANCE');

  await createAuditLogEntry({
    rmaId,
    eventType: 'TERMS_ACCEPTED',
    actorType: 'CUSTOMER',
    payloadJson: {
      acceptedIP,
      acceptedUserAgent,
      benchTestFeeAmount: rma.benchTestFeeAmount,
    },
  });
}
