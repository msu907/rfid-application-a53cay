# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED VARIABLES
# These variables must be set when using this module.
# ---------------------------------------------------------------------------------------------------------------------

variable "prefix" {
  description = "Prefix to be used for all AKS related resources"
  type        = string
  validation {
    condition     = length(var.prefix) <= 10 && can(regex("^[a-zA-Z0-9]+$", var.prefix))
    error_message = "Prefix must be alphanumeric and cannot be longer than 10 characters"
  }
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "location" {
  description = "Azure region where AKS cluster will be deployed"
  type        = string
  validation {
    condition     = contains(["eastus", "westus", "northeurope", "westeurope"], var.location)
    error_message = "Location must be a supported Azure region for AKS deployment"
  }
}

variable "resource_group_name" {
  description = "Name of the resource group where AKS cluster will be deployed"
  type        = string
  validation {
    condition     = length(var.resource_group_name) >= 3 && length(var.resource_group_name) <= 63
    error_message = "Resource group name must be between 3 and 63 characters"
  }
}

variable "aks_subnet_id" {
  description = "ID of the subnet where AKS nodes will be deployed"
  type        = string
  validation {
    condition     = can(regex("^/subscriptions/.*subnets/[a-zA-Z0-9-_]+$", var.aks_subnet_id))
    error_message = "Subnet ID must be a valid Azure resource ID"
  }
}

variable "aks_admin_group_ids" {
  description = "List of Azure AD group object IDs that will have admin access to the cluster"
  type        = list(string)
  sensitive   = true
  validation {
    condition     = length(var.aks_admin_group_ids) > 0
    error_message = "At least one admin group ID must be provided"
  }
}

variable "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace for AKS monitoring"
  type        = string
  validation {
    condition     = can(regex("^/subscriptions/.*workspaces/[a-zA-Z0-9-_]+$", var.log_analytics_workspace_id))
    error_message = "Log Analytics workspace ID must be a valid Azure resource ID"
  }
}

# ---------------------------------------------------------------------------------------------------------------------
# OPTIONAL VARIABLES
# These variables have defaults, but may be overridden.
# ---------------------------------------------------------------------------------------------------------------------

variable "node_pool_vm_size" {
  description = "VM size for the default node pool"
  type        = string
  default     = "Standard_DS2_v2"
  validation {
    condition = contains([
      "Standard_DS2_v2",
      "Standard_DS3_v2",
      "Standard_DS4_v2",
      "Standard_D4s_v3",
      "Standard_D8s_v3"
    ], var.node_pool_vm_size)
    error_message = "VM size must be one of the approved sizes for AKS nodes"
  }
}

variable "min_node_count" {
  description = "Minimum number of nodes in the default node pool"
  type        = number
  default     = 3
  validation {
    condition     = var.min_node_count >= 3 && var.min_node_count <= var.max_node_count
    error_message = "Minimum node count must be at least 3 and not greater than maximum node count"
  }
}

variable "max_node_count" {
  description = "Maximum number of nodes in the default node pool"
  type        = number
  default     = 5
  validation {
    condition     = var.max_node_count <= 20 && var.max_node_count >= var.min_node_count
    error_message = "Maximum node count must not exceed 20 and must be greater than or equal to minimum node count"
  }
}

variable "kubernetes_version" {
  description = "Version of Kubernetes to use for the AKS cluster"
  type        = string
  default     = "1.25.0"
  validation {
    condition     = can(regex("^1\\.(2[4-5]|26)\\.[0-9]+$", var.kubernetes_version))
    error_message = "Kubernetes version must be 1.24.x, 1.25.x, or 1.26.x"
  }
}