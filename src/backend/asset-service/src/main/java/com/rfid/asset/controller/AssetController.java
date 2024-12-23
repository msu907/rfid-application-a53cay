package com.rfid.asset.controller;

import com.rfid.asset.service.AssetService;
import com.rfid.asset.dto.AssetDTO;
import com.rfid.asset.exception.AssetNotFoundException;
import com.rfid.asset.exception.ValidationException;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.hateoas.EntityModel;
import org.springframework.hateoas.Link;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

import lombok.extern.slf4j.Slf4j;

import javax.validation.Valid;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * REST controller for asset management operations with comprehensive security and validation.
 * Provides endpoints for CRUD operations on assets with role-based access control.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@RestController
@RequestMapping("/api/v1/assets")
@Tag(name = "Asset Management", description = "Endpoints for managing RFID assets")
@SecurityRequirement(name = "bearerAuth")
@CrossOrigin(origins = "${app.cors.allowed-origins}", maxAge = 3600)
@Validated
@Slf4j
public class AssetController {

    private final AssetService assetService;
    private static final String CACHE_CONTROL_HEADER = CacheControl.maxAge(10, TimeUnit.SECONDS)
            .mustRevalidate()
            .cachePublic()
            .getHeaderValue();

    /**
     * Constructs the AssetController with required dependencies.
     *
     * @param assetService service layer for asset operations
     */
    public AssetController(AssetService assetService) {
        this.assetService = assetService;
        log.info("AssetController initialized with service: {}", assetService.getClass().getSimpleName());
    }

    /**
     * Creates a new asset with validation.
     *
     * @param assetDTO the asset data to create
     * @return ResponseEntity containing the created asset
     */
    @PostMapping
    @PreAuthorize("hasRole('ASSET_MANAGER')")
    @Operation(summary = "Create new asset", description = "Creates a new asset with the provided data")
    @ApiResponse(responseCode = "201", description = "Asset created successfully")
    public ResponseEntity<EntityModel<AssetDTO>> createAsset(@Valid @RequestBody AssetDTO assetDTO) {
        log.info("Creating new asset with RFID tag: {}", assetDTO.getRfidTag());
        AssetDTO createdAsset = assetService.createAsset(assetDTO);
        
        EntityModel<AssetDTO> resource = EntityModel.of(createdAsset);
        resource.add(Link.of("/api/v1/assets/" + createdAsset.getId()).withSelfRel());
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .header("Cache-Control", CACHE_CONTROL_HEADER)
                .body(resource);
    }

    /**
     * Retrieves an asset by its ID.
     *
     * @param id the asset UUID
     * @return ResponseEntity containing the asset data
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'OPERATOR', 'VIEWER')")
    @Operation(summary = "Get asset by ID", description = "Retrieves asset details by its UUID")
    @ApiResponse(responseCode = "200", description = "Asset found successfully")
    public ResponseEntity<EntityModel<AssetDTO>> getAssetById(@PathVariable UUID id) {
        log.debug("Retrieving asset with ID: {}", id);
        AssetDTO asset = assetService.getAssetById(id);
        
        EntityModel<AssetDTO> resource = EntityModel.of(asset);
        resource.add(Link.of("/api/v1/assets/" + id).withSelfRel());
        
        return ResponseEntity.ok()
                .header("Cache-Control", CACHE_CONTROL_HEADER)
                .body(resource);
    }

    /**
     * Updates an existing asset.
     *
     * @param id the asset UUID
     * @param assetDTO the updated asset data
     * @return ResponseEntity containing the updated asset
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ASSET_MANAGER')")
    @Operation(summary = "Update asset", description = "Updates an existing asset with new data")
    @ApiResponse(responseCode = "200", description = "Asset updated successfully")
    public ResponseEntity<EntityModel<AssetDTO>> updateAsset(
            @PathVariable UUID id,
            @Valid @RequestBody AssetDTO assetDTO) {
        log.info("Updating asset with ID: {}", id);
        AssetDTO updatedAsset = assetService.updateAsset(id, assetDTO);
        
        EntityModel<AssetDTO> resource = EntityModel.of(updatedAsset);
        resource.add(Link.of("/api/v1/assets/" + id).withSelfRel());
        
        return ResponseEntity.ok()
                .header("Cache-Control", CACHE_CONTROL_HEADER)
                .body(resource);
    }

    /**
     * Retrieves a paginated list of active assets.
     *
     * @param pageable pagination parameters
     * @return ResponseEntity containing the page of assets
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'OPERATOR', 'VIEWER')")
    @Operation(summary = "List active assets", description = "Retrieves a paginated list of active assets")
    @ApiResponse(responseCode = "200", description = "Assets retrieved successfully")
    public ResponseEntity<Page<AssetDTO>> getActiveAssets(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        log.debug("Retrieving active assets with pagination: {}", pageable);
        Page<AssetDTO> assets = assetService.getActiveAssets(pageable);
        
        return ResponseEntity.ok()
                .header("Cache-Control", CACHE_CONTROL_HEADER)
                .body(assets);
    }

    /**
     * Updates an asset's location.
     *
     * @param id the asset UUID
     * @param locationId the new location UUID
     * @return ResponseEntity containing the updated asset
     */
    @PatchMapping("/{id}/location/{locationId}")
    @PreAuthorize("hasAnyRole('ASSET_MANAGER', 'OPERATOR')")
    @Operation(summary = "Update asset location", description = "Updates the location of an existing asset")
    @ApiResponse(responseCode = "200", description = "Asset location updated successfully")
    public ResponseEntity<EntityModel<AssetDTO>> updateAssetLocation(
            @PathVariable UUID id,
            @PathVariable UUID locationId) {
        log.info("Updating location for asset ID: {} to location ID: {}", id, locationId);
        AssetDTO updatedAsset = assetService.updateAssetLocation(id, locationId);
        
        EntityModel<AssetDTO> resource = EntityModel.of(updatedAsset);
        resource.add(Link.of("/api/v1/assets/" + id).withSelfRel());
        
        return ResponseEntity.ok()
                .header("Cache-Control", CACHE_CONTROL_HEADER)
                .body(resource);
    }

    /**
     * Exception handler for AssetNotFoundException.
     *
     * @param ex the exception instance
     * @return ResponseEntity with error details
     */
    @ExceptionHandler(AssetNotFoundException.class)
    public ResponseEntity<Object> handleAssetNotFoundException(AssetNotFoundException ex) {
        log.error("Asset not found: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("Asset not found", ex.getMessage()));
    }

    /**
     * Exception handler for ValidationException.
     *
     * @param ex the exception instance
     * @return ResponseEntity with error details
     */
    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Object> handleValidationException(ValidationException ex) {
        log.error("Validation error: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(new ErrorResponse("Validation error", ex.getMessage()));
    }

    /**
     * Error response class for standardized error handling.
     */
    private static class ErrorResponse {
        private final String error;
        private final String message;

        public ErrorResponse(String error, String message) {
            this.error = error;
            this.message = message;
        }

        public String getError() {
            return error;
        }

        public String getMessage() {
            return message;
        }
    }
}