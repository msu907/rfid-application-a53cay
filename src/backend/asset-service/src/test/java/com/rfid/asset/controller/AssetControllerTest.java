package com.rfid.asset.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rfid.asset.dto.AssetDTO;
import com.rfid.asset.dto.LocationDTO;
import com.rfid.asset.service.AssetService;
import com.rfid.asset.exception.AssetNotFoundException;
import com.rfid.asset.exception.ValidationException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

/**
 * Comprehensive test suite for AssetController validating REST endpoints,
 * security, performance, and error handling.
 */
@ExtendWith({SpringExtension.class, MockitoExtension.class})
@WebMvcTest(AssetController.class)
class AssetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @MockBean
    private AssetService assetService;

    @Autowired
    private ObjectMapper objectMapper;

    private ExecutorService executorService;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(webApplicationContext)
                .build();
        executorService = Executors.newFixedThreadPool(10);
    }

    /**
     * Tests successful asset creation with proper authorization
     */
    @Test
    @WithMockUser(roles = "ASSET_MANAGER")
    void testCreateAssetSuccess() throws Exception {
        UUID assetId = UUID.randomUUID();
        AssetDTO inputAsset = createTestAssetDTO();
        AssetDTO createdAsset = inputAsset.copy();
        createdAsset.setId(assetId);

        when(assetService.createAsset(any(AssetDTO.class))).thenReturn(createdAsset);

        mockMvc.perform(post("/api/v1/assets")
                .with(jwt().authorities("ROLE_ASSET_MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inputAsset)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(assetId.toString()))
                .andExpect(jsonPath("$.rfidTag").value(inputAsset.getRfidTag()))
                .andExpect(header().string("Cache-Control", containsString("max-age=10")));

        verify(assetService).createAsset(any(AssetDTO.class));
    }

    /**
     * Tests unauthorized access for asset creation
     */
    @Test
    @WithMockUser(roles = "VIEWER")
    void testCreateAssetUnauthorized() throws Exception {
        AssetDTO inputAsset = createTestAssetDTO();

        mockMvc.perform(post("/api/v1/assets")
                .with(jwt().authorities("ROLE_VIEWER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inputAsset)))
                .andExpect(status().isForbidden());

        verify(assetService, never()).createAsset(any(AssetDTO.class));
    }

    /**
     * Tests concurrent asset retrieval performance
     */
    @Test
    @WithMockUser(roles = "VIEWER")
    void testConcurrentAssetRetrieval() throws Exception {
        UUID assetId = UUID.randomUUID();
        AssetDTO asset = createTestAssetDTO();
        asset.setId(assetId);

        when(assetService.getAssetById(any(UUID.class))).thenReturn(asset);

        // Execute 100 concurrent requests
        CompletableFuture<?>[] futures = IntStream.range(0, 100)
                .mapToObj(i -> CompletableFuture.runAsync(() -> {
                    try {
                        mockMvc.perform(get("/api/v1/assets/" + assetId)
                                .with(jwt().authorities("ROLE_VIEWER")))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.id").value(assetId.toString()))
                                .andExpect(header().exists("Cache-Control"));
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                }, executorService))
                .toArray(CompletableFuture[]::new);

        CompletableFuture.allOf(futures).join();
        verify(assetService, times(100)).getAssetById(assetId);
    }

    /**
     * Tests asset location update functionality
     */
    @Test
    @WithMockUser(roles = "OPERATOR")
    void testUpdateAssetLocation() throws Exception {
        UUID assetId = UUID.randomUUID();
        UUID locationId = UUID.randomUUID();
        AssetDTO updatedAsset = createTestAssetDTO();
        updatedAsset.setId(assetId);

        when(assetService.updateAssetLocation(assetId, locationId)).thenReturn(updatedAsset);

        mockMvc.perform(patch("/api/v1/assets/{id}/location/{locationId}", assetId, locationId)
                .with(jwt().authorities("ROLE_OPERATOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(assetId.toString()));

        verify(assetService).updateAssetLocation(assetId, locationId);
    }

    /**
     * Tests pagination of active assets
     */
    @Test
    @WithMockUser(roles = "VIEWER")
    void testGetActiveAssetsPagination() throws Exception {
        Page<AssetDTO> assetPage = new PageImpl<>(
            Arrays.asList(createTestAssetDTO(), createTestAssetDTO()),
            PageRequest.of(0, 20),
            2
        );

        when(assetService.getActiveAssets(any(PageRequest.class))).thenReturn(assetPage);

        mockMvc.perform(get("/api/v1/assets")
                .with(jwt().authorities("ROLE_VIEWER"))
                .param("page", "0")
                .param("size", "20")
                .param("sort", "name,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(2)))
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    /**
     * Tests error handling for asset not found
     */
    @Test
    @WithMockUser(roles = "VIEWER")
    void testAssetNotFound() throws Exception {
        UUID assetId = UUID.randomUUID();
        when(assetService.getAssetById(assetId))
                .thenThrow(new AssetNotFoundException("Asset not found with ID: " + assetId));

        mockMvc.perform(get("/api/v1/assets/{id}", assetId)
                .with(jwt().authorities("ROLE_VIEWER")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Asset not found"));
    }

    /**
     * Tests validation error handling
     */
    @Test
    @WithMockUser(roles = "ASSET_MANAGER")
    void testValidationError() throws Exception {
        AssetDTO invalidAsset = new AssetDTO();
        // Missing required fields

        mockMvc.perform(post("/api/v1/assets")
                .with(jwt().authorities("ROLE_ASSET_MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidAsset)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation error"));
    }

    /**
     * Helper method to create a test AssetDTO
     */
    private AssetDTO createTestAssetDTO() {
        return AssetDTO.builder()
                .rfidTag("RF123456789")
                .name("Test Asset")
                .description("Test Description")
                .imageUrl("https://example.com/image.jpg")
                .active(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .currentLocation(LocationDTO.builder()
                        .id(UUID.randomUUID())
                        .name("Test Location")
                        .zone("ZONE-A")
                        .build())
                .build();
    }
}