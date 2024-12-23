# ---------------------------------------------------------------------------------------------------------------------
# Azure Kubernetes Service (AKS) Module
# 
# This module provisions a production-grade AKS cluster with enhanced security, high availability,
# monitoring, and auto-scaling capabilities for the RFID Asset Tracking System.
#
# Provider Requirements:
# - azurerm ~> 3.0
# ---------------------------------------------------------------------------------------------------------------------

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# AKS Cluster Resource
# Provisions a production-ready AKS cluster with:
# - Private cluster deployment
# - Azure AD integration with RBAC
# - Multi-zone availability
# - Network policies and controlled egress
# - Integrated monitoring with Log Analytics
# ---------------------------------------------------------------------------------------------------------------------

resource "azurerm_kubernetes_cluster" "main" {
  name                = "${var.prefix}-aks-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix         = "${var.prefix}-aks-${var.environment}"
  kubernetes_version = var.kubernetes_version

  # Enable private cluster for enhanced security
  private_cluster_enabled = true
  sku_tier              = "Standard" # Production-grade SLA

  # Default node pool configuration with multi-zone deployment
  default_node_pool {
    name                = "default"
    vm_size             = var.node_pool_vm_size
    vnet_subnet_id      = var.aks_subnet_id
    enable_auto_scaling = true
    min_count          = var.min_node_count
    max_count          = var.max_node_count
    os_disk_size_gb    = 128
    type               = "VirtualMachineScaleSets"
    zones              = [1, 2, 3] # Multi-zone deployment for high availability

    # Node labels for workload identification
    node_labels = {
      environment = var.environment
      workload    = "general"
    }

    # Resource tagging for cost allocation and management
    tags = {
      environment = var.environment
      managed-by  = "terraform"
      purpose     = "rfid-asset-tracking"
    }
  }

  # System-assigned managed identity for enhanced security
  identity {
    type = "SystemAssigned"
  }

  # Azure AD integration with RBAC
  azure_active_directory_role_based_access_control {
    managed               = true
    azure_rbac_enabled    = true
    admin_group_object_ids = var.aks_admin_group_ids
  }

  # Network profile with advanced security features
  network_profile {
    network_plugin     = "azure"
    network_policy     = "calico" # Enable network policies for pod isolation
    load_balancer_sku = "standard"
    outbound_type     = "userDefinedRouting" # Control egress traffic
    docker_bridge_cidr = "172.17.0.1/16"
    dns_service_ip     = "10.0.0.10"
    service_cidr       = "10.0.0.0/16"
  }

  # Enable monitoring with Log Analytics
  oms_agent {
    log_analytics_workspace_id = var.log_analytics_workspace_id
  }

  # Maintenance window configuration
  maintenance_window {
    allowed {
      day   = "Sunday"
      hours = [0, 1, 2]
    }
  }

  # Cluster autoscaler profile for optimized scaling
  auto_scaler_profile {
    scale_down_delay_after_add = "15m"
    scale_down_unneeded       = "15m"
    max_graceful_termination_sec = "600"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# Outputs
# Expose essential cluster information for external consumption
# ---------------------------------------------------------------------------------------------------------------------

output "cluster_id" {
  description = "The ID of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.id
}

output "cluster_name" {
  description = "The name of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_fqdn" {
  description = "The FQDN of the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.fqdn
  sensitive   = true
}

output "kube_config_raw" {
  description = "Raw kubeconfig content for the AKS cluster"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "node_resource_group" {
  description = "The auto-generated resource group name for cluster resources"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}

output "kubelet_identity" {
  description = "The identity used by the Kubelet service"
  value       = azurerm_kubernetes_cluster.main.kubelet_identity
  sensitive   = true
}

output "cluster_identity" {
  description = "The cluster's managed identity details"
  value       = azurerm_kubernetes_cluster.main.identity
  sensitive   = true
}