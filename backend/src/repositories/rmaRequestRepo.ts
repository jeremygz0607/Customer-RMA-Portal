import { v4 as uuid } from 'uuid';
import { getPool } from '../db/mssql';
import { RmaStatus } from '../domain/rmaStatus';

export interface CreateRmaRequestParams {
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  skuGroupName: string;
  isInternational: boolean;
  warrantyEligible: boolean;
  warrantyEndDate?: Date | null;
  warrantyReasonCode?: string | null;
}

export interface RmaRequest {
  rmaId: string;
  brand: string;
  orderId: string;
  orderItemId: string;
  sku: string;
  skuGroupName: string;
  isInternational: boolean;
  warrantyEligible: boolean;
  warrantyEndDate?: Date | null;
  warrantyReasonCode?: string | null;
  status: RmaStatus;
  customerSelectedReturnMethod?: string | null;
  carrierPreference?: string | null;
  benchTestFeeAmount: number;
  acceptedBenchFeeTerms: boolean;
  acceptedAt?: Date | null;
  acceptedIP?: string | null;
  acceptedUserAgent?: string | null;
  hubSpotDealId?: string | null;
  hubSpotTicketId?: string | null;
  hubSpotContactId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createRmaRequest(
  params: CreateRmaRequestParams,
): Promise<RmaRequest> {
  const pool = await getPool();
  const rmaId = uuid();
  const now = new Date();

  await pool
    .request()
    .input('RMA_ID', rmaId)
    .input('Brand', params.brand)
    .input('OrderID', params.orderId)
    .input('OrderItemID', params.orderItemId)
    .input('SKU', params.sku)
    .input('SKUGroupName', params.skuGroupName)
    .input('IsInternational', params.isInternational)
    .input('WarrantyEligible', params.warrantyEligible)
    .input('WarrantyEndDate', params.warrantyEndDate || null)
    .input('WarrantyReasonCode', params.warrantyReasonCode || null)
    .input('Status', 'STARTED')
    .input('CreatedAt', now)
    .input('UpdatedAt', now)
    .query(`
      INSERT INTO dbo.RMA_Request (
        RMA_ID, Brand, OrderID, OrderItemID, SKU, SKUGroupName,
        IsInternational, WarrantyEligible, WarrantyEndDate, WarrantyReasonCode,
        Status, CreatedAt, UpdatedAt
      )
      VALUES (
        @RMA_ID, @Brand, @OrderID, @OrderItemID, @SKU, @SKUGroupName,
        @IsInternational, @WarrantyEligible, @WarrantyEndDate, @WarrantyReasonCode,
        @Status, @CreatedAt, @UpdatedAt
      )
    `);

  return {
    rmaId,
    brand: params.brand,
    orderId: params.orderId,
    orderItemId: params.orderItemId,
    sku: params.sku,
    skuGroupName: params.skuGroupName,
    isInternational: params.isInternational,
    warrantyEligible: params.warrantyEligible,
    warrantyEndDate: params.warrantyEndDate || null,
    warrantyReasonCode: params.warrantyReasonCode || null,
    status: 'STARTED',
    benchTestFeeAmount: 39.99,
    acceptedBenchFeeTerms: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getRmaRequest(rmaId: string): Promise<RmaRequest | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query(`
      SELECT 
        RMA_ID, Brand, OrderID, OrderItemID, SKU, SKUGroupName,
        IsInternational, WarrantyEligible, WarrantyEndDate, WarrantyReasonCode,
        Status, CustomerSelectedReturnMethod, CarrierPreference,
        BenchTestFeeAmount, AcceptedBenchFeeTerms, AcceptedAt, AcceptedIP, AcceptedUserAgent,
        HubSpotDealId, HubSpotTicketId, HubSpotContactId,
        CreatedAt, UpdatedAt
      FROM dbo.RMA_Request
      WHERE RMA_ID = @RMA_ID
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    rmaId: row.RMA_ID,
    brand: row.Brand,
    orderId: row.OrderID,
    orderItemId: row.OrderItemID,
    sku: row.SKU,
    skuGroupName: row.SKUGroupName,
    isInternational: row.IsInternational,
    warrantyEligible: row.WarrantyEligible,
    warrantyEndDate: row.WarrantyEndDate || null,
    warrantyReasonCode: row.WarrantyReasonCode || null,
    status: row.Status as RmaStatus,
    customerSelectedReturnMethod: row.CustomerSelectedReturnMethod || null,
    carrierPreference: row.CarrierPreference || null,
    benchTestFeeAmount: row.BenchTestFeeAmount,
    acceptedBenchFeeTerms: row.AcceptedBenchFeeTerms,
    acceptedAt: row.AcceptedAt || null,
    acceptedIP: row.AcceptedIP || null,
    acceptedUserAgent: row.AcceptedUserAgent || null,
    hubSpotDealId: row.HubSpotDealId || null,
    hubSpotTicketId: row.HubSpotTicketId || null,
    hubSpotContactId: row.HubSpotContactId || null,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

export async function updateRmaRequestStatus(
  rmaId: string,
  status: RmaStatus,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('RMA_ID', rmaId)
    .input('Status', status)
    .input('UpdatedAt', new Date())
    .query(`
      UPDATE dbo.RMA_Request
      SET Status = @Status, UpdatedAt = @UpdatedAt
      WHERE RMA_ID = @RMA_ID
    `);
}

export async function updateRmaRequestTerms(
  rmaId: string,
  acceptedIP: string,
  acceptedUserAgent: string,
): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('RMA_ID', rmaId)
    .input('AcceptedBenchFeeTerms', true)
    .input('AcceptedAt', new Date())
    .input('AcceptedIP', acceptedIP)
    .input('AcceptedUserAgent', acceptedUserAgent)
    .input('UpdatedAt', new Date())
    .query(`
      UPDATE dbo.RMA_Request
      SET 
        AcceptedBenchFeeTerms = @AcceptedBenchFeeTerms,
        AcceptedAt = @AcceptedAt,
        AcceptedIP = @AcceptedIP,
        AcceptedUserAgent = @AcceptedUserAgent,
        UpdatedAt = @UpdatedAt
      WHERE RMA_ID = @RMA_ID
    `);
}

export async function updateRmaRequestHubSpot(
  rmaId: string,
  ticketId?: string,
  contactId?: string,
  dealId?: string,
): Promise<void> {
  const pool = await getPool();
  const updates: string[] = [];
  const request = pool.request().input('RMA_ID', rmaId);

  if (ticketId !== undefined) {
    request.input('HubSpotTicketId', ticketId);
    updates.push('HubSpotTicketId = @HubSpotTicketId');
  }
  if (contactId !== undefined) {
    request.input('HubSpotContactId', contactId);
    updates.push('HubSpotContactId = @HubSpotContactId');
  }
  if (dealId !== undefined) {
    request.input('HubSpotDealId', dealId);
    updates.push('HubSpotDealId = @HubSpotDealId');
  }

  if (updates.length > 0) {
    request.input('UpdatedAt', new Date());
    updates.push('UpdatedAt = @UpdatedAt');
    await request.query(`
      UPDATE dbo.RMA_Request
      SET ${updates.join(', ')}
      WHERE RMA_ID = @RMA_ID
    `);
  }
}