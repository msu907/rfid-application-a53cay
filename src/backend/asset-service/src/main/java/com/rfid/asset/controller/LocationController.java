package com.rfid.asset.controller;

import com.rfid.asset.dto.LocationDTO;
import com.rfid.asset.service.LocationService;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * REST controller for managing locations in the RFID asset tracking system.
 * Provides endpoints for location CRUD operations, spatial queries, and hierarchy management.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@RestController
@RequestMapping("/api/v1/locations")
@CacheConfig(cacheNames = "locations")
@Validated
@Tag(name = "Location Management", description = "APIs for location management and spatial queries")
@Slf4j
public class LocationController {

    private final LocationService locationService;

    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create new location", description = "Creates a new location with validation")
    @ApiResponse(responseCode = "201", description = "Location created successfully")
    @RateLimiter(name = "locationCreation")
    public ResponseEntity<LocationDTO> createLocation(@Valid @RequestBody LocationDTO locationDTO) {
        log.info("Creating new location: {}", locationDTO.getName());
        LocationDTO created = locationService.createLocation(locationDTO);
        return ResponseEntity
                .created(URI.create("/api/v1/locations/" + created.getId()))
                .body(created);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Operation(summary = "Get location by ID", description = "Retrieves location details by ID")
    @ApiResponse(responseCode = "200", description = "Location found")
    public ResponseEntity<LocationDTO> getLocation(@PathVariable UUID id) {
        log.debug("Retrieving location with ID: {}", id);
        return ResponseEntity.ok(locationService.getLocationById(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Update location", description = "Updates an existing location")
    @ApiResponse(responseCode = "200", description = "Location updated successfully")
    @RateLimiter(name = "locationUpdate")
    public ResponseEntity<LocationDTO> updateLocation(
            @PathVariable UUID id,
            @Valid @RequestBody LocationDTO locationDTO) {
        log.info("Updating location with ID: {}", id);
        return ResponseEntity.ok(locationService.updateLocation(id, locationDTO));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Deactivate location", description = "Deactivates location and its children")
    @ApiResponse(responseCode = "204", description = "Location deactivated successfully")
    public ResponseEntity<Void> deactivateLocation(@PathVariable UUID id) {
        log.info("Deactivating location with ID: {}", id);
        locationService.deactivateLocation(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/zone/{zone}")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Operation(summary = "Get locations by zone", description = "Retrieves all locations in a zone")
    @ApiResponse(responseCode = "200", description = "Locations retrieved successfully")
    public ResponseEntity<List<LocationDTO>> getLocationsByZone(@PathVariable String zone) {
        log.debug("Retrieving locations for zone: {}", zone);
        return ResponseEntity.ok(locationService.getLocationsByZone(zone));
    }

    @GetMapping("/nearby")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Operation(summary = "Find nearby locations", description = "Finds locations within specified radius")
    @ApiResponse(responseCode = "200", description = "Nearby locations found")
    public ResponseEntity<List<LocationDTO>> findNearbyLocations(
            @Parameter(description = "Latitude coordinate")
            @RequestParam @Min(-90) @Max(90) double latitude,
            @Parameter(description = "Longitude coordinate")
            @RequestParam @Min(-180) @Max(180) double longitude,
            @Parameter(description = "Search radius in meters")
            @RequestParam @Min(0) @Max(10000) double radius) {
        log.debug("Finding locations near ({}, {}) within {} meters", latitude, longitude, radius);
        return ResponseEntity.ok(locationService.findNearbyLocations(latitude, longitude, radius));
    }

    @GetMapping("/active")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Operation(summary = "Get active locations", description = "Retrieves all active locations with pagination")
    @ApiResponse(responseCode = "200", description = "Active locations retrieved successfully")
    public ResponseEntity<Page<LocationDTO>> getActiveLocations(Pageable pageable) {
        log.debug("Retrieving active locations, page: {}", pageable.getPageNumber());
        return ResponseEntity.ok(locationService.getActiveLocations(pageable));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    @Operation(summary = "Search locations", description = "Searches locations by name pattern")
    @ApiResponse(responseCode = "200", description = "Search results retrieved successfully")
    public ResponseEntity<List<LocationDTO>> searchLocations(
            @Parameter(description = "Name pattern to search for")
            @RequestParam String name) {
        log.debug("Searching locations with name pattern: {}", name);
        return ResponseEntity.ok(locationService.searchLocationsByName(name));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleException(Exception e) {
        log.error("Error processing location request", e);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Error processing location request: " + e.getMessage());
    }
}