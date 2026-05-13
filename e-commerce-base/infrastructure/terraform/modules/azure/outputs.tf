output "cosmosdb_connection_string" {
  value     = azurerm_cosmosdb_account.main.primary_mongodb_connection_string
  sensitive = true
}

output "cosmosdb_account_name" {
  value = azurerm_cosmosdb_account.main.name
}

output "cosmosdb_users_db" {
  value = azurerm_cosmosdb_mongo_database.users.name
}

output "cosmosdb_catalog_db" {
  value = azurerm_cosmosdb_mongo_database.catalog.name
}

output "cosmosdb_orders_db" {
  value = azurerm_cosmosdb_mongo_database.orders.name
}

output "appinsights_connection_string" {
  value     = azurerm_application_insights.main.connection_string
  sensitive = true
}

output "appinsights_instrumentation_key" {
  value     = azurerm_application_insights.main.instrumentation_key
  sensitive = true
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}
