# Provider and Terraform Configuration
# azurerm ~> 3.0
# random ~> 3.0
# tls ~> 4.0
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "tfstate${random_string.suffix.result}"
    container_name      = "tfstate"
    key                 = "terraform.tfstate"
    enable_encryption   = true
  }
}

# Random string for unique naming
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# Configure the Azure Provider
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Data source for current Azure context
data "azurerm_client_config" "current" {}

# Local variables
locals {
  resource_group_name = "${var.project_name}-${var.environment}-rg"
  tags = merge(var.tags, {
    Project            = "RFID Asset Tracking"
    Environment        = var.environment
    ManagedBy         = "Terraform"
    CostCenter        = "IT-Infrastructure"
    DataClassification = "Confidential"
    LastUpdated       = timestamp()
  })
}

# Main Resource Group
resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags

  lifecycle {
    prevent_destroy = true
  }
}

# Resource Group Lock
resource "azurerm_management_lock" "resource_group" {
  name       = "${local.resource_group_name}-lock"
  scope      = azurerm_resource_group.main.id
  lock_level = "CanNotDelete"
  notes      = "Protect production infrastructure from accidental deletion"
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  resource_group_name     = azurerm_resource_group.main.name
  location               = var.location
  environment            = var.environment
  address_space          = var.network_config.vnet_address_space
  subnet_prefixes        = {
    aks          = var.network_config.aks_subnet_prefix
    database     = var.network_config.db_subnet_prefix
    app_gateway  = var.network_config.app_gateway_subnet_prefix
  }
  enable_ddos_protection = var.environment == "prod" ? true : false
  enable_bastion        = true
  tags                  = local.tags
}

# AKS Module
module "aks" {
  source = "./modules/aks"
  depends_on = [module.networking]

  resource_group_name    = azurerm_resource_group.main.name
  location              = var.location
  environment           = var.environment
  cluster_name          = "${var.project_name}-${var.environment}-aks"
  kubernetes_version    = var.aks_config.kubernetes_version
  node_count           = var.aks_config.node_count
  min_count            = var.aks_config.min_count
  max_count            = var.aks_config.max_count
  vm_size              = var.aks_config.vm_size
  availability_zones   = var.aks_config.availability_zones
  vnet_subnet_id       = module.networking.subnet_ids["aks"]
  
  enable_auto_scaling   = true
  network_policy       = var.security_config.network_policy
  enable_pod_security  = var.security_config.enable_pod_security
  
  tags                 = local.tags
}

# Database Module
module "database" {
  source = "./modules/database"
  depends_on = [module.networking]

  resource_group_name       = azurerm_resource_group.main.name
  location                 = var.location
  environment              = var.environment
  server_name              = "${var.project_name}-${var.environment}-db"
  subnet_id                = module.networking.subnet_ids["database"]
  
  sku_name                 = var.database_config.sku
  storage_mb              = var.database_config.storage_mb
  backup_retention_days   = var.database_config.backup_retention_days
  geo_redundant_backup    = var.database_config.geo_redundant_backup
  auto_grow_enabled       = var.database_config.auto_grow
  
  enable_ssl              = var.security_config.enable_ssl
  minimum_tls_version    = var.security_config.min_tls_version
  
  tags                    = local.tags
}

# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  resource_group_name    = azurerm_resource_group.main.name
  location              = var.location
  environment           = var.environment
  workspace_name        = "${var.project_name}-${var.environment}-logs"
  
  retention_in_days     = var.monitoring_config.retention_days
  enable_alerts         = var.monitoring_config.enable_alerts
  enable_metrics        = var.monitoring_config.enable_metrics
  sku                   = var.monitoring_config.workspace_sku
  
  aks_cluster_id        = module.aks.cluster_id
  
  tags                  = local.tags
}

# Outputs
output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "The name of the resource group"
}

output "aks_cluster_credentials" {
  sensitive   = true
  value = {
    kube_config         = module.aks.kube_config
    cluster_endpoint    = module.aks.cluster_endpoint
    cluster_identity_id = module.aks.cluster_identity_id
  }
  description = "AKS cluster access credentials and endpoints"
}

output "database_connection_strings" {
  sensitive   = true
  value = {
    primary = module.database.primary_connection_string
    replica = module.database.replica_connection_string
  }
  description = "Database connection strings for primary and replica instances"
}

output "monitoring_workspace_id" {
  value       = module.monitoring.workspace_id
  description = "Log Analytics workspace ID for monitoring configuration"
}