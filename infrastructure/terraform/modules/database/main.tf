# Provider version: ~> 3.0
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local variables for consistent resource naming and tagging
locals {
  name_prefix = "${var.environment}-rfid-asset"
  
  common_tags = merge(var.tags, {
    Environment     = var.environment
    Component       = "Database"
    ManagedBy      = "Terraform"
    SecurityLevel  = "High"
    Compliance     = "GDPR"
    DataEncryption = "AES256"
  })

  monitoring_settings = {
    metrics_enabled = true
    logs_enabled    = true
    retention_days  = var.monitoring_config.metrics_retention_days
  }
}

# PostgreSQL Server
resource "azurerm_postgresql_server" "main" {
  name                = "${local.name_prefix}-psql"
  location            = var.location
  resource_group_name = var.resource_group_name

  administrator_login          = "psqladmin"
  administrator_login_password = random_password.postgresql_password.result

  sku_name   = var.postgresql_config.sku_name
  version    = "11"
  storage_mb = var.postgresql_config.storage_mb

  backup_retention_days        = var.postgresql_config.backup_retention_days
  geo_redundant_backup_enabled = var.postgresql_config.geo_redundant_backup
  auto_grow_enabled           = var.postgresql_config.auto_grow_enabled

  public_network_access_enabled    = false
  ssl_enforcement_enabled         = true
  ssl_minimal_tls_version_enforced = var.postgresql_config.minimum_tls_version
  infrastructure_encryption_enabled = var.postgresql_config.infrastructure_encryption_enabled

  threat_detection_policy {
    enabled              = true
    disabled_alerts      = []
    email_account_admins = true
    retention_days       = var.monitoring_config.metrics_retention_days
  }

  tags = local.common_tags
}

# Redis Cache
resource "azurerm_redis_cache" "main" {
  name                = "${local.name_prefix}-redis"
  location            = var.location
  resource_group_name = var.resource_group_name
  
  capacity            = var.redis_config.capacity
  family              = var.redis_config.family
  sku_name            = var.redis_config.sku
  enable_non_ssl_port = var.redis_config.enable_non_ssl_port
  minimum_tls_version = var.redis_config.minimum_tls_version
  shard_count         = var.redis_config.shard_count

  redis_configuration {
    enable_authentication = var.redis_config.enable_authentication
    maxmemory_policy     = "allkeys-lru"
  }

  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }

  tags = local.common_tags
}

# Storage Account for MinIO
resource "azurerm_storage_account" "minio" {
  name                     = replace("${local.name_prefix}minio", "-", "")
  resource_group_name      = var.resource_group_name
  location                = var.location
  account_tier             = var.storage_config.account_tier
  account_replication_type = var.storage_config.replication_type
  
  min_tls_version          = var.storage_config.min_tls_version
  enable_https_traffic_only = var.storage_config.enable_https_traffic_only
  allow_blob_public_access  = var.storage_config.allow_blob_public_access

  network_rules {
    default_action             = var.storage_config.network_rules.default_action
    ip_rules                   = var.storage_config.network_rules.ip_rules
    virtual_network_subnet_ids = var.storage_config.network_rules.virtual_network_subnet_ids
  }

  tags = local.common_tags
}

# Container Instance for InfluxDB
resource "azurerm_container_group" "influxdb" {
  name                = "${local.name_prefix}-influxdb"
  location            = var.location
  resource_group_name = var.resource_group_name
  ip_address_type     = "Private"
  subnet_ids          = [var.subnet_id]
  os_type             = "Linux"

  container {
    name   = "influxdb"
    image  = "influxdb:2.7"
    cpu    = var.influxdb_config.cpu
    memory = var.influxdb_config.memory

    environment_variables = {
      DOCKER_INFLUXDB_INIT_MODE      = "setup"
      DOCKER_INFLUXDB_INIT_ORG       = "rfid-asset-tracking"
      DOCKER_INFLUXDB_INIT_BUCKET    = "timeseries"
      DOCKER_INFLUXDB_INIT_RETENTION = "${var.influxdb_config.retention_policy_days}d"
    }

    secure_environment_variables = {
      DOCKER_INFLUXDB_INIT_PASSWORD = random_password.influxdb_password.result
      DOCKER_INFLUXDB_INIT_ADMIN_TOKEN = random_password.influxdb_token.result
    }

    ports {
      port     = 8086
      protocol = "TCP"
    }

    volume {
      name       = "influxdb-data"
      mount_path = "/var/lib/influxdb2"
      
      secret = {
        influxdb_admin_token = random_password.influxdb_token.result
      }
    }
  }

  tags = local.common_tags
}

# Private Endpoints
resource "azurerm_private_endpoint" "postgresql" {
  name                = "${local.name_prefix}-psql-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "${local.name_prefix}-psql-psc"
    private_connection_resource_id = azurerm_postgresql_server.main.id
    is_manual_connection          = false
    subresource_names            = ["postgresqlServer"]
  }

  tags = local.common_tags
}

resource "azurerm_private_endpoint" "redis" {
  name                = "${local.name_prefix}-redis-pe"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "${local.name_prefix}-redis-psc"
    private_connection_resource_id = azurerm_redis_cache.main.id
    is_manual_connection          = false
    subresource_names            = ["redisCache"]
  }

  tags = local.common_tags
}

# Monitoring and Diagnostics
resource "azurerm_monitor_diagnostic_setting" "postgresql" {
  name                       = "${local.name_prefix}-psql-diag"
  target_resource_id         = azurerm_postgresql_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  dynamic "log" {
    for_each = ["PostgreSQLLogs", "QueryStoreRuntimeStatistics", "QueryStoreWaitStatistics"]
    content {
      category = log.value
      enabled  = true

      retention_policy {
        enabled = true
        days    = var.monitoring_config.metrics_retention_days
      }
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = var.monitoring_config.metrics_retention_days
    }
  }
}

# Random passwords for secure credentials
resource "random_password" "postgresql_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "influxdb_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "influxdb_token" {
  length  = 64
  special = false
}

# Outputs
output "postgresql_server" {
  description = "PostgreSQL server details"
  value = {
    id                    = azurerm_postgresql_server.main.id
    fqdn                  = azurerm_postgresql_server.main.fqdn
    administrator_login   = azurerm_postgresql_server.main.administrator_login
    private_endpoint_fqdn = azurerm_private_endpoint.postgresql.private_service_connection[0].private_ip_address
  }
  sensitive = true
}

output "redis_cache" {
  description = "Redis cache details"
  value = {
    id          = azurerm_redis_cache.main.id
    hostname    = azurerm_redis_cache.main.hostname
    ssl_port    = azurerm_redis_cache.main.ssl_port
    private_endpoint_fqdn = azurerm_private_endpoint.redis.private_service_connection[0].private_ip_address
  }
  sensitive = true
}

output "minio_storage" {
  description = "MinIO storage account details"
  value = {
    id                  = azurerm_storage_account.minio.id
    primary_access_key  = azurerm_storage_account.minio.primary_access_key
    connection_string   = azurerm_storage_account.minio.primary_connection_string
  }
  sensitive = true
}

output "influxdb" {
  description = "InfluxDB container details"
  value = {
    id            = azurerm_container_group.influxdb.id
    ip_address    = azurerm_container_group.influxdb.ip_address
    fqdn          = azurerm_container_group.influxdb.fqdn
  }
  sensitive = true
}