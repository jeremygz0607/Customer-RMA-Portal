import { getPool } from '../db/mssql';

export interface Playbook {
  skuGroupName: string;
  playbookJson: any;
  version: number;
  isActive: boolean;
  updatedAt: Date;
}

export async function getActivePlaybook(
  skuGroupName: string,
): Promise<Playbook | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('SKUGroupName', skuGroupName)
    .query(`
      SELECT TOP 1
        SKUGroupName, PlaybookJson, Version, IsActive, UpdatedAt
      FROM dbo.RMA_Playbook
      WHERE SKUGroupName = @SKUGroupName AND IsActive = 1
      ORDER BY Version DESC
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    skuGroupName: row.SKUGroupName,
    playbookJson: JSON.parse(row.PlaybookJson),
    version: row.Version,
    isActive: row.IsActive,
    updatedAt: row.UpdatedAt,
  };
}

export async function upsertPlaybook(
  skuGroupName: string,
  playbookJson: any,
  isActive: boolean = true,
): Promise<void> {
  const pool = await getPool();

  // Get current max version
  const versionResult = await pool
    .request()
    .input('SKUGroupName', skuGroupName)
    .query(`
      SELECT MAX(Version) as MaxVersion
      FROM dbo.RMA_Playbook
      WHERE SKUGroupName = @SKUGroupName
    `);

  const nextVersion = (versionResult.recordset[0]?.MaxVersion || 0) + 1;

  await pool
    .request()
    .input('SKUGroupName', skuGroupName)
    .input('PlaybookJson', JSON.stringify(playbookJson))
    .input('Version', nextVersion)
    .input('IsActive', isActive)
    .input('UpdatedAt', new Date())
    .query(`
      INSERT INTO dbo.RMA_Playbook (
        SKUGroupName, PlaybookJson, Version, IsActive, UpdatedAt
      )
      VALUES (
        @SKUGroupName, @PlaybookJson, @Version, @IsActive, @UpdatedAt
      )
    `);
}
