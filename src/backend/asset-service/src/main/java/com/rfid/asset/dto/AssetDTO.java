package com.rfid.asset.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object for Asset management with comprehensive validation and security measures.
 * Provides a secure interface for asset data transfer between service layer and API endpoints.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class AssetDTO {

    @JsonProperty("id")
    @NotNull(message = "Asset ID cannot be null")
    private UUID id;

    @NotNull(message = "RFID tag cannot be null")
    @Pattern(
        regexp = "^RF\\d{9}$",
        message = "RFID tag must be in format RF followed by 9 digits"
    )
    @JsonProperty("rfidTag")
    private String rfidTag;

    @NotNull(message = "Asset name cannot be null")
    @Size(
        min = 1,
        max = 100,
        message = "Asset name must be between 1 and 100 characters"
    )
    @Pattern(
        regexp = "^[a-zA-Z0-9\\s-_]+$",
        message = "Asset name can only contain alphanumeric characters, spaces, hyphens, and underscores"
    )
    @JsonProperty("name")
    private String name;

    @Size(
        max = 500,
        message = "Description cannot exceed 500 characters"
    )
    @JsonProperty("description")
    private String description;

    @Pattern(
        regexp = "^https?://.*$",
        message = "Image URL must be a valid HTTP(S) URL"
    )
    @JsonProperty("imageUrl")
    private String imageUrl;

    @NotNull(message = "Active status cannot be null")
    @JsonProperty("active")
    private boolean active;

    @NotNull(message = "Created timestamp cannot be null")
    @JsonProperty("createdAt")
    private LocalDateTime createdAt;

    @NotNull(message = "Updated timestamp cannot be null")
    @JsonProperty("updatedAt")
    private LocalDateTime updatedAt;

    @NotNull(message = "Current location cannot be null")
    @Valid
    @JsonProperty("currentLocation")
    private LocationDTO currentLocation;

    /**
     * Validates all fields of the DTO.
     *
     * @throws IllegalArgumentException if validation fails
     */
    public void validateFields() {
        if (rfidTag != null && !rfidTag.matches("^RF\\d{9}$")) {
            throw new IllegalArgumentException("Invalid RFID tag format");
        }
        if (name != null && !name.matches("^[a-zA-Z0-9\\s-_]+$")) {
            throw new IllegalArgumentException("Invalid asset name format");
        }
        if (imageUrl != null && !imageUrl.matches("^https?://.*$")) {
            throw new IllegalArgumentException("Invalid image URL format");
        }
        if (currentLocation != null) {
            try {
                currentLocation.validateFields();
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid location data: " + e.getMessage());
            }
        }
    }

    /**
     * Sanitizes input strings to prevent XSS and other injection attacks.
     *
     * @param input The input string to sanitize
     * @return The sanitized string
     */
    private String sanitizeString(String input) {
        if (input == null) {
            return null;
        }
        return input.replaceAll("[<>\"'&]", "");
    }

    /**
     * Updates the audit timestamps of the DTO.
     * Creates timestamps if they don't exist, updates updatedAt if they do.
     */
    public void updateTimestamps() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    /**
     * Creates a builder with pre-set audit timestamps.
     *
     * @return A new builder instance with current timestamps
     */
    public static AssetDTOBuilder builderWithTimestamps() {
        LocalDateTime now = LocalDateTime.now();
        return builder()
                .createdAt(now)
                .updatedAt(now);
    }

    /**
     * Performs a deep copy of the DTO.
     *
     * @return A new instance with copied values
     */
    public AssetDTO copy() {
        return AssetDTO.builder()
                .id(this.id)
                .rfidTag(this.rfidTag)
                .name(sanitizeString(this.name))
                .description(sanitizeString(this.description))
                .imageUrl(this.imageUrl)
                .active(this.active)
                .createdAt(this.createdAt)
                .updatedAt(this.updatedAt)
                .currentLocation(this.currentLocation)
                .build();
    }
}