package com.rfid.asset.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.rfid.asset.entity.Location;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.util.UUID;

/**
 * Data Transfer Object for Location information with comprehensive validation and security measures.
 * Provides a clean API contract for location-related operations between application layers.
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
public class LocationDTO {

    @JsonProperty("id")
    private UUID id;

    @NotNull(message = "Location name cannot be null")
    @Size(min = 2, max = 100, message = "Location name must be between 2 and 100 characters")
    @Pattern(regexp = "^[a-zA-Z0-9\\s-_]+$", message = "Location name can only contain alphanumeric characters, spaces, hyphens, and underscores")
    @JsonProperty("name")
    private String name;

    @NotNull(message = "Zone cannot be null")
    @Size(min = 2, max = 50, message = "Zone must be between 2 and 50 characters")
    @Pattern(regexp = "^[A-Z0-9-]+$", message = "Zone must contain only uppercase letters, numbers, and hyphens")
    @JsonProperty("zone")
    private String zone;

    @JsonProperty("coordinates")
    private CoordinatesDTO coordinates;

    @Size(max = 500, message = "Annotation cannot exceed 500 characters")
    @JsonProperty("annotation")
    private String annotation;

    @JsonProperty("active")
    private boolean active;

    /**
     * Converts this DTO to a Location entity with validation.
     *
     * @return A validated Location entity instance
     * @throws IllegalArgumentException if validation fails
     */
    public Location toEntity() {
        validateFields();
        
        Location location = new Location();
        location.setId(this.id);
        location.setName(sanitizeString(this.name));
        location.setZone(this.zone.toUpperCase());
        
        if (this.coordinates != null) {
            location.setCoordinates(new Location.Coordinates(
                this.coordinates.getLatitude(),
                this.coordinates.getLongitude(),
                0.0 // Default elevation as per requirements
            ));
        }
        
        location.setAnnotation(sanitizeString(this.annotation));
        location.setActive(this.active);
        
        return location;
    }

    /**
     * Creates a LocationDTO instance from a Location entity.
     *
     * @param location The source Location entity
     * @return A validated LocationDTO instance
     * @throws IllegalArgumentException if the location entity is invalid
     */
    public static LocationDTO fromEntity(Location location) {
        if (location == null) {
            throw new IllegalArgumentException("Location entity cannot be null");
        }

        return LocationDTO.builder()
                .id(location.getId())
                .name(sanitizeString(location.getName()))
                .zone(location.getZone())
                .coordinates(location.getCoordinates() != null ? 
                    new CoordinatesDTO(
                        location.getCoordinates().getLatitude(),
                        location.getCoordinates().getLongitude()
                    ) : null)
                .annotation(sanitizeString(location.getAnnotation()))
                .active(location.isActive())
                .build();
    }

    /**
     * Validates all fields of the DTO.
     *
     * @throws IllegalArgumentException if validation fails
     */
    private void validateFields() {
        if (name != null && !name.matches("^[a-zA-Z0-9\\s-_]+$")) {
            throw new IllegalArgumentException("Invalid location name format");
        }
        if (zone != null && !zone.matches("^[A-Z0-9-]+$")) {
            throw new IllegalArgumentException("Invalid zone format");
        }
        if (coordinates != null && !coordinates.validate()) {
            throw new IllegalArgumentException("Invalid coordinates");
        }
    }

    /**
     * Sanitizes input strings to prevent XSS and other injection attacks.
     *
     * @param input The input string to sanitize
     * @return The sanitized string
     */
    private static String sanitizeString(String input) {
        if (input == null) {
            return null;
        }
        return input.replaceAll("[<>\"'&]", "");
    }
}

/**
 * DTO for geographic coordinates with validation.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
class CoordinatesDTO {
    
    @JsonProperty("latitude")
    private double latitude;
    
    @JsonProperty("longitude")
    private double longitude;

    /**
     * Validates coordinate values.
     *
     * @return true if coordinates are valid, false otherwise
     */
    public boolean validate() {
        return latitude >= -90 && latitude <= 90 &&
               longitude >= -180 && longitude <= 180;
    }
}