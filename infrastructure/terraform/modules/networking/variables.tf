# Resource Group Configuration
variable "resource_group_name" {
  description = "Name of the resource group where networking resources will be created"
  type        = string
}

variable "location" {
  description = "Azure region where networking resources will be deployed"
  type        = string
}

# Environment Configuration
variable "environment" {
  description = "Environment identifier (dev, staging, prod)"
  type        = string
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Virtual Network Configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network in CIDR notation"
  type        = list(string)
  validation {
    condition     = can([for cidr in var.vnet_address_space : regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr)])
    error_message = "Virtual network address space must be valid CIDR notation."
  }
}

# Subnet Configuration
variable "subnet_configurations" {
  description = "Map of subnet configurations including address prefixes and service endpoints"
  type = map(object({
    address_prefix    = string
    service_endpoints = list(string)
    delegation = optional(map(object({
      name = string
      service_delegation = object({
        name    = string
        actions = list(string)
      })
    })))
  }))
  validation {
    condition     = can([for k, v in var.subnet_configurations : regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", v.address_prefix)])
    error_message = "Subnet address prefixes must be valid CIDR notation."
  }
}

# Network Security Group Rules
variable "nsg_rules" {
  description = "Map of network security group rules for each subnet"
  type = map(list(object({
    name                       = string
    priority                   = number
    direction                  = string
    access                    = string
    protocol                  = string
    source_port_range         = string
    destination_port_range    = string
    source_address_prefix     = string
    destination_address_prefix = string
  })))
  validation {
    condition     = can([for k, v in var.nsg_rules : alltrue([for rule in v : rule.priority >= 100 && rule.priority <= 4096])])
    error_message = "NSG rule priorities must be between 100 and 4096."
  }
}

# Resource Tags
variable "tags" {
  description = "Tags to be applied to all networking resources"
  type        = map(string)
  default     = {}
}