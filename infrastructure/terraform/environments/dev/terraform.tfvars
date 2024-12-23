# Project and Environment Configuration
# Used for resource naming and tagging across all Azure resources
project_name = "rfid-asset-tracking"
environment  = "dev"
location     = "eastus"

# Network Configuration
# Development environment virtual network and subnet configuration
vnet_address_space = ["10.0.0.0/16"]
subnet_address_prefixes = {
  aks = "10.0.1.0/24"  # Subnet for AKS cluster
  db  = "10.0.2.0/24"  # Subnet for database services
  app = "10.0.3.0/24"  # Subnet for application services
}

# AKS Configuration
# Development cluster sized for basic workloads while maintaining cost efficiency
aks_node_count = 2          # Minimum viable cluster size for development
aks_vm_size    = "Standard_DS2_v2"  # 2 vCPU, 7 GB RAM - suitable for dev workloads

# Database Configuration
# General purpose tier suitable for development with cost optimization
postgresql_sku = "GP_Gen5_2"  # General Purpose tier with 2 vCores

# Cache Configuration
# Basic tier sufficient for development caching needs
redis_cache_sku = "Basic"  # Basic tier for development caching

# Resource Tagging
# Comprehensive tagging strategy for resource organization and cost tracking
tags = {
  Project      = "RFID Asset Tracking"
  Environment  = "Development"
  ManagedBy    = "Terraform"
  CostCenter   = "Development"
  Owner        = "DevTeam"
  CreatedDate  = "2023-10-01"
}