package com.rfid.asset.repository;

import com.rfid.asset.entity.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

/**
 * Repository interface for Asset entity providing comprehensive data access methods
 * with support for pagination, filtering, and efficient querying.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@Repository
public interface AssetRepository extends JpaRepository<Asset, UUID> {

    /**
     * Finds an asset by its RFID tag with null safety.
     * Uses the unique index idx_rfid_tag for efficient lookup.
     *
     * @param rfidTag the RFID tag to search for
     * @return Optional containing the asset if found, empty otherwise
     */
    Optional<Asset> findByRfidTag(String rfidTag);

    /**
     * Retrieves all active assets with pagination support.
     * Uses the idx_asset_active index for efficient filtering.
     *
     * @param pageable pagination parameters
     * @return Page of active assets
     */
    Page<Asset> findByActiveTrue(Pageable pageable);

    /**
     * Finds all assets in a specific location with pagination.
     *
     * @param locationId the UUID of the location to search in
     * @param pageable pagination parameters
     * @return Page of assets in the specified location
     */
    @Query("SELECT a FROM Asset a WHERE a.currentLocation.id = :locationId AND a.deleted = false")
    Page<Asset> findByCurrentLocationId(@Param("locationId") UUID locationId, Pageable pageable);

    /**
     * Efficiently checks if an asset exists with the given RFID tag.
     * Uses the unique index idx_rfid_tag for lookup.
     *
     * @param rfidTag the RFID tag to check
     * @return true if exists, false otherwise
     */
    boolean existsByRfidTag(String rfidTag);

    /**
     * Finds assets not seen since a specific timestamp for monitoring.
     *
     * @param timestamp the cutoff timestamp
     * @param pageable pagination parameters
     * @return Page of assets not seen since the specified time
     */
    @Query("SELECT a FROM Asset a WHERE a.updatedAt < :timestamp AND a.active = true AND a.deleted = false")
    Page<Asset> findByLastSeenAtBefore(@Param("timestamp") LocalDateTime timestamp, Pageable pageable);

    /**
     * Searches assets by name pattern with case-insensitive matching.
     * Uses the idx_asset_name index for efficient search.
     *
     * @param namePattern the pattern to search for
     * @param pageable pagination parameters
     * @return Page of assets matching the name pattern
     */
    Page<Asset> findByNameContainingIgnoreCase(String namePattern, Pageable pageable);

    /**
     * Finds all active assets in a specific zone.
     *
     * @param zone the zone code to search in
     * @param pageable pagination parameters
     * @return Page of active assets in the specified zone
     */
    @Query("SELECT a FROM Asset a WHERE a.currentLocation.zone = :zone AND a.active = true AND a.deleted = false")
    Page<Asset> findByZone(@Param("zone") String zone, Pageable pageable);

    /**
     * Retrieves assets that require metadata update.
     *
     * @param lastUpdateTime the cutoff time for metadata updates
     * @param pageable pagination parameters
     * @return Page of assets needing metadata update
     */
    @Query("SELECT a FROM Asset a WHERE a.metadata = '{}' AND a.active = true AND a.deleted = false AND a.updatedAt < :lastUpdateTime")
    Page<Asset> findAssetsNeedingMetadataUpdate(@Param("lastUpdateTime") LocalDateTime lastUpdateTime, Pageable pageable);

    /**
     * Counts active assets in a specific location.
     *
     * @param locationId the location UUID to count assets in
     * @return count of active assets in the location
     */
    @Query("SELECT COUNT(a) FROM Asset a WHERE a.currentLocation.id = :locationId AND a.active = true AND a.deleted = false")
    long countActiveAssetsByLocation(@Param("locationId") UUID locationId);
}