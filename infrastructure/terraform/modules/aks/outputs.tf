# ---------------------------------------------------------------------------------------------------------------------
# AKS Cluster Outputs
# Exposes essential cluster information and credentials for external consumption while maintaining security
# ---------------------------------------------------------------------------------------------------------------------

output "cluster_id" {
  description = "The unique identifier of the AKS cluster used for resource referencing and management"
  value       = azurerm_kubernetes_cluster.main.id
}

output "cluster_name" {
  description = "The name identifier of the AKS cluster used for resource identification and API operations"
  value       = azurerm_kubernetes_cluster.main.name
}

output "cluster_fqdn" {
  description = "The fully qualified domain name of the AKS cluster for API server access and DNS resolution"
  value       = azurerm_kubernetes_cluster.main.fqdn
  sensitive   = false
}

output "kube_config" {
  description = "Raw kubeconfig content containing cluster access credentials and configuration - marked sensitive for security"
  value       = azurerm_kubernetes_cluster.main.kube_config_raw
  sensitive   = true
}

output "node_resource_group" {
  description = "The auto-generated Azure resource group name containing AKS cluster infrastructure resources"
  value       = azurerm_kubernetes_cluster.main.node_resource_group
}

output "kubelet_identity" {
  description = "The managed identity object ID used by the kubelet service for node operations and Azure resource access"
  value       = azurerm_kubernetes_cluster.main.kubelet_identity[0].object_id
  sensitive   = false
}