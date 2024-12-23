# Resource Group Configuration
variable "resource_group_name" {
  description = "Name of the resource group where database resources will be created"
  type        = string
  
  validation {
    condition     = length(var.resource_group_name) <= 90 && can(regex("^[a-zA-Z0-9-_]*$", var.resource_group_name))
    error_message = "Resource group name must be <= 90 characters and contain only alphanumeric, hyphens, and underscores"
  }
}

variable "location" {
  description = "Azure region where database resources will be deployed"
  type        = string
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod) with specific security and HA configurations"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "subnet_id" {
  description = "ID of the subnet where private endpoints will be created for secure database access"
  type        = string
}

# PostgreSQL Configuration
variable "postgresql_config" {
  description = "Configuration for Azure Database for PostgreSQL"
  type = object({
    sku_name                           = string
    storage_mb                         = number
    backup_retention_days              = number
    geo_redundant_backup              = bool
    auto_grow_enabled                 = bool
    minimum_tls_version               = string
    infrastructure_encryption_enabled = bool
  })
  
  default = {
    sku_name                           = "GP_Gen5_2"
    storage_mb                         = 102400
    backup_retention_days              = 7
    geo_redundant_backup              = true
    auto_grow_enabled                 = true
    minimum_tls_version               = "TLS1_2"
    infrastructure_encryption_enabled = true
  }
}

# Redis Cache Configuration
variable "redis_config" {
  description = "Configuration for Azure Redis Cache"
  type = object({
    capacity              = number
    family               = string
    sku                  = string
    enable_non_ssl_port  = bool
    minimum_tls_version  = string
    shard_count          = number
    enable_authentication = bool
  })
  
  default = {
    capacity              = 1
    family               = "C"
    sku                  = "Standard"
    enable_non_ssl_port  = false
    minimum_tls_version  = "1.2"
    shard_count          = 1
    enable_authentication = true
  }
}

# InfluxDB Configuration
variable "influxdb_config" {
  description = "Configuration for InfluxDB container"
  type = object({
    cpu                  = string
    memory               = string
    retention_policy_days = number
    backup_enabled       = bool
    ha_enabled          = bool
    monitoring_enabled   = bool
  })
  
  default = {
    cpu                  = "1.0"
    memory               = "1.5"
    retention_policy_days = 30
    backup_enabled       = true
    ha_enabled          = true
    monitoring_enabled   = true
  }
}

# MinIO Storage Configuration
variable "storage_config" {
  description = "Configuration for MinIO storage account"
  type = object({
    account_tier              = string
    replication_type          = string
    min_tls_version          = string
    enable_https_traffic_only = bool
    allow_blob_public_access  = bool
    network_rules = object({
      default_action             = string
      ip_rules                   = list(string)
      virtual_network_subnet_ids = list(string)
    })
  })
  
  default = {
    account_tier              = "Standard"
    replication_type          = "GRS"
    min_tls_version          = "TLS1_2"
    enable_https_traffic_only = true
    allow_blob_public_access  = false
    network_rules = {
      default_action             = "Deny"
      ip_rules                   = []
      virtual_network_subnet_ids = []
    }
  }
}

# Global Backup Configuration
variable "backup_config" {
  description = "Global backup configuration for all database services"
  type = object({
    enabled            = bool
    retention_days     = number
    geo_redundant      = bool
    encryption_enabled = bool
  })
  
  default = {
    enabled            = true
    retention_days     = 30
    geo_redundant      = true
    encryption_enabled = true
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Monitoring configuration for database services"
  type = object({
    metrics_retention_days       = number
    diagnostic_settings_enabled = bool
    alert_rules_enabled        = bool
  })
  
  default = {
    metrics_retention_days       = 90
    diagnostic_settings_enabled = true
    alert_rules_enabled        = true
  }
}

# Resource Tags
variable "tags" {
  description = "Tags to be applied to all database resources"
  type        = map(string)
  default = {
    Component  = "Database"
    ManagedBy  = "Terraform"
    Environment = null
  }
}