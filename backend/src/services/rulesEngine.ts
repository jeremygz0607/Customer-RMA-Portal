import { RmaRequest } from '../repositories/rmaRequestRepo';
import { TroubleshootingData } from '../repositories/rmaTroubleshootingRepo';
import { RmaStatus } from '../domain/rmaStatus';
import { getPool } from '../db/mssql';

export type AuthorizationDecision = 'AUTHORIZED' | 'NEEDS_REVIEW' | 'DENIED';

export interface AuthorizationResult {
  decision: AuthorizationDecision;
  reasonCode?: string;
  reasonMessage?: string;
}

export async function evaluateAuthorization(
  rma: RmaRequest,
  troubleshooting: TroubleshootingData | null,
): Promise<AuthorizationResult> {
  // Rule 7.1: Ownership validation (should already be done, but double-check)
  // This is handled at start, so we assume it passed if we're here

  // Rule 7.2: Warranty gate
  if (!rma.warrantyEligible) {
    // Out of warranty - still allow but mark for review if configured
    // Default: allow authorization but label issuance disabled (handled elsewhere)
    return {
      decision: 'AUTHORIZED',
      reasonCode: 'OUT_OF_WARRANTY',
      reasonMessage: 'Out of warranty - authorized as paid evaluation',
    };
  }

  // Rule 7.3: Terms acceptance (hard gate)
  if (!rma.acceptedBenchFeeTerms) {
    return {
      decision: 'NEEDS_REVIEW',
      reasonCode: 'TERMS_NOT_ACCEPTED',
      reasonMessage: 'Terms acceptance required',
    };
  }

  // Rule 7.4: Evidence requirements (playbook-driven)
  // If playbook requires evidence and it's missing, move to NEEDS_REVIEW
  if (troubleshooting) {
    const evidenceJson = troubleshooting.evidenceJson;
    const hasEvidence = evidenceJson && Array.isArray(evidenceJson) && evidenceJson.length > 0;

    // Check if customer opted out early (abuse control)
    if (troubleshooting.customerOptedOutOfTS) {
      // Rule 7.5: Abuse controls - opt out before minimum steps
      return {
        decision: 'NEEDS_REVIEW',
        reasonCode: 'OPTED_OUT_EARLY',
        reasonMessage: 'Customer opted out of troubleshooting early',
      };
    }

    // If troubleshooting is complete but no evidence when required, review
    // (This is simplified - in reality, playbook would specify evidence requirements)
    if (!hasEvidence && troubleshooting.stepsCompletedJson) {
      const steps = troubleshooting.stepsCompletedJson;
      if (Array.isArray(steps) && steps.length > 0) {
        // Check if any step required evidence
        const requiresEvidence = steps.some((s: any) => s.requiresEvidence === true);
        if (requiresEvidence) {
          return {
            decision: 'NEEDS_REVIEW',
            reasonCode: 'EVIDENCE_MISSING',
            reasonMessage: 'Evidence required but not provided',
          };
        }
      }
    }
  }

  // Rule 7.5: Repeat RMA threshold (abuse control)
  const repeatCount = await checkRepeatRmaCount(rma.orderId, rma.orderItemId);
  if (repeatCount > 0) {
    // Configurable threshold - default: 1+ in last 30 days = review
    return {
      decision: 'NEEDS_REVIEW',
      reasonCode: 'REPEAT_RMA',
      reasonMessage: `Multiple RMAs detected (${repeatCount} in last 30 days)`,
    };
  }

  // Default: AUTHORIZED
  return {
    decision: 'AUTHORIZED',
    reasonCode: 'AUTO_APPROVED',
  };
}

async function checkRepeatRmaCount(
  orderId: string,
  orderItemId: string,
): Promise<number> {
  const pool = await getPool();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await pool
    .request()
    .input('OrderID', orderId)
    .input('OrderItemID', orderItemId)
    .input('ThirtyDaysAgo', thirtyDaysAgo)
    .query(`
      SELECT COUNT(*) as Count
      FROM dbo.RMA_Request
      WHERE OrderID = @OrderID
        AND OrderItemID = @OrderItemID
        AND CreatedAt >= @ThirtyDaysAgo
        AND Status NOT IN ('DENIED', 'CLOSED_FIXED')
    `);

  return result.recordset[0]?.Count || 0;
}
