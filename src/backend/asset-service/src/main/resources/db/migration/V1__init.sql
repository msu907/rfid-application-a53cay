-- Enable required PostgreSQL extensions
-- Version: postgresql 9.6+
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "plpgsql";

-- Create trigger function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create locations table
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    annotation TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for locations table
CREATE INDEX idx_locations_zone ON locations(zone);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_locations_active ON locations(active) WHERE active = true;

-- Create trigger for locations updated_at
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create assets table
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfid_tag VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(1024),
    current_location_id UUID REFERENCES locations(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for assets table
CREATE INDEX idx_assets_rfid_tag ON assets(rfid_tag);
CREATE INDEX idx_assets_current_location ON assets(current_location_id) WHERE current_location_id IS NOT NULL;
CREATE INDEX idx_assets_active ON assets(active) WHERE active = true;
CREATE INDEX idx_assets_name_search ON assets(name text_pattern_ops);

-- Create trigger for assets updated_at
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create asset_reads table (partitioned by read_time)
CREATE TABLE asset_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    reader_id VARCHAR(100) NOT NULL,
    read_time TIMESTAMP WITH TIME ZONE NOT NULL,
    signal_strength DECIMAL(6,2),
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (read_time);

-- Create indexes for asset_reads table
CREATE INDEX idx_asset_reads_asset ON asset_reads(asset_id);
CREATE INDEX idx_asset_reads_location ON asset_reads(location_id);
CREATE INDEX idx_asset_reads_time ON asset_reads(read_time);
CREATE INDEX idx_asset_reads_processed ON asset_reads(processed) WHERE NOT processed;

-- Create initial partition for current month
CREATE TABLE asset_reads_current_month PARTITION OF asset_reads
    FOR VALUES FROM (DATE_TRUNC('month', CURRENT_DATE))
    TO (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month');

-- Create readers table for reader management
CREATE TABLE readers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    location_id UUID REFERENCES locations(id),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for readers table
CREATE INDEX idx_readers_location ON readers(location_id);
CREATE INDEX idx_readers_status ON readers(status);
CREATE UNIQUE INDEX idx_readers_ip_address ON readers(ip_address);

-- Create trigger for readers updated_at
CREATE TRIGGER update_readers_updated_at
    BEFORE UPDATE ON readers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create audit log table for tracking important changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit_logs table
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Add comments for documentation
COMMENT ON TABLE locations IS 'Stores physical locations where assets can be tracked';
COMMENT ON TABLE assets IS 'Stores asset information with RFID tag associations';
COMMENT ON TABLE asset_reads IS 'Stores RFID reader events, partitioned by read_time';
COMMENT ON TABLE readers IS 'Stores RFID reader configuration and status';
COMMENT ON TABLE audit_logs IS 'Stores audit trail of important data changes';