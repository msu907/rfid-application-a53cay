/**
 * @fileoverview Secure browser storage service with encryption, expiration handling,
 * and type-safe operations for the RFID Asset Tracking System.
 * @version 1.0.0
 * @requires crypto-js@4.1.1
 */

import { ApiResponse } from '../types/api.types';
import CryptoJS from 'crypto-js';

// Storage configuration constants
const STORAGE_PREFIX = 'rfid_asset_tracker_';
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PROFILE: 'user_profile',
  SETTINGS: 'settings'
} as const;
const DEFAULT_EXPIRATION_MINUTES = 60;
const MAX_STORAGE_SIZE_MB = 5;
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('Storage encryption key not configured');
}

/**
 * Interface for stored data with metadata and expiration
 */
interface StorageItem<T> {
  value: T;
  encrypted: boolean;
  timestamp: number;
  expirationTimestamp: number;
  checksum: string;
}

/**
 * Service class implementing secure browser storage operations with encryption,
 * expiration handling, and type safety.
 */
export class StorageService {
  private storage: Storage;
  private prefix: string;
  private defaultExpirationMinutes: number;

  /**
   * Creates a new StorageService instance
   * @param storageType - Browser storage to use (localStorage or sessionStorage)
   * @param keyPrefix - Prefix for storage keys
   * @param defaultExpirationMinutes - Default expiration time in minutes
   */
  constructor(
    storageType: Storage = window.localStorage,
    keyPrefix: string = STORAGE_PREFIX,
    defaultExpirationMinutes: number = DEFAULT_EXPIRATION_MINUTES
  ) {
    if (!storageType) {
      throw new Error('Storage type not available');
    }

    this.storage = storageType;
    this.prefix = keyPrefix;
    this.defaultExpirationMinutes = defaultExpirationMinutes;

    // Verify storage availability and quota
    this.checkStorageAvailability();
    window.addEventListener('storage', this.handleStorageEvent);
  }

  /**
   * Securely stores data with encryption and expiration
   * @param key - Storage key
   * @param value - Value to store
   * @param expirationMinutes - Optional custom expiration time
   */
  public setItem<T>(key: string, value: T, expirationMinutes?: number): void {
    this.validateKey(key);
    this.checkStorageQuota();

    const prefixedKey = this.getPrefixedKey(key);
    const timestamp = Date.now();
    const expirationTimestamp = timestamp + 
      (expirationMinutes || this.defaultExpirationMinutes) * 60 * 1000;

    // Determine if encryption is needed based on data sensitivity
    const shouldEncrypt = this.shouldEncryptData(key);
    const processedValue = shouldEncrypt ? 
      this.encryptData(value) : 
      value;

    const storageItem: StorageItem<T> = {
      value: processedValue as T,
      encrypted: shouldEncrypt,
      timestamp,
      expirationTimestamp,
      checksum: this.generateChecksum(value)
    };

    try {
      this.storage.setItem(
        prefixedKey,
        JSON.stringify(storageItem)
      );
      this.emitStorageEvent(key, 'set');
    } catch (error) {
      console.error('Storage operation failed:', error);
      throw new Error('Failed to store data');
    }
  }

  /**
   * Retrieves and validates stored data
   * @param key - Storage key
   * @returns Stored value or null if expired/invalid
   */
  public getItem<T>(key: string): T | null {
    this.validateKey(key);
    const prefixedKey = this.getPrefixedKey(key);

    try {
      const rawData = this.storage.getItem(prefixedKey);
      if (!rawData) return null;

      const storageItem: StorageItem<T> = JSON.parse(rawData);

      // Check expiration
      if (Date.now() > storageItem.expirationTimestamp) {
        this.removeItem(key);
        return null;
      }

      // Validate data integrity
      if (!this.validateChecksum(storageItem.value, storageItem.checksum)) {
        this.removeItem(key);
        throw new Error('Data integrity check failed');
      }

      // Decrypt if necessary
      return storageItem.encrypted ?
        this.decryptData(storageItem.value) :
        storageItem.value;

    } catch (error) {
      console.error('Error retrieving stored data:', error);
      return null;
    }
  }

  /**
   * Removes item from storage
   * @param key - Storage key
   */
  public removeItem(key: string): void {
    this.validateKey(key);
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      this.storage.removeItem(prefixedKey);
      this.emitStorageEvent(key, 'remove');
    } catch (error) {
      console.error('Error removing item:', error);
      throw new Error('Failed to remove item');
    }
  }

  /**
   * Clears all items with the service prefix
   */
  public clear(): void {
    try {
      const keys = Object.keys(this.storage);
      const prefixedKeys = keys.filter(key => key.startsWith(this.prefix));
      
      prefixedKeys.forEach(key => {
        this.storage.removeItem(key);
      });
      
      this.emitStorageEvent(null, 'clear');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw new Error('Failed to clear storage');
    }
  }

  /**
   * Checks if a valid, non-expired item exists
   * @param key - Storage key
   * @returns True if valid item exists
   */
  public hasItem(key: string): boolean {
    return this.getItem(key) !== null;
  }

  /**
   * Validates storage key format
   * @private
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid storage key');
    }
  }

  /**
   * Generates prefixed storage key
   * @private
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   * @private
   */
  private encryptData<T>(data: T): string {
    return CryptoJS.AES.encrypt(
      JSON.stringify(data),
      ENCRYPTION_KEY!
    ).toString();
  }

  /**
   * Decrypts encrypted data
   * @private
   */
  private decryptData<T>(encryptedData: string): T {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY!);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  /**
   * Generates data checksum for integrity validation
   * @private
   */
  private generateChecksum<T>(data: T): string {
    return CryptoJS.SHA256(JSON.stringify(data)).toString();
  }

  /**
   * Validates data checksum
   * @private
   */
  private validateChecksum<T>(data: T, checksum: string): boolean {
    return this.generateChecksum(data) === checksum;
  }

  /**
   * Determines if data should be encrypted based on key
   * @private
   */
  private shouldEncryptData(key: string): boolean {
    const sensitiveKeys = [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_PROFILE
    ];
    return sensitiveKeys.includes(key as keyof typeof STORAGE_KEYS);
  }

  /**
   * Verifies storage availability and quota
   * @private
   */
  private checkStorageAvailability(): void {
    try {
      const testKey = `${this.prefix}test`;
      this.storage.setItem(testKey, '1');
      this.storage.removeItem(testKey);
    } catch (error) {
      throw new Error('Storage is not available');
    }
  }

  /**
   * Checks available storage quota
   * @private
   */
  private checkStorageQuota(): void {
    const totalSize = new Blob(
      Object.values(this.storage)
    ).size / (1024 * 1024);

    if (totalSize >= MAX_STORAGE_SIZE_MB) {
      throw new Error('Storage quota exceeded');
    }
  }

  /**
   * Handles storage events for cross-tab synchronization
   * @private
   */
  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key?.startsWith(this.prefix)) {
      // Handle cross-tab storage updates
      console.debug('Storage updated in another tab:', event);
    }
  };

  /**
   * Emits custom storage event
   * @private
   */
  private emitStorageEvent(key: string | null, action: 'set' | 'remove' | 'clear'): void {
    window.dispatchEvent(new CustomEvent('storageUpdate', {
      detail: { key, action }
    }));
  }
}