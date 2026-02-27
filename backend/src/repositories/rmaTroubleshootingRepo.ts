import { getPool } from '../db/mssql';

export interface TroubleshootingData {
  symptomsJson?: any;
  stepsCompletedJson?: any;
  evidenceJson?: any;
  customerOptedOutOfTS?: boolean;
  aiSummary?: string;
  aiRecommendation?: string;
  aiConfidence?: number;
}

export async function getTroubleshootingData(
  rmaId: string,
): Promise<TroubleshootingData | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query(`
      SELECT 
        SymptomsJson, StepsCompletedJson, EvidenceJson,
        CustomerOptedOutOfTS, AISummary, AIRecommendation, AIConfidence
      FROM dbo.RMA_Troubleshooting
      WHERE RMA_ID = @RMA_ID
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    symptomsJson: row.SymptomsJson ? JSON.parse(row.SymptomsJson) : null,
    stepsCompletedJson: row.StepsCompletedJson
      ? JSON.parse(row.StepsCompletedJson)
      : null,
    evidenceJson: row.EvidenceJson ? JSON.parse(row.EvidenceJson) : null,
    customerOptedOutOfTS: row.CustomerOptedOutOfTS || false,
    aiSummary: row.AISummary || undefined,
    aiRecommendation: row.AIRecommendation || undefined,
    aiConfidence: row.AIConfidence || undefined,
  };
}

export async function upsertTroubleshootingData(
  rmaId: string,
  data: Partial<TroubleshootingData>,
): Promise<void> {
  const pool = await getPool();

  // Check if exists
  const existing = await pool
    .request()
    .input('RMA_ID', rmaId)
    .query('SELECT RMA_ID FROM dbo.RMA_Troubleshooting WHERE RMA_ID = @RMA_ID');

  if (existing.recordset.length === 0) {
    // Insert
    await pool
      .request()
      .input('RMA_ID', rmaId)
      .input('SymptomsJson', data.symptomsJson ? JSON.stringify(data.symptomsJson) : null)
      .input('StepsCompletedJson', data.stepsCompletedJson ? JSON.stringify(data.stepsCompletedJson) : null)
      .input('EvidenceJson', data.evidenceJson ? JSON.stringify(data.evidenceJson) : null)
      .input('CustomerOptedOutOfTS', data.customerOptedOutOfTS || false)
      .input('AISummary', data.aiSummary || null)
      .input('AIRecommendation', data.aiRecommendation || null)
      .input('AIConfidence', data.aiConfidence || null)
      .query(`
        INSERT INTO dbo.RMA_Troubleshooting (
          RMA_ID, SymptomsJson, StepsCompletedJson, EvidenceJson,
          CustomerOptedOutOfTS, AISummary, AIRecommendation, AIConfidence
        )
        VALUES (
          @RMA_ID, @SymptomsJson, @StepsCompletedJson, @EvidenceJson,
          @CustomerOptedOutOfTS, @AISummary, @AIRecommendation, @AIConfidence
        )
      `);
  } else {
    // Update
    const updates: string[] = [];
    const request = pool.request().input('RMA_ID', rmaId);

    if (data.symptomsJson !== undefined) {
      request.input('SymptomsJson', JSON.stringify(data.symptomsJson));
      updates.push('SymptomsJson = @SymptomsJson');
    }
    if (data.stepsCompletedJson !== undefined) {
      request.input('StepsCompletedJson', JSON.stringify(data.stepsCompletedJson));
      updates.push('StepsCompletedJson = @StepsCompletedJson');
    }
    if (data.evidenceJson !== undefined) {
      request.input('EvidenceJson', JSON.stringify(data.evidenceJson));
      updates.push('EvidenceJson = @EvidenceJson');
    }
    if (data.customerOptedOutOfTS !== undefined) {
      request.input('CustomerOptedOutOfTS', data.customerOptedOutOfTS);
      updates.push('CustomerOptedOutOfTS = @CustomerOptedOutOfTS');
    }
    if (data.aiSummary !== undefined) {
      request.input('AISummary', data.aiSummary);
      updates.push('AISummary = @AISummary');
    }
    if (data.aiRecommendation !== undefined) {
      request.input('AIRecommendation', data.aiRecommendation);
      updates.push('AIRecommendation = @AIRecommendation');
    }
    if (data.aiConfidence !== undefined) {
      request.input('AIConfidence', data.aiConfidence);
      updates.push('AIConfidence = @AIConfidence');
    }

    if (updates.length > 0) {
      await request.query(`
        UPDATE dbo.RMA_Troubleshooting
        SET ${updates.join(', ')}
        WHERE RMA_ID = @RMA_ID
      `);
    }
  }
}
