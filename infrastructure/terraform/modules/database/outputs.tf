# PostgreSQL Server Outputs
output "postgresql_server_id" {
  description = "The ID of the PostgreSQL server used for resource referencing"
  value       = azurerm_postgresql_server.main.id
  sensitive   = false
}

output "postgresql_server_fqdn" {
  description = "The Fully Qualified Domain Name of the PostgreSQL server for connection purposes"
  value       = azurerm_postgresql_server.main.fqdn
  sensitive   = false
}

output "postgresql_connection_info" {
  description = "Complete PostgreSQL connection information including server name, database name and SSL mode"
  value = {
    server_name     = azurerm_postgresql_server.main.fqdn
    admin_username  = azurerm_postgresql_server.main.administrator_login
    ssl_mode        = "require"
    ssl_enforcement = true
    version        = "11"
    private_endpoint = {
      fqdn        = azurerm_private_endpoint.postgresql.private_service_connection[0].private_ip_address
      dns_zone    = "privatelink.postgres.database.azure.com"
    }
  }
  sensitive = true
}

# InfluxDB Outputs
output "influxdb_connection_info" {
  description = "InfluxDB connection information including endpoint and container details"
  value = {
    endpoint        = azurerm_container_group.influxdb.ip_address
    port           = 8086
    container_name = azurerm_container_group.influxdb.container[0].name
    database       = "timeseries"
    organization   = "rfid-asset-tracking"
    bucket         = "timeseries"
    retention      = "${var.influxdb_config.retention_policy_days}d"
  }
  sensitive = true
}

# Redis Cache Outputs
output "redis_connection_info" {
  description = "Redis cache connection information including connection string and SSL port"
  value = {
    hostname         = azurerm_redis_cache.main.hostname
    ssl_port         = azurerm_redis_cache.main.ssl_port
    instance_name    = azurerm_redis_cache.main.name
    sku_name         = var.redis_config.sku
    private_endpoint = {
      fqdn        = azurerm_private_endpoint.redis.private_service_connection[0].private_ip_address
      dns_zone    = "privatelink.redis.cache.windows.net"
    }
  }
  sensitive = true
}

# Storage (MinIO) Outputs
output "storage_connection_info" {
  description = "Storage account connection information for MinIO including endpoints and access keys"
  value = {
    account_name     = azurerm_storage_account.minio.name
    blob_endpoint    = azurerm_storage_account.minio.primary_blob_endpoint
    account_tier     = var.storage_config.account_tier
    replication_type = var.storage_config.replication_type
    tls_version      = var.storage_config.min_tls_version
    network_rules    = var.storage_config.network_rules
  }
  sensitive = true
}

# Private Endpoints Configuration
output "private_endpoints" {
  description = "Comprehensive private endpoint information for all database services"
  value = {
    postgresql = {
      id                  = azurerm_private_endpoint.postgresql.id
      ip_address          = azurerm_private_endpoint.postgresql.private_service_connection[0].private_ip_address
      network_interface_id = azurerm_private_endpoint.postgresql.network_interface[0].id
      dns_zone_name       = "privatelink.postgres.database.azure.com"
    }
    redis = {
      id                  = azurerm_private_endpoint.redis.id
      ip_address          = azurerm_private_endpoint.redis.private_service_connection[0].private_ip_address
      network_interface_id = azurerm_private_endpoint.redis.network_interface[0].id
      dns_zone_name       = "privatelink.redis.cache.windows.net"
    }
  }
  sensitive = false
}

# Monitoring Configuration
output "monitoring_configuration" {
  description = "Monitoring and diagnostic settings for database services"
  value = {
    postgresql = {
      metrics_enabled = var.monitoring_config.diagnostic_settings_enabled
      logs_enabled    = var.monitoring_config.diagnostic_settings_enabled
      retention_days  = var.monitoring_config.metrics_retention_days
      alert_rules    = var.monitoring_config.alert_rules_enabled
    }
    redis = {
      metrics_enabled = var.monitoring_config.diagnostic_settings_enabled
      logs_enabled    = var.monitoring_config.diagnostic_settings_enabled
      retention_days  = var.monitoring_config.metrics_retention_days
      alert_rules    = var.monitoring_config.alert_rules_enabled
    }
    influxdb = {
      metrics_enabled = var.influxdb_config.monitoring_enabled
      retention_days  = var.monitoring_config.metrics_retention_days
      ha_enabled     = var.influxdb_config.ha_enabled
    }
    storage = {
      metrics_enabled = var.monitoring_config.diagnostic_settings_enabled
      logs_enabled    = var.monitoring_config.diagnostic_settings_enabled
      retention_days  = var.monitoring_config.metrics_retention_days
      alert_rules    = var.monitoring_config.alert_rules_enabled
    }
  }
  sensitive = false
}

# Backup Configuration
output "backup_configuration" {
  description = "Backup configuration for all database services"
  value = {
    postgresql = {
      backup_enabled        = true
      retention_days        = var.postgresql_config.backup_retention_days
      geo_redundant_backup = var.postgresql_config.geo_redundant_backup
    }
    influxdb = {
      backup_enabled = var.influxdb_config.backup_enabled
      retention_days = var.backup_config.retention_days
    }
    storage = {
      replication_type    = var.storage_config.replication_type
      geo_redundant       = var.backup_config.geo_redundant
      encryption_enabled = var.backup_config.encryption_enabled
    }
  }
  sensitive = false
}