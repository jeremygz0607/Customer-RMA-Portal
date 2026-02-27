import { getPool } from '../db/mssql';

export interface DwOrderItem {
  orderId: string;
  orderItemId: string;
  sku: string;
  customerEmail?: string | null;
  customerId?: string | null;
  shipToCountry?: string | null;
}

export interface DwWarrantyStatus {
  orderItemId: string;
  inWarranty: boolean;
  warrantyEndDate?: Date | null;
  reasonCode?: string | null;
}

export interface DwSkuMaster {
  sku: string;
  skuGroupName: string;
}

export async function getOrderItemFromDw(
  orderItemId: string,
): Promise<DwOrderItem | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('OrderItemID', orderItemId)
    .query(`
      SELECT TOP 1
        OrderID,
        OrderItemID,
        SKU,
        CustomerEmail,
        CustomerId,
        ShipToCountry
      FROM dw.vw_OrderItems
      WHERE OrderItemID = @OrderItemID
    `);

  if (result.recordset.length === 0) return null;
  const row = result.recordset[0] as any;

  return {
    orderId: row.OrderID,
    orderItemId: row.OrderItemID,
    sku: row.SKU,
    customerEmail: row.CustomerEmail,
    customerId: row.CustomerId,
    shipToCountry: row.ShipToCountry,
  };
}

export async function getWarrantyStatusFromDw(
  orderItemId: string,
): Promise<DwWarrantyStatus | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('OrderItemID', orderItemId)
    .query(`
      SELECT TOP 1
        OrderItemID,
        InWarranty,
        WarrantyEndDate,
        ReasonCode
      FROM dw.vw_WarrantyStatus
      WHERE OrderItemID = @OrderItemID
    `);

  if (result.recordset.length === 0) return null;
  const row = result.recordset[0] as any;

  return {
    orderItemId: row.OrderItemID,
    inWarranty: Boolean(row.InWarranty),
    warrantyEndDate: row.WarrantyEndDate,
    reasonCode: row.ReasonCode,
  };
}

export async function getSkuGroupFromDw(sku: string): Promise<DwSkuMaster | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('SKU', sku)
    .query(`
      SELECT TOP 1
        SKU,
        SKUGroupName
      FROM dw.vw_SKU_Master
      WHERE SKU = @SKU
    `);

  if (result.recordset.length === 0) return null;
  const row = result.recordset[0] as any;

  return {
    sku: row.SKU,
    skuGroupName: row.SKUGroupName,
  };
}

