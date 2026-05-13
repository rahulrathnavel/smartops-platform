# ─────────────────────────────────────────────────────────────
# Azure Log Analytics Workspace + Application Insights
# Central observability backend for OTel data
# ─────────────────────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Project     = var.project_name
    Environment = "poc"
  }
}

resource "azurerm_application_insights" "main" {
  name                = "${var.project_name}-appinsights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "Node.JS"

  tags = {
    Project     = var.project_name
    Environment = "poc"
  }
}
