import * as fs from 'fs/promises';
import * as path from 'path';
import { getConfig } from '../config/env';
import { getPool } from '../db/mssql';
import { createAuditLogEntry } from '../repositories/rmaAuditRepo';

export async function runStorageCleanup(): Promise<{ deletedFiles: number; deletedDirs: number }> {
  const config = getConfig();
  const storageRoot = config.storageRootPath;
  const retentionDays = config.storageRetentionDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedFiles = 0;
  let deletedDirs = 0;

  async function cleanupDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await cleanupDirectory(fullPath);
          // Try to remove empty directory
          try {
            const subEntries = await fs.readdir(fullPath);
            if (subEntries.length === 0) {
              await fs.rmdir(fullPath);
              deletedDirs++;
            }
          } catch {
            // Directory not empty or error, skip
          }
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(fullPath);
            deletedFiles++;
          }
        }
      }
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error(`Error cleaning up directory ${dirPath}:`, err);
      }
    }
  }

  try {
    await cleanupDirectory(storageRoot);
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error('Error in storage cleanup:', err);
    }
  }

  // Log cleanup event (use a system RMA ID or create a special audit entry)
  // For now, we'll just log to console
  console.log(`Storage cleanup completed: ${deletedFiles} files, ${deletedDirs} directories deleted`);

  return { deletedFiles, deletedDirs };
}

// Schedule this to run daily (using cron, node-cron, or Windows Task Scheduler)
export function scheduleStorageCleanup(): void {
  // Example using setInterval (for dev/testing)
  // In production, use a proper scheduler
  const intervalMs = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(async () => {
    try {
      await runStorageCleanup();
    } catch (err) {
      console.error('Storage cleanup job failed:', err);
    }
  }, intervalMs);

  // Run immediately on startup
  runStorageCleanup().catch((err) => {
    console.error('Initial storage cleanup failed:', err);
  });
}
