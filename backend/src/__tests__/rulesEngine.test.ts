import { evaluateAuthorization } from '../services/rulesEngine';
import { RmaRequest } from '../repositories/rmaRequestRepo';
import { TroubleshootingData } from '../repositories/rmaTroubleshootingRepo';

// Mock the database check
jest.mock('../db/mssql', () => ({
  getPool: jest.fn().mockResolvedValue({
    request: jest.fn().mockReturnValue({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{ Count: 0 }],
      }),
    }),
  }),
}));

describe('Rules Engine', () => {
  const baseRma: RmaRequest = {
    rmaId: 'test-rma',
    brand: 'UPFIX',
    orderId: 'ORD123',
    orderItemId: 'ITEM456',
    sku: 'SKU789',
    skuGroupName: 'DEFAULT',
    isInternational: false,
    warrantyEligible: true,
    status: 'AWAITING_TERMS_ACCEPTANCE',
    benchTestFeeAmount: 39.99,
    acceptedBenchFeeTerms: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should authorize when all conditions are met', async () => {
    const result = await evaluateAuthorization(baseRma, null);
    expect(result.decision).toBe('AUTHORIZED');
  });

  it('should require review when terms not accepted', async () => {
    const rma = { ...baseRma, acceptedBenchFeeTerms: false };
    const result = await evaluateAuthorization(rma, null);
    expect(result.decision).toBe('NEEDS_REVIEW');
    expect(result.reasonCode).toBe('TERMS_NOT_ACCEPTED');
  });

  it('should authorize out-of-warranty items', async () => {
    const rma = { ...baseRma, warrantyEligible: false };
    const result = await evaluateAuthorization(rma, null);
    expect(result.decision).toBe('AUTHORIZED');
    expect(result.reasonCode).toBe('OUT_OF_WARRANTY');
  });

  it('should require review when customer opted out early', async () => {
    const troubleshooting: TroubleshootingData = {
      customerOptedOutOfTS: true,
    };
    const result = await evaluateAuthorization(baseRma, troubleshooting);
    expect(result.decision).toBe('NEEDS_REVIEW');
    expect(result.reasonCode).toBe('OPTED_OUT_EARLY');
  });

  it('should require review when evidence is missing but required', async () => {
    const troubleshooting: TroubleshootingData = {
      stepsCompletedJson: [
        { stepId: 'step1', requiresEvidence: true },
      ],
      evidenceJson: [],
    };
    const result = await evaluateAuthorization(baseRma, troubleshooting);
    expect(result.decision).toBe('NEEDS_REVIEW');
    expect(result.reasonCode).toBe('EVIDENCE_MISSING');
  });
});
