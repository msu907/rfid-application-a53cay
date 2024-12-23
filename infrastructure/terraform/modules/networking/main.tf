# Provider configuration with Azure RM version ~> 3.0
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Main Virtual Network Resource
resource "azurerm_virtual_network" "main" {
  name                = "${var.environment}-rfid-vnet"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space

  # DNS servers can be added here if needed
  dns_servers = []

  tags = merge(var.tags, {
    Component = "Networking"
    Environment = var.environment
    ManagedBy = "Terraform"
  })

  lifecycle {
    prevent_destroy = true # Prevent accidental deletion of the VNET
  }
}

# Subnet Resources
resource "azurerm_subnet" "subnets" {
  for_each = var.subnet_configurations

  name                 = "${var.environment}-${each.key}-subnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [each.value.address_prefix]
  service_endpoints    = each.value.service_endpoints

  # Handle subnet delegation if specified
  dynamic "delegation" {
    for_each = each.value.delegation != null ? [each.value.delegation] : []
    content {
      name = delegation.value.name
      service_delegation {
        name    = delegation.value.service_delegation.name
        actions = delegation.value.service_delegation.actions
      }
    }
  }
}

# Network Security Groups
resource "azurerm_network_security_group" "nsgs" {
  for_each = var.nsg_rules

  name                = "${var.environment}-${each.key}-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name

  dynamic "security_rule" {
    for_each = each.value
    content {
      name                       = security_rule.value.name
      priority                   = security_rule.value.priority
      direction                  = security_rule.value.direction
      access                    = security_rule.value.access
      protocol                  = security_rule.value.protocol
      source_port_range         = security_rule.value.source_port_range
      destination_port_range    = security_rule.value.destination_port_range
      source_address_prefix     = security_rule.value.source_address_prefix
      destination_address_prefix = security_rule.value.destination_address_prefix
    }
  }

  tags = merge(var.tags, {
    Component = "Security"
    Environment = var.environment
    ManagedBy = "Terraform"
  })
}

# NSG-Subnet Associations
resource "azurerm_subnet_network_security_group_association" "nsg_associations" {
  for_each = var.subnet_configurations

  subnet_id                 = azurerm_subnet.subnets[each.key].id
  network_security_group_id = azurerm_network_security_group.nsgs[each.key].id
}

# Outputs for use by other modules
output "vnet_id" {
  description = "The ID of the Virtual Network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "The name of the Virtual Network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet names to their IDs"
  value       = {
    for k, v in azurerm_subnet.subnets : k => v.id
  }
}

output "nsg_ids" {
  description = "Map of NSG names to their IDs"
  value       = {
    for k, v in azurerm_network_security_group.nsgs : k => v.id
  }
}

# Diagnostic settings for network monitoring
resource "azurerm_monitor_diagnostic_setting" "vnet_diagnostics" {
  name                       = "${var.environment}-vnet-diagnostics"
  target_resource_id         = azurerm_virtual_network.main.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  log {
    category = "VMProtectionAlerts"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }

  metric {
    category = "AllMetrics"
    enabled  = true

    retention_policy {
      enabled = true
      days    = 30
    }
  }
}