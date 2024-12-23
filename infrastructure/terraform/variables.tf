# Project Identification
variable "project_name" {
  description = "Name of the RFID Asset Tracking project used for resource naming and tagging"
  type        = string
  default     = "rfid-asset-tracking"

  validation {
    condition     = length(var.project_name) <= 20 && can(regex("^[a-zA-Z0-9-]*$", var.project_name))
    error_message = "Project name must be alphanumeric with hyphens and maximum 20 characters"
  }
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment that determines resource sizing and configuration"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Azure Region
variable "location" {
  description = "Azure region for resource deployment with consideration for data residency"
  type        = string
  default     = "eastus"
}

# Network Configuration
variable "network_config" {
  description = "Network configuration for VNet and subnets"
  type = object({
    vnet_address_space         = list(string)
    aks_subnet_prefix          = list(string)
    db_subnet_prefix           = list(string)
    app_gateway_subnet_prefix  = list(string)
  })
  default = {
    vnet_address_space         = ["10.0.0.0/16"]
    aks_subnet_prefix          = ["10.0.1.0/24"]
    db_subnet_prefix          = ["10.0.2.0/24"]
    app_gateway_subnet_prefix = ["10.0.3.0/24"]
  }
}

# AKS Configuration
variable "aks_config" {
  description = "AKS cluster configuration including scaling and node pools"
  type = object({
    node_count          = number
    min_count          = number
    max_count          = number
    vm_size            = string
    availability_zones = list(string)
    kubernetes_version = string
  })
  default = {
    node_count          = 3
    min_count          = 2
    max_count          = 5
    vm_size            = "Standard_DS2_v2"
    availability_zones = ["1", "2", "3"]
    kubernetes_version = "1.25.0"
  }
}

# Database Configuration
variable "database_config" {
  description = "Azure Database for PostgreSQL configuration"
  type = object({
    sku                    = string
    storage_mb            = number
    backup_retention_days = number
    geo_redundant_backup  = bool
    auto_grow             = bool
  })
  default = {
    sku                    = "GP_Gen5_2"
    storage_mb            = 102400
    backup_retention_days = 7
    geo_redundant_backup  = false
    auto_grow             = true
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Monitoring and logging configuration"
  type = object({
    retention_days  = number
    enable_alerts  = bool
    enable_metrics = bool
    workspace_sku  = string
  })
  default = {
    retention_days  = 30
    enable_alerts  = true
    enable_metrics = true
    workspace_sku  = "PerGB2018"
  }
}

# Security Configuration
variable "security_config" {
  description = "Security configuration for all components"
  type = object({
    enable_ssl            = bool
    min_tls_version      = string
    network_policy       = string
    enable_pod_security  = bool
    enable_disk_encryption = bool
  })
  default = {
    enable_ssl            = true
    min_tls_version      = "1.2"
    network_policy       = "calico"
    enable_pod_security  = true
    enable_disk_encryption = true
  }
}

# Resource Tags
variable "tags" {
  description = "Resource tags for organization and cost tracking"
  type        = map(string)
  default = {
    Project      = "RFID Asset Tracking"
    Environment  = "Production"
    ManagedBy    = "Terraform"
    BusinessUnit = "Operations"
    CostCenter   = "IT-123"
  }
}