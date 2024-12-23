# Project Identification
project_name = "rfid-asset-tracking"
environment  = "prod"
location     = "eastus"

# Network Configuration
vnet_address_space = ["10.0.0.0/16"]

# AKS Configuration
aks_node_count = 5
aks_vm_size    = "Standard_DS3_v2"

# Database Configuration
postgresql_sku = "GP_Gen5_4"

# Redis Cache Configuration
redis_sku = "Premium"

# Storage Configuration
storage_replication = "GRS"

# Backup Configuration
backup_retention_days = 35

# Resource Tags
tags = {
  Project             = "RFID Asset Tracking"
  Environment         = "Production"
  ManagedBy          = "Terraform"
  CostCenter         = "IT-Prod"
  BusinessUnit       = "Operations"
  DataClassification = "Confidential"
  Compliance         = "ISO27001"
  DR                 = "Critical"
}

# Extended Production Configuration
network_config = {
  vnet_address_space         = ["10.0.0.0/16"]
  aks_subnet_prefix          = ["10.0.1.0/24"]
  db_subnet_prefix           = ["10.0.2.0/24"]
  app_gateway_subnet_prefix  = ["10.0.3.0/24"]
}

aks_config = {
  node_count          = 5
  min_count          = 3
  max_count          = 7
  vm_size            = "Standard_DS3_v2"
  availability_zones = ["1", "2", "3"]
  kubernetes_version = "1.25.0"
}

database_config = {
  sku                    = "GP_Gen5_4"
  storage_mb            = 524288  # 512 GB
  backup_retention_days = 35
  geo_redundant_backup  = true
  auto_grow             = true
}

monitoring_config = {
  retention_days  = 90
  enable_alerts  = true
  enable_metrics = true
  workspace_sku  = "PerGB2018"
}

security_config = {
  enable_ssl            = true
  min_tls_version      = "1.2"
  network_policy       = "calico"
  enable_pod_security  = true
  enable_disk_encryption = true
}