package com.rfid.asset.repository;

import com.rfid.asset.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.hibernate.annotations.QueryHint;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for Location entity providing optimized data access operations
 * with spatial query support and caching capabilities.
 * 
 * @version 2.7+
 */
@Repository
public interface LocationRepository extends JpaRepository<Location, UUID> {

    /**
     * Finds all locations within a specific zone with caching support.
     * 
     * @param zone The zone identifier to search for
     * @return List of locations in the specified zone
     */
    @Cacheable(value = "zoneLocations", key = "#zone")
    @Query("SELECT l FROM Location l WHERE l.zone = :zone AND l.active = true")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    List<Location> findByZone(@Param("zone") String zone);

    /**
     * Finds locations near specified coordinates using spatial indexing.
     * 
     * @param latitude Latitude coordinate
     * @param longitude Longitude coordinate
     * @param radiusInMeters Search radius in meters
     * @return List of nearby locations ordered by distance
     */
    @Query(value = """
        SELECT l FROM Location l 
        WHERE ST_Distance_Sphere(
            point(l.coordinates.longitude, l.coordinates.latitude), 
            point(:longitude, :latitude)
        ) <= :radiusInMeters 
        ORDER BY ST_Distance_Sphere(
            point(l.coordinates.longitude, l.coordinates.latitude), 
            point(:longitude, :latitude)
        )
    """)
    @QueryHints(@QueryHint(name = "org.hibernate.spatialIndex", value = "true"))
    List<Location> findByCoordinatesNear(
        @Param("latitude") double latitude,
        @Param("longitude") double longitude,
        @Param("radiusInMeters") double radiusInMeters
    );

    /**
     * Retrieves all active locations with pagination and sorting support.
     * Optimized for read-only operations with query result caching.
     * 
     * @param pageable Pagination parameters
     * @return Page of active locations
     */
    @Cacheable(value = "activeLocations", key = "#pageable")
    @Query("SELECT l FROM Location l WHERE l.active = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.readOnly", value = "true"),
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<Location> findActiveLocations(Pageable pageable);

    /**
     * Searches locations by name pattern with case-insensitive matching.
     * 
     * @param name Name pattern to search for
     * @return List of locations matching the name pattern
     */
    @Query("""
        SELECT l FROM Location l 
        WHERE LOWER(l.name) LIKE LOWER(CONCAT('%', :name, '%')) 
        AND l.active = true
    """)
    @QueryHints(@QueryHint(name = "org.hibernate.comment", value = "Name search query"))
    List<Location> findByNameContainingIgnoreCase(@Param("name") String name);

    /**
     * Finds all child locations for a given parent location ID.
     * 
     * @param parentId Parent location ID
     * @return List of child locations
     */
    @Cacheable(value = "childLocations", key = "#parentId")
    @Query("SELECT l FROM Location l WHERE l.parent.id = :parentId AND l.active = true")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    List<Location> findChildLocations(@Param("parentId") UUID parentId);

    /**
     * Finds locations by type with pagination support.
     * 
     * @param type Location type
     * @param pageable Pagination parameters
     * @return Page of locations of specified type
     */
    @Query("SELECT l FROM Location l WHERE l.type = :type AND l.active = true")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Page<Location> findByType(@Param("type") Location.LocationType type, Pageable pageable);

    /**
     * Checks if a location has available capacity.
     * 
     * @param locationId Location ID to check
     * @return true if location has available capacity
     */
    @Query("""
        SELECT CASE WHEN COUNT(a) < l.capacity THEN true ELSE false END 
        FROM Location l LEFT JOIN Asset a ON a.location.id = l.id 
        WHERE l.id = :locationId AND l.active = true 
        GROUP BY l.capacity
    """)
    boolean hasAvailableCapacity(@Param("locationId") UUID locationId);
}