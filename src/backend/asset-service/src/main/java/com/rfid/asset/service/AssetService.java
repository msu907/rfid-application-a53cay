package com.rfid.asset.service;

import com.rfid.asset.entity.Asset;
import com.rfid.asset.repository.AssetRepository;
import com.rfid.asset.dto.AssetDTO;
import com.rfid.asset.exception.AssetNotFoundException;
import com.rfid.asset.exception.DuplicateAssetException;
import com.rfid.asset.exception.ValidationException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Optional;
import java.util.Map;

/**
 * Service class implementing comprehensive business logic for asset management.
 * Provides CRUD operations, location tracking, and status management with
 * enhanced validation, pagination, and audit support.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@Service
@Slf4j
@Transactional(isolation = Isolation.READ_COMMITTED, rollbackFor = Exception.class)
public class AssetService {

    private final AssetRepository assetRepository;

    /**
     * Constructs the AssetService with required dependencies.
     *
     * @param assetRepository repository for asset data access
     */
    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
        log.info("AssetService initialized with repository: {}", assetRepository.getClass().getSimpleName());
    }

    /**
     * Creates a new asset with comprehensive validation.
     *
     * @param assetDTO the asset data transfer object
     * @return created asset DTO
     * @throws DuplicateAssetException if RFID tag already exists
     * @throws ValidationException if asset data is invalid
     */
    @Transactional
    public AssetDTO createAsset(AssetDTO assetDTO) {
        String correlationId = UUID.randomUUID().toString();
        MDC.put("correlationId", correlationId);
        log.info("Creating new asset with RFID tag: {}", assetDTO.getRfidTag());

        validateAssetData(assetDTO);
        checkDuplicateRfidTag(assetDTO.getRfidTag());

        try {
            Asset asset = convertToEntity(assetDTO);
            asset.setCreatedAt(LocalDateTime.now());
            asset.setUpdatedAt(LocalDateTime.now());
            asset.setActive(true);
            asset.setDeleted(false);

            Asset savedAsset = assetRepository.save(asset);
            log.info("Successfully created asset with ID: {}", savedAsset.getId());
            
            return convertToDTO(savedAsset);
        } finally {
            MDC.remove("correlationId");
        }
    }

    /**
     * Retrieves an asset by its ID.
     *
     * @param id the asset UUID
     * @return asset DTO
     * @throws AssetNotFoundException if asset not found
     */
    @Transactional(readOnly = true)
    public AssetDTO getAssetById(UUID id) {
        log.debug("Retrieving asset with ID: {}", id);
        
        return assetRepository.findById(id)
            .map(this::convertToDTO)
            .orElseThrow(() -> new AssetNotFoundException("Asset not found with ID: " + id));
    }

    /**
     * Updates an existing asset with validation.
     *
     * @param id the asset UUID
     * @param assetDTO the updated asset data
     * @return updated asset DTO
     * @throws AssetNotFoundException if asset not found
     * @throws ValidationException if update data is invalid
     */
    @Transactional
    public AssetDTO updateAsset(UUID id, AssetDTO assetDTO) {
        log.info("Updating asset with ID: {}", id);
        
        Asset existingAsset = assetRepository.findById(id)
            .orElseThrow(() -> new AssetNotFoundException("Asset not found with ID: " + id));

        if (!existingAsset.getRfidTag().equals(assetDTO.getRfidTag())) {
            checkDuplicateRfidTag(assetDTO.getRfidTag());
        }

        updateEntityFromDTO(existingAsset, assetDTO);
        existingAsset.setUpdatedAt(LocalDateTime.now());

        Asset updatedAsset = assetRepository.save(existingAsset);
        log.info("Successfully updated asset with ID: {}", id);
        
        return convertToDTO(updatedAsset);
    }

    /**
     * Retrieves active assets with pagination.
     *
     * @param pageable pagination parameters
     * @return page of active asset DTOs
     */
    @Transactional(readOnly = true)
    public Page<AssetDTO> getActiveAssets(Pageable pageable) {
        log.debug("Retrieving active assets with pagination: {}", pageable);
        
        return assetRepository.findByActiveTrue(pageable)
            .map(this::convertToDTO);
    }

    /**
     * Updates asset location with validation.
     *
     * @param id the asset UUID
     * @param locationId the new location UUID
     * @return updated asset DTO
     * @throws AssetNotFoundException if asset not found
     */
    @Transactional
    public AssetDTO updateAssetLocation(UUID id, UUID locationId) {
        log.info("Updating location for asset ID: {} to location ID: {}", id, locationId);
        
        Asset asset = assetRepository.findById(id)
            .orElseThrow(() -> new AssetNotFoundException("Asset not found with ID: " + id));

        // Location validation would be handled here
        asset.updateLocation(locationId);
        asset.setUpdatedAt(LocalDateTime.now());

        Asset updatedAsset = assetRepository.save(asset);
        log.info("Successfully updated location for asset ID: {}", id);
        
        return convertToDTO(updatedAsset);
    }

    /**
     * Validates asset data for creation/update.
     *
     * @param assetDTO the asset data to validate
     * @throws ValidationException if validation fails
     */
    private void validateAssetData(AssetDTO assetDTO) {
        if (assetDTO == null) {
            throw new ValidationException("Asset data cannot be null");
        }
        if (assetDTO.getRfidTag() == null || !assetDTO.getRfidTag().matches("^[A-Z0-9-]+$")) {
            throw new ValidationException("Invalid RFID tag format");
        }
        if (assetDTO.getName() == null || assetDTO.getName().trim().length() < 2) {
            throw new ValidationException("Asset name must be at least 2 characters");
        }
    }

    /**
     * Checks for duplicate RFID tags.
     *
     * @param rfidTag the RFID tag to check
     * @throws DuplicateAssetException if tag already exists
     */
    private void checkDuplicateRfidTag(String rfidTag) {
        if (assetRepository.existsByRfidTag(rfidTag)) {
            throw new DuplicateAssetException("Asset already exists with RFID tag: " + rfidTag);
        }
    }

    // Helper methods for DTO conversion
    private Asset convertToEntity(AssetDTO dto) {
        return Asset.builder()
            .rfidTag(dto.getRfidTag())
            .name(dto.getName())
            .description(dto.getDescription())
            .imageUrl(dto.getImageUrl())
            .metadata(dto.getMetadata())
            .build();
    }

    private AssetDTO convertToDTO(Asset entity) {
        return AssetDTO.builder()
            .id(entity.getId())
            .rfidTag(entity.getRfidTag())
            .name(entity.getName())
            .description(entity.getDescription())
            .imageUrl(entity.getImageUrl())
            .active(entity.isActive())
            .currentLocationId(entity.getCurrentLocation() != null ? 
                entity.getCurrentLocation().getId() : null)
            .metadata(entity.getMetadata())
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }

    private void updateEntityFromDTO(Asset entity, AssetDTO dto) {
        entity.setRfidTag(dto.getRfidTag());
        entity.setName(dto.getName());
        entity.setDescription(dto.getDescription());
        entity.setImageUrl(dto.getImageUrl());
        if (dto.getMetadata() != null) {
            entity.updateMetadata(dto.getMetadata());
        }
    }
}