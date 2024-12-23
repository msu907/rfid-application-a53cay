# Backend configuration for Terraform state management in Azure Storage
# Version: Azure Provider >= 3.0.0
# This configuration enables secure state storage with encryption, locking, and workspace support

terraform {
  backend "azurerm" {
    # Resource group and storage account names follow project naming convention
    resource_group_name  = "${var.project_name}-${var.environment}-tfstate"
    storage_account_name = "${var.project_name}${var.environment}tfstate"
    container_name      = "tfstate"
    key                = "terraform.tfstate"

    # Security features
    use_msi            = true              # Use Managed Identity for authentication
    subscription_id    = "${var.subscription_id}"
    tenant_id          = "${var.tenant_id}"
    use_azuread_auth   = true             # Enable Azure AD authentication
    enable_blob_encryption = true          # Enable encryption at rest

    # State management features
    workspace_key_prefix = "workspaces"    # Prefix for workspace state files
    lock_timeout        = "5m"             # State file locking timeout
  }
}

# Note: The following variables must be defined in variables.tf and provided during initialization:
# - var.project_name: The name of the RFID Asset Tracking project
# - var.environment: The deployment environment (dev/staging/prod)
# - var.subscription_id: The Azure subscription ID
# - var.tenant_id: The Azure tenant ID

# Prerequisites:
# 1. Azure Storage Account must be created with:
#    - Blob versioning enabled
#    - Soft delete enabled
#    - Encryption at rest enabled
#    - Firewall rules configured
#    - RBAC permissions set up for Terraform service principal
#
# 2. Resource group must exist with appropriate RBAC permissions
#
# 3. Container named 'tfstate' must be created in the storage account
#
# 4. Managed Identity must have the following roles assigned:
#    - Storage Blob Data Contributor
#    - Storage Table Data Contributor