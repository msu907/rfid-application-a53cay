package com.rfid.asset.entity;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.persistence.Id;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Column;
import javax.persistence.ManyToOne;
import javax.persistence.JoinColumn;
import javax.persistence.Version;
import javax.persistence.Index;
import javax.persistence.EntityListeners;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.validation.constraints.Pattern;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;
import java.time.LocalDateTime;

/**
 * Entity class representing an asset in the RFID tracking system.
 * Provides comprehensive support for asset tracking, versioning, and metadata management.
 * 
 * @version 1.0
 * @since 2023-10-01
 */
@Entity
@Table(
    name = "assets",
    indexes = {
        @Index(name = "idx_rfid_tag", columnList = "rfid_tag", unique = true),
        @Index(name = "idx_asset_name", columnList = "name"),
        @Index(name = "idx_asset_active", columnList = "active")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Asset {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @Size(min = 10, max = 50)
    @Pattern(regexp = "^[A-Z0-9-]+$")
    @Column(name = "rfid_tag", nullable = false, unique = true)
    private String rfidTag;

    @NotNull
    @Size(min = 2, max = 100)
    @Pattern(regexp = "^[a-zA-Z0-9\\s-_]+$")
    @Column(name = "name", nullable = false)
    private String name;

    @Size(max = 500)
    @Column(name = "description")
    private String description;

    @Size(max = 255)
    @Column(name = "image_url")
    private String imageUrl;

    @NotNull
    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToOne
    @JoinColumn(name = "current_location_id")
    @JsonIgnoreProperties({"parent", "children", "coordinates"})
    private Location currentLocation;

    @Version
    @Column(name = "version")
    private Long version;

    @Column(name = "metadata", columnDefinition = "jsonb")
    @Builder.Default
    private String metadata = "{}";

    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private boolean deleted = false;

    /**
     * Updates the current location of the asset.
     * @param newLocation The new location to assign to the asset
     */
    public void updateLocation(Location newLocation) {
        this.currentLocation = newLocation;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Soft deletes the asset by marking it as deleted and inactive.
     */
    public void softDelete() {
        this.deleted = true;
        this.active = false;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Restores a soft-deleted asset.
     */
    public void restore() {
        this.deleted = false;
        this.active = true;
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Updates the asset's metadata.
     * @param newMetadata JSON string containing the new metadata
     */
    public void updateMetadata(String newMetadata) {
        this.metadata = newMetadata != null ? newMetadata : "{}";
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Custom toString method to prevent circular dependencies in logging.
     */
    @Override
    public String toString() {
        return "Asset{" +
                "id=" + id +
                ", rfidTag='" + rfidTag + '\'' +
                ", name='" + name + '\'' +
                ", active=" + active +
                ", currentLocation=" + (currentLocation != null ? currentLocation.getId() : "null") +
                ", version=" + version +
                '}';
    }
}