import { getPool } from '../db/mssql';

export interface AuditLogEntry {
  auditId: number;
  rmaId: string;
  eventType: string;
  actorType: string;
  payloadJson?: any;
  createdAt: Date;
}

export async function createAuditLogEntry(params: {
  rmaId: string;
  eventType: string;
  actorType: string;
  payloadJson?: any;
}): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input('RMA_ID', params.rmaId)
    .input('EventType', params.eventType)
    .input('ActorType', params.actorType)
    .input('PayloadJson', params.payloadJson ? JSON.stringify(params.payloadJson) : null)
    .input('CreatedAt', new Date())
    .query(`
      INSERT INTO dbo.RMA_AuditLog (RMA_ID, EventType, ActorType, PayloadJson, CreatedAt)
      VALUES (@RMA_ID, @EventType, @ActorType, @PayloadJson, @CreatedAt)
    `);
}

export async function getAuditLogForRma(rmaId: string): Promise<AuditLogEntry[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query(`
      SELECT 
        AuditId, RMA_ID, EventType, ActorType, PayloadJson, CreatedAt
      FROM dbo.RMA_AuditLog
      WHERE RMA_ID = @RMA_ID
      ORDER BY CreatedAt ASC
    `);

  return result.recordset.map((row) => ({
    auditId: row.AuditId,
    rmaId: row.RMA_ID,
    eventType: row.EventType,
    actorType: row.ActorType,
    payloadJson: row.PayloadJson ? JSON.parse(row.PayloadJson) : null,
    createdAt: row.CreatedAt,
  }));
}