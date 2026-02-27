import {
  validateFileName,
  validateFileExtension,
  validateFileSize,
} from '../services/storageService';

describe('Storage Service Validation', () => {
  describe('validateFileName', () => {
    it('should allow valid file names', () => {
      expect(validateFileName('test.jpg')).toBe(true);
      expect(validateFileName('evidence_123.png')).toBe(true);
      expect(validateFileName('file-name.pdf')).toBe(true);
    });

    it('should reject directory traversal attempts', () => {
      expect(validateFileName('../file.jpg')).toBe(false);
      expect(validateFileName('../../etc/passwd')).toBe(false);
      expect(validateFileName('file/../other.jpg')).toBe(false);
      expect(validateFileName('file\\..\\other.jpg')).toBe(false);
    });

    it('should reject paths with slashes', () => {
      expect(validateFileName('path/to/file.jpg')).toBe(false);
      expect(validateFileName('path\\to\\file.jpg')).toBe(false);
    });
  });

  describe('validateFileExtension', () => {
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'pdf'];

    it('should allow valid extensions', () => {
      expect(validateFileExtension('test.jpg', allowed)).toBe(true);
      expect(validateFileExtension('test.PNG', allowed)).toBe(true);
      expect(validateFileExtension('test.mp4', allowed)).toBe(true);
    });

    it('should reject invalid extensions', () => {
      expect(validateFileExtension('test.exe', allowed)).toBe(false);
      expect(validateFileExtension('test.js', allowed)).toBe(false);
      expect(validateFileExtension('test', allowed)).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('should allow files within size limit', () => {
      const maxSizeMB = 50;
      const sizeBytes = 25 * 1024 * 1024; // 25 MB
      expect(validateFileSize(sizeBytes, maxSizeMB)).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      const maxSizeMB = 50;
      const sizeBytes = 60 * 1024 * 1024; // 60 MB
      expect(validateFileSize(sizeBytes, maxSizeMB)).toBe(false);
    });

    it('should allow files at exact size limit', () => {
      const maxSizeMB = 50;
      const sizeBytes = 50 * 1024 * 1024; // 50 MB
      expect(validateFileSize(sizeBytes, maxSizeMB)).toBe(true);
    });
  });
});
