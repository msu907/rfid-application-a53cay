# Virtual Network Outputs
output "vnet_id" {
  description = "The ID of the virtual network for the RFID Asset Tracking System"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "The name of the virtual network for consistent resource naming"
  value       = azurerm_virtual_network.main.name
}

# Subnet Outputs
output "subnet_ids" {
  description = "Map of subnet names to their IDs for tier-specific network segregation"
  value       = {
    for k, v in azurerm_subnet.subnets : k => v.id
  }
}

# Network Security Group Outputs
output "nsg_ids" {
  description = "Map of NSG names to their IDs for implementing security rules"
  value       = {
    for k, v in azurerm_network_security_group.nsgs : k => v.id
  }
}

# Additional Network Information
output "vnet_address_space" {
  description = "The address space of the virtual network"
  value       = azurerm_virtual_network.main.address_space
}

output "subnet_address_prefixes" {
  description = "Map of subnet names to their address prefixes"
  value       = {
    for k, v in azurerm_subnet.subnets : k => v.address_prefixes[0]
  }
}

output "nsg_associations" {
  description = "Map of subnet names to their associated NSG IDs"
  value       = {
    for k, v in azurerm_subnet_network_security_group_association.nsg_associations : k => v.network_security_group_id
  }
}

# Service Endpoints Information
output "subnet_service_endpoints" {
  description = "Map of subnet names to their enabled service endpoints"
  value       = {
    for k, v in azurerm_subnet.subnets : k => v.service_endpoints
  }
}

# Resource Naming
output "resource_naming" {
  description = "Map of resource names for reference by other modules"
  value = {
    vnet = azurerm_virtual_network.main.name
    subnets = {
      for k, v in azurerm_subnet.subnets : k => v.name
    }
    nsgs = {
      for k, v in azurerm_network_security_group.nsgs : k => v.name
    }
  }
}