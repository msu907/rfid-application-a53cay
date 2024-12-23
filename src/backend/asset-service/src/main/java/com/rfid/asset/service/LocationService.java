package com.rfid.asset.service;

import com.rfid.asset.entity.Location;
import com.rfid.asset.repository.LocationRepository;
import com.rfid.asset.dto.LocationDTO;
import com.rfid.asset.exception.LocationException;
import com.rfid.asset.mapper.LocationMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.time.LocalDateTime;

/**
 * Service class implementing business logic for location management in the RFID asset tracking system.
 * Provides optimized spatial queries, hierarchical location management, and caching support.
 * 
 * @version 1.0
 */
@Service
@Transactional(isolation = Isolation.READ_COMMITTED)
@Slf4j
public class LocationService {

    private final LocationRepository locationRepository;
    private final CacheManager cacheManager;
    private final LocationMapper locationMapper;

    /**
     * Constructs LocationService with required dependencies.
     * 
     * @param locationRepository Repository for location data access
     * @param cacheManager Cache manager for location data caching
     * @param locationMapper Mapper for DTO conversions
     */
    public LocationService(
            LocationRepository locationRepository,
            CacheManager cacheManager,
            LocationMapper locationMapper) {
        this.locationRepository = locationRepository;
        this.cacheManager = cacheManager;
        this.locationMapper = locationMapper;
    }

    /**
     * Finds locations near specified coordinates with spatial indexing support.
     * Results are cached for improved performance.
     * 
     * @param latitude Latitude coordinate
     * @param longitude Longitude coordinate
     * @param radiusInMeters Search radius in meters
     * @return List of nearby locations ordered by distance
     * @throws IllegalArgumentException if coordinates are invalid
     */
    @Cacheable(value = "nearbyLocations", key = "{#latitude, #longitude, #radiusInMeters}")
    @Transactional(readOnly = true)
    public List<LocationDTO> findNearbyLocations(double latitude, double longitude, double radiusInMeters) {
        log.debug("Finding locations near coordinates: ({}, {}) within {} meters", latitude, longitude, radiusInMeters);
        
        validateCoordinates(latitude, longitude);
        validateRadius(radiusInMeters);

        List<Location> nearbyLocations = locationRepository.findByCoordinatesNear(
            latitude, longitude, radiusInMeters
        );

        return nearbyLocations.stream()
                .map(locationMapper::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Creates a new location with validation and hierarchy management.
     * 
     * @param locationDTO Location data for creation
     * @return Created location DTO
     * @throws LocationException if validation fails
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @CacheEvict(value = {"zoneLocations", "activeLocations"}, allEntries = true)
    public LocationDTO createLocation(LocationDTO locationDTO) {
        log.info("Creating new location: {}", locationDTO.getName());
        
        validateLocationDTO(locationDTO);
        Location location = locationMapper.toEntity(locationDTO);
        
        if (locationDTO.getParentId() != null) {
            Location parent = locationRepository.findById(locationDTO.getParentId())
                .orElseThrow(() -> new LocationException("Parent location not found"));
            location.setParent(parent);
        }

        location.setActive(true);
        location.setCreatedAt(LocalDateTime.now());
        Location savedLocation = locationRepository.save(location);
        
        log.info("Created location with ID: {}", savedLocation.getId());
        return locationMapper.toDTO(savedLocation);
    }

    /**
     * Updates an existing location with optimistic locking.
     * 
     * @param id Location ID
     * @param locationDTO Updated location data
     * @return Updated location DTO
     * @throws LocationException if location not found or update fails
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @CacheEvict(value = {"zoneLocations", "activeLocations", "nearbyLocations"}, allEntries = true)
    public LocationDTO updateLocation(UUID id, LocationDTO locationDTO) {
        log.info("Updating location with ID: {}", id);
        
        Location existingLocation = locationRepository.findById(id)
            .orElseThrow(() -> new LocationException("Location not found"));
        
        validateLocationDTO(locationDTO);
        locationMapper.updateEntity(existingLocation, locationDTO);
        existingLocation.setUpdatedAt(LocalDateTime.now());
        
        Location updatedLocation = locationRepository.save(existingLocation);
        log.info("Updated location: {}", updatedLocation.getId());
        return locationMapper.toDTO(updatedLocation);
    }

    /**
     * Retrieves locations by zone with caching support.
     * 
     * @param zone Zone identifier
     * @return List of locations in the zone
     */
    @Transactional(readOnly = true)
    public List<LocationDTO> getLocationsByZone(String zone) {
        log.debug("Retrieving locations for zone: {}", zone);
        return locationRepository.findByZone(zone).stream()
                .map(locationMapper::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * Retrieves active locations with pagination support.
     * 
     * @param pageable Pagination parameters
     * @return Page of active locations
     */
    @Transactional(readOnly = true)
    public Page<LocationDTO> getActiveLocations(Pageable pageable) {
        log.debug("Retrieving active locations, page: {}", pageable.getPageNumber());
        return locationRepository.findActiveLocations(pageable)
                .map(locationMapper::toDTO);
    }

    /**
     * Deactivates a location and its child locations.
     * 
     * @param id Location ID to deactivate
     * @throws LocationException if location not found
     */
    @Transactional(propagation = Propagation.REQUIRED)
    @CacheEvict(value = {"zoneLocations", "activeLocations", "nearbyLocations"}, allEntries = true)
    public void deactivateLocation(UUID id) {
        log.info("Deactivating location with ID: {}", id);
        
        Location location = locationRepository.findById(id)
            .orElseThrow(() -> new LocationException("Location not found"));
        
        deactivateLocationRecursively(location);
        locationRepository.save(location);
        log.info("Location and its children deactivated: {}", id);
    }

    // Private helper methods

    private void validateCoordinates(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("Invalid latitude value");
        }
        if (longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Invalid longitude value");
        }
    }

    private void validateRadius(double radiusInMeters) {
        if (radiusInMeters <= 0 || radiusInMeters > 10000) {
            throw new IllegalArgumentException("Invalid radius value");
        }
    }

    private void validateLocationDTO(LocationDTO locationDTO) {
        if (locationDTO.getName() == null || locationDTO.getName().trim().isEmpty()) {
            throw new LocationException("Location name is required");
        }
        if (locationDTO.getZone() == null || locationDTO.getZone().trim().isEmpty()) {
            throw new LocationException("Zone is required");
        }
        if (locationDTO.getCoordinates() == null) {
            throw new LocationException("Coordinates are required");
        }
    }

    private void deactivateLocationRecursively(Location location) {
        location.setActive(false);
        location.getChildren().forEach(this::deactivateLocationRecursively);
    }
}