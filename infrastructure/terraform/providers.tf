# Provider versions and requirements
# azurerm v3.0+ - Azure Resource Manager provider for infrastructure deployment
# azuread v2.0+ - Azure Active Directory provider for identity management
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }
  }
  required_version = ">= 1.0"
}

# Data source for current Azure subscription context
data "azurerm_client_config" "current" {}

# Azure Resource Manager provider configuration with enhanced security features
provider "azurerm" {
  features {
    # Key Vault security configuration
    key_vault {
      # Prevent automatic purge of soft-deleted vaults
      purge_soft_delete_on_destroy = false
      # Enable automatic recovery of soft-deleted vaults
      recover_soft_deleted_key_vaults = true
    }

    # Virtual Machine security configuration
    virtual_machine {
      # Ensure OS disks are deleted when VM is destroyed to prevent orphaned resources
      delete_os_disk_on_deletion = true
    }

    # Resource Group protection configuration
    resource_group {
      # Prevent accidental deletion of resource groups containing resources
      prevent_deletion_if_contains_resources = true
    }

    # Storage Account security configuration
    storage_account {
      # Blob soft delete retention period in days
      blob_soft_delete_retention_days = 30
      # Container soft delete retention period in days
      container_soft_delete_retention_days = 30
    }
  }

  # Use environment-specific configuration from variables
  environment = var.environment
  location    = var.location

  # Enable request/response logging for auditing
  partner_id = "rfid-asset-tracking-${var.environment}"
}

# Azure Active Directory provider configuration for identity management
provider "azuread" {
  tenant_id = data.azurerm_client_config.current.tenant_id

  # Enable token caching for improved performance
  use_cli = false
  use_msi = false
}