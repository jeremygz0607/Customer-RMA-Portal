import {
  createRmaRequest,
  CreateRmaRequestParams,
} from '../repositories/rmaRequestRepo';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';
import { getOrderItemFromDw, getSkuGroupFromDw, getWarrantyStatusFromDw } from '../dw/dwAdapter';
import { signSessionToken } from './sessionTokenService';

interface StartRmaInput {
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  customer: {
    id?: string;
    email?: string;
  };
}

export async function startRmaSession(input: StartRmaInput) {
  // 1) Ownership validation
  const dwOrderItem = await getOrderItemFromDw(input.orderItemId);

  if (!dwOrderItem || dwOrderItem.orderId !== input.orderId || dwOrderItem.sku !== input.sku) {
    // Cannot validate ownership
    throw Object.assign(new Error("We can't validate this order item."), {
      status: 400,
      code: 'OWNERSHIP_VALIDATION_FAILED',
    });
  }

  if (
    input.customer.email &&
    dwOrderItem.customerEmail &&
    input.customer.email.toLowerCase() !== dwOrderItem.customerEmail.toLowerCase()
  ) {
    throw Object.assign(new Error("We can't validate this order item."), {
      status: 400,
      code: 'OWNERSHIP_VALIDATION_FAILED',
    });
  }

  // 2) Warranty + SKUGroup
  const [warranty, skuMaster] = await Promise.all([
    getWarrantyStatusFromDw(input.orderItemId),
    getSkuGroupFromDw(input.sku),
  ]);

  const warrantyEligible = warranty ? warranty.inWarranty : false;
  const warrantyEndDate = warranty?.warrantyEndDate ?? null;
  const warrantyReasonCode = warranty?.reasonCode ?? null;
  const skuGroupName = skuMaster?.skuGroupName || 'DEFAULT';

  const isInternational = (dwOrderItem.shipToCountry || '').toUpperCase() !== 'US';

  const createParams: CreateRmaRequestParams = {
    brand: input.brand,
    orderId: input.orderId,
    orderItemId: input.orderItemId,
    sku: input.sku,
    skuGroupName,
    isInternational,
    warrantyEligible,
    warrantyEndDate: warrantyEndDate || undefined,
    warrantyReasonCode: warrantyReasonCode || undefined,
  };

  // 3) Create RMA operational row
  const rma = await createRmaRequest(createParams);

  // 4) Create HubSpot ticket and associate
  try {
    const { createHubSpotTicketForRma } = await import('./hubspotService');
    await createHubSpotTicketForRma(rma.rmaId);
  } catch (err) {
    // Log but don't fail - HubSpot is not critical path
    console.error('Failed to create HubSpot ticket:', err);
  }

  // 5) Audit logs
  await createAuditLogEntry({
    rmaId: rma.rmaId,
    eventType: 'RMA_STARTED',
    actorType: 'SYSTEM',
    payloadJson: {
      brand: rma.brand,
      orderId: rma.orderId,
      orderItemId: rma.orderItemId,
      sku: rma.sku,
      skuGroupName: rma.skuGroupName,
      isInternational: rma.isInternational,
      warrantyEligible: rma.warrantyEligible,
    },
  });

  await createAuditLogEntry({
    rmaId: rma.rmaId,
    eventType: 'WARRANTY_CHECKED',
    actorType: 'SYSTEM',
    payloadJson: {
      warrantyEligible,
      warrantyEndDate,
      warrantyReasonCode,
    },
  });

  const token = signSessionToken({
    rmaId: rma.rmaId,
    customerEmail: input.customer.email,
    customerId: input.customer.id,
  });

  return {
    rmaId: rma.rmaId,
    rmaSessionToken: token,
    warrantyEligible,
    skuGroupName,
    nextAction: 'TROUBLESHOOTING',
  };
}

