# ─────────────────────────────────────────────────────────────
# Azure Cosmos DB Account (MongoDB API)
# Using Serverless capacity mode for minimal POC cost
# ─────────────────────────────────────────────────────────────

resource "azurerm_cosmosdb_account" "main" {
  name                = "${var.project_name}-cosmos"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  offer_type          = "Standard"
  kind                = "MongoDB"
  free_tier_enabled   = false

  capabilities {
    name = "EnableMongo"
  }

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = azurerm_resource_group.main.location
    failover_priority = 0
  }

  tags = {
    Project     = var.project_name
    Environment = "poc"
  }
}

# MongoDB Databases
resource "azurerm_cosmosdb_mongo_database" "users" {
  name                = "${var.project_name}-users"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_mongo_database" "catalog" {
  name                = "${var.project_name}-catalog"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}

resource "azurerm_cosmosdb_mongo_database" "orders" {
  name                = "${var.project_name}-orders"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
}
