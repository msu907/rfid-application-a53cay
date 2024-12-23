# ---------------------------------------------------------------------------------------------------------------------
# RFID Asset Tracking System - Infrastructure Outputs
# 
# This file defines all infrastructure outputs required for system integration, deployment, and monitoring.
# Sensitive values are marked accordingly to ensure proper handling in CI/CD pipelines and external systems.
# ---------------------------------------------------------------------------------------------------------------------

# Resource Group Output
output "resource_group_name" {
  description = "The name of the resource group containing all infrastructure resources"
  value       = azurerm_resource_group.main.name
}

# ---------------------------------------------------------------------------------------------------------------------
# AKS Cluster Outputs
# Expose essential AKS cluster information for deployment and management
# ---------------------------------------------------------------------------------------------------------------------

output "aks_cluster_id" {
  description = "The unique identifier of the AKS cluster for resource referencing"
  value       = module.aks.cluster_id
}

output "aks_cluster_name" {
  description = "The name of the AKS cluster for administrative purposes"
  value       = module.aks.cluster_name
}

output "aks_kube_config" {
  description = "The kubeconfig for AKS cluster authentication and management"
  value       = module.aks.kube_config
  sensitive   = true # Marked sensitive to protect cluster access credentials
}

output "aks_cluster_endpoint" {
  description = "The endpoint URL for AKS cluster API access"
  value       = module.aks.cluster_endpoint
}

# ---------------------------------------------------------------------------------------------------------------------
# Database Outputs
# Expose database connection information with appropriate security controls
# ---------------------------------------------------------------------------------------------------------------------

output "postgresql_server_id" {
  description = "The unique identifier of the PostgreSQL server for resource referencing"
  value       = module.database.postgresql_server_id
}

output "postgresql_connection_string" {
  description = "The secure connection string for PostgreSQL database access"
  value       = module.database.postgresql_connection_string
  sensitive   = true # Marked sensitive to protect database credentials
}

output "database_credentials" {
  description = "The encrypted credentials for database authentication"
  value       = module.database.database_credentials
  sensitive   = true # Marked sensitive to protect access credentials
}

output "influxdb_fqdn" {
  description = "The fully qualified domain name for InfluxDB time-series database access"
  value       = module.database.influxdb_fqdn
}

# ---------------------------------------------------------------------------------------------------------------------
# Networking Outputs
# Expose networking configuration for system integration and connectivity
# ---------------------------------------------------------------------------------------------------------------------

output "vnet_id" {
  description = "The unique identifier of the virtual network for network integration"
  value       = module.networking.vnet_id
}

output "subnet_ids" {
  description = "Map of subnet names to their unique identifiers for network segmentation"
  value       = module.networking.subnet_ids
}

output "nsg_ids" {
  description = "Map of Network Security Group names to their unique identifiers for security management"
  value       = module.networking.nsg_ids
}

output "express_route_id" {
  description = "The unique identifier of the ExpressRoute circuit for hybrid connectivity"
  value       = module.networking.express_route_id
}