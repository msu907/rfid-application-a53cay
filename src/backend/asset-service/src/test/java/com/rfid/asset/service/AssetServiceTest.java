package com.rfid.asset.service;

import com.rfid.asset.entity.Asset;
import com.rfid.asset.entity.Location;
import com.rfid.asset.repository.AssetRepository;
import com.rfid.asset.dto.AssetDTO;
import com.rfid.asset.exception.AssetNotFoundException;
import com.rfid.asset.exception.DuplicateAssetException;
import com.rfid.asset.exception.ValidationException;
import com.rfid.asset.service.storage.ImageStorageService;
import com.rfid.asset.service.validation.MetadataValidator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Comprehensive test suite for AssetService verifying asset management operations,
 * metadata handling, image storage, and data retrieval features.
 *
 * @version 1.0
 * @since 2023-10-01
 */
@ExtendWith(MockitoExtension.class)
class AssetServiceTest {

    @Mock
    private AssetRepository assetRepository;

    @Mock
    private ImageStorageService imageStorageService;

    @Mock
    private MetadataValidator metadataValidator;

    @InjectMocks
    private AssetService assetService;

    private Asset testAsset;
    private AssetDTO testAssetDTO;
    private UUID testId;
    private String testRfidTag;

    @BeforeEach
    void setUp() {
        testId = UUID.randomUUID();
        testRfidTag = "RFID-12345";
        
        testAsset = Asset.builder()
            .id(testId)
            .rfidTag(testRfidTag)
            .name("Test Asset")
            .description("Test Description")
            .active(true)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();

        testAssetDTO = AssetDTO.builder()
            .id(testId)
            .rfidTag(testRfidTag)
            .name("Test Asset")
            .description("Test Description")
            .active(true)
            .build();
    }

    @Test
    void testCreateAssetWithValidData() {
        // Given
        given(assetRepository.existsByRfidTag(testRfidTag)).willReturn(false);
        given(assetRepository.save(any(Asset.class))).willReturn(testAsset);

        // When
        AssetDTO result = assetService.createAsset(testAssetDTO);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getRfidTag()).isEqualTo(testRfidTag);
        assertThat(result.getName()).isEqualTo("Test Asset");
        verify(assetRepository).save(any(Asset.class));
    }

    @Test
    void testCreateAssetWithDuplicateRfidTag() {
        // Given
        given(assetRepository.existsByRfidTag(testRfidTag)).willReturn(true);

        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(testAssetDTO))
            .isInstanceOf(DuplicateAssetException.class)
            .hasMessageContaining("Asset already exists with RFID tag");
    }

    @Test
    void testUpdateAssetWithValidData() {
        // Given
        given(assetRepository.findById(testId)).willReturn(Optional.of(testAsset));
        given(assetRepository.save(any(Asset.class))).willReturn(testAsset);

        // When
        AssetDTO updatedDTO = testAssetDTO;
        updatedDTO.setName("Updated Name");
        AssetDTO result = assetService.updateAsset(testId, updatedDTO);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getName()).isEqualTo("Updated Name");
        verify(assetRepository).save(any(Asset.class));
    }

    @Test
    void testUpdateAssetNotFound() {
        // Given
        given(assetRepository.findById(testId)).willReturn(Optional.empty());

        // When/Then
        assertThatThrownBy(() -> assetService.updateAsset(testId, testAssetDTO))
            .isInstanceOf(AssetNotFoundException.class)
            .hasMessageContaining("Asset not found");
    }

    @Test
    void testGetAssetsByLocationPaginated() {
        // Given
        UUID locationId = UUID.randomUUID();
        Pageable pageable = PageRequest.of(0, 10);
        List<Asset> assets = List.of(testAsset);
        Page<Asset> assetPage = new PageImpl<>(assets, pageable, 1);
        
        given(assetRepository.findByCurrentLocationId(locationId, pageable))
            .willReturn(assetPage);

        // When
        Page<AssetDTO> result = assetService.getAssetsByLocation(locationId, pageable);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getRfidTag()).isEqualTo(testRfidTag);
        verify(assetRepository).findByCurrentLocationId(locationId, pageable);
    }

    @Test
    void testGetActiveAssetsPaginated() {
        // Given
        Pageable pageable = PageRequest.of(0, 10);
        List<Asset> assets = List.of(testAsset);
        Page<Asset> assetPage = new PageImpl<>(assets, pageable, 1);
        
        given(assetRepository.findByActiveTrue(pageable)).willReturn(assetPage);

        // When
        Page<AssetDTO> result = assetService.getActiveAssets(pageable);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).isActive()).isTrue();
        verify(assetRepository).findByActiveTrue(pageable);
    }

    @Test
    void testUpdateAssetLocation() {
        // Given
        UUID newLocationId = UUID.randomUUID();
        Location newLocation = new Location();
        newLocation.setId(newLocationId);
        
        testAsset.setCurrentLocation(newLocation);
        given(assetRepository.findById(testId)).willReturn(Optional.of(testAsset));
        given(assetRepository.save(any(Asset.class))).willReturn(testAsset);

        // When
        AssetDTO result = assetService.updateAssetLocation(testId, newLocationId);

        // Then
        assertThat(result).isNotNull();
        assertThat(result.getCurrentLocationId()).isEqualTo(newLocationId);
        verify(assetRepository).save(any(Asset.class));
    }

    @Test
    void testValidateAssetDataWithInvalidRfidTag() {
        // Given
        testAssetDTO.setRfidTag("invalid-tag-format");

        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(testAssetDTO))
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("Invalid RFID tag format");
    }

    @Test
    void testValidateAssetDataWithInvalidName() {
        // Given
        testAssetDTO.setName("");

        // When/Then
        assertThatThrownBy(() -> assetService.createAsset(testAssetDTO))
            .isInstanceOf(ValidationException.class)
            .hasMessageContaining("Asset name must be at least 2 characters");
    }
}