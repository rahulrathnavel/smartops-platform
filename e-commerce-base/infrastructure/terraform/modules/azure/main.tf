# ─────────────────────────────────────────────────────────────
# Azure Resource Group
# ─────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.azure_location

  tags = {
    Project     = var.project_name
    Environment = "poc"
    ManagedBy   = "terraform"
  }
}
