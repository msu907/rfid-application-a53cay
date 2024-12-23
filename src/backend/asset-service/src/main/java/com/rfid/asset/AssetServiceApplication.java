package com.rfid.asset;

import org.springframework.boot.SpringApplication;                     // Spring Boot 3.0.0
import org.springframework.boot.autoconfigure.SpringBootApplication;   // Spring Boot 3.0.0
import org.springframework.cloud.client.discovery.EnableDiscoveryClient; // Spring Cloud 4.0.0

/**
 * Main application class for the RFID Asset Tracking System's Asset Service.
 * This service provides centralized asset management capabilities including:
 * - Asset information storage and retrieval
 * - Image storage management
 * - Asset metadata handling
 * - Location tracking
 * 
 * The service is designed to be discoverable by other system components through
 * service registry integration and provides comprehensive auto-configuration
 * through Spring Boot.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@SpringBootApplication(scanBasePackages = "com.rfid.asset")
@EnableDiscoveryClient
public class AssetServiceApplication {

    /**
     * Main entry point for the Asset Service application.
     * Bootstraps the Spring Boot application with necessary configuration for:
     * - Component scanning
     * - Auto-configuration
     * - Service discovery registration
     * - Database connections
     * - Application context initialization
     *
     * @param args Command line arguments passed to the application
     */
    public static void main(String[] args) {
        // Configure and launch the Spring Boot application
        SpringApplication.run(AssetServiceApplication.class, args);
    }
}