import { getRmaRequest, updateRmaRequestStatus } from '../repositories/rmaRequestRepo';
import { getTroubleshootingData } from '../repositories/rmaTroubleshootingRepo';
import { evaluateAuthorization, AuthorizationResult } from './rulesEngine';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export async function authorizeRma(rmaId: string): Promise<AuthorizationResult> {
  const rma = await getRmaRequest(rmaId);
  if (!rma) {
    throw Object.assign(new Error('RMA not found'), { status: 404 });
  }

  if (rma.status !== 'AWAITING_TERMS_ACCEPTANCE') {
    throw Object.assign(
      new Error(`Cannot authorize in status: ${rma.status}`),
      { status: 400 },
    );
  }

  const troubleshooting = await getTroubleshootingData(rmaId);
  const result = await evaluateAuthorization(rma, troubleshooting);

  // Update status based on decision
  if (result.decision === 'AUTHORIZED') {
    await updateRmaRequestStatus(rmaId, 'AUTHORIZED');
  } else if (result.decision === 'NEEDS_REVIEW') {
    await updateRmaRequestStatus(rmaId, 'NEEDS_REVIEW');
  } else if (result.decision === 'DENIED') {
    await updateRmaRequestStatus(rmaId, 'DENIED');
  }

  await createAuditLogEntry({
    rmaId,
    eventType: 'RULE_DECISION',
    actorType: 'RULE_ENGINE',
    payloadJson: {
      decision: result.decision,
      reasonCode: result.reasonCode,
      reasonMessage: result.reasonMessage,
    },
  });

  return result;
}
