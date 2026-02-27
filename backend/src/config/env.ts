import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  jwtSecret: string;
  jwtTtlMinutes: number;
  sql: {
    server: string;
    database: string;
    user: string;
    password: string;
    options: {
      encrypt: boolean;
    };
  };
  storageRootPath: string;
  storageRetentionDays: number;
  maxUploadSizeMB: number;
  allowedExtensions: string[];
  returnAddressStreet1: string;
  returnAddressCity: string;
  returnAddressState: string;
  returnAddressZip: string;
  uspsPayOnDeliveryEnabled: boolean;
  hubspot: {
    apiKey?: string;
    portalId?: string;
  };
  easypost: {
    apiKey?: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtTtlMinutes: parseInt(process.env.JWT_TTL_MINUTES || '15', 10),
  sql: {
    server: process.env.SQL_SERVER || 'localhost',
    database: process.env.SQL_DATABASE || 'RMA',
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || 'yourStrong(!)Password',
    options: {
      encrypt: process.env.SQL_ENCRYPT === 'true',
    },
  },
  storageRootPath: process.env.STORAGE_ROOT_PATH || 'D:\\rma_storage',
  storageRetentionDays: parseInt(process.env.STORAGE_RETENTION_DAYS || '365', 10),
  maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '50', 10),
  allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,webp,mp4,mov,pdf').split(','),
  returnAddressStreet1: process.env.RETURN_ADDRESS_STREET1 || '123 Return St',
  returnAddressCity: process.env.RETURN_ADDRESS_CITY || 'Return City',
  returnAddressState: process.env.RETURN_ADDRESS_STATE || 'CA',
  returnAddressZip: process.env.RETURN_ADDRESS_ZIP || '90210',
  uspsPayOnDeliveryEnabled: process.env.USPS_PAY_ON_DELIVERY_ENABLED === 'true',
  hubspot: {
    apiKey: process.env.HUBSPOT_API_KEY,
    portalId: process.env.HUBSPOT_PORTAL_ID,
  },
  easypost: {
    apiKey: process.env.EASYPOST_API_KEY,
  },
};

export function getConfig(): Config {
  return config;
}
