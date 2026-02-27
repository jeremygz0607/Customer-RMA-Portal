import { getPool } from '../db/mssql';

export interface RmaLabel {
  rmaId: string;
  easyPostShipmentId?: string | null;
  easyPostRateId?: string | null;
  carrier?: string | null;
  service?: string | null;
  trackingNumber?: string | null;
  billingMode?: string | null;
  labelFilePath?: string | null;
  labelCreatedAt?: Date | null;
}

export async function getRmaLabel(rmaId: string): Promise<RmaLabel | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query(`
      SELECT 
        RMA_ID, EasyPostShipmentId, EasyPostRateId, Carrier, Service,
        TrackingNumber, BillingMode, LabelFilePath, LabelCreatedAt
      FROM dbo.RMA_Label
      WHERE RMA_ID = @RMA_ID
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    rmaId: row.RMA_ID,
    easyPostShipmentId: row.EasyPostShipmentId || null,
    easyPostRateId: row.EasyPostRateId || null,
    carrier: row.Carrier || null,
    service: row.Service || null,
    trackingNumber: row.TrackingNumber || null,
    billingMode: row.BillingMode || null,
    labelFilePath: row.LabelFilePath || null,
    labelCreatedAt: row.LabelCreatedAt || null,
  };
}

export async function upsertRmaLabel(
  rmaId: string,
  data: Partial<RmaLabel>,
): Promise<void> {
  const pool = await getPool();

  const existing = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query('SELECT RMA_ID FROM dbo.RMA_Label WHERE RMA_ID = @RMA_ID');

  if (existing.recordset.length === 0) {
    // Insert
    await pool
      .request()
      .input('RMA_ID', rmaId)
      .input('EasyPostShipmentId', data.easyPostShipmentId || null)
      .input('EasyPostRateId', data.easyPostRateId || null)
      .input('Carrier', data.carrier || null)
      .input('Service', data.service || null)
      .input('TrackingNumber', data.trackingNumber || null)
      .input('BillingMode', data.billingMode || null)
      .input('LabelFilePath', data.labelFilePath || null)
      .input('LabelCreatedAt', data.labelCreatedAt || new Date())
      .query(`
        INSERT INTO dbo.RMA_Label (
          RMA_ID, EasyPostShipmentId, EasyPostRateId, Carrier, Service,
          TrackingNumber, BillingMode, LabelFilePath, LabelCreatedAt
        )
        VALUES (
          @RMA_ID, @EasyPostShipmentId, @EasyPostRateId, @Carrier, @Service,
          @TrackingNumber, @BillingMode, @LabelFilePath, @LabelCreatedAt
        )
      `);
  } else {
    // Update
    const updates: string[] = [];
    const request = pool.request().input('RMA_ID', rmaId);

    if (data.easyPostShipmentId !== undefined) {
      request.input('EasyPostShipmentId', data.easyPostShipmentId);
      updates.push('EasyPostShipmentId = @EasyPostShipmentId');
    }
    if (data.easyPostRateId !== undefined) {
      request.input('EasyPostRateId', data.easyPostRateId);
      updates.push('EasyPostRateId = @EasyPostRateId');
    }
    if (data.carrier !== undefined) {
      request.input('Carrier', data.carrier);
      updates.push('Carrier = @Carrier');
    }
    if (data.service !== undefined) {
      request.input('Service', data.service);
      updates.push('Service = @Service');
    }
    if (data.trackingNumber !== undefined) {
      request.input('TrackingNumber', data.trackingNumber);
      updates.push('TrackingNumber = @TrackingNumber');
    }
    if (data.billingMode !== undefined) {
      request.input('BillingMode', data.billingMode);
      updates.push('BillingMode = @BillingMode');
    }
    if (data.labelFilePath !== undefined) {
      request.input('LabelFilePath', data.labelFilePath);
      updates.push('LabelFilePath = @LabelFilePath');
    }
    if (data.labelCreatedAt !== undefined) {
      request.input('LabelCreatedAt', data.labelCreatedAt);
      updates.push('LabelCreatedAt = @LabelCreatedAt');
    }

    if (updates.length > 0) {
      await request.query(`
        UPDATE dbo.RMA_Label
        SET ${updates.join(', ')}
        WHERE RMA_ID = @RMA_ID
      `);
    }
  }
}
