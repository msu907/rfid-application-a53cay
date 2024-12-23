package com.rfid.asset.entity;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.persistence.Id;
import javax.persistence.GeneratedValue;
import javax.persistence.Column;
import javax.persistence.Version;
import javax.persistence.Embedded;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.JoinColumn;
import javax.persistence.Index;
import javax.persistence.GenerationType;
import javax.persistence.FetchType;
import javax.persistence.CascadeType;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.validation.constraints.Pattern;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import org.springframework.data.jpa.domain.support.AuditingEntityListener;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.time.LocalDateTime;

/**
 * Entity class representing a physical location in the RFID asset tracking system.
 * Supports hierarchical organization, spatial data management, and audit tracking.
 */
@Entity
@Table(
    name = "locations",
    indexes = {
        @Index(name = "idx_location_zone", columnList = "zone"),
        @Index(name = "idx_location_name", columnList = "name"),
        @Index(name = "idx_location_type", columnList = "type")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @NotNull
    @Size(min = 2, max = 100)
    @Pattern(regexp = "^[a-zA-Z0-9\\s-_]+$")
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull
    @Size(min = 2, max = 50)
    @Pattern(regexp = "^[A-Z0-9-]+$")
    @Column(name = "zone", nullable = false)
    private String zone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Location parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Location> children = new HashSet<>();

    @Embedded
    private Coordinates coordinates;

    @Size(max = 500)
    @Column(name = "annotation")
    private String annotation;

    @NotNull
    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "capacity")
    private Integer capacity;

    @NotNull
    @Column(name = "type", nullable = false)
    private LocationType type;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;

    /**
     * Adds a child location to this location's hierarchy.
     * @param child The child location to add
     */
    public void addChild(Location child) {
        children.add(child);
        child.setParent(this);
    }

    /**
     * Removes a child location from this location's hierarchy.
     * @param child The child location to remove
     */
    public void removeChild(Location child) {
        children.remove(child);
        child.setParent(null);
    }

    /**
     * Embedded class representing geographic coordinates.
     */
    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Coordinates {
        
        @Column(name = "latitude", precision = 10, scale = 7)
        private double latitude;
        
        @Column(name = "longitude", precision = 10, scale = 7)
        private double longitude;
        
        @Column(name = "elevation")
        private double elevation;
    }

    /**
     * Enumeration representing different types of locations in the system.
     */
    public enum LocationType {
        BUILDING,
        FLOOR,
        ZONE,
        TEMPORARY
    }
}