# ─────────────────────────────────────────────────────────────
# Root Module - Wires AWS and Azure modules together
# ─────────────────────────────────────────────────────────────

module "aws" {
  source = "./modules/aws"

  project_name           = var.project_name
  aws_region             = var.aws_region
  eks_node_instance_type = var.eks_node_instance_type
  eks_node_count         = var.eks_node_count
  budget_limit           = var.budget_limit
  budget_alert_email     = var.budget_alert_email
}

module "azure" {
  source = "./modules/azure"

  project_name   = var.project_name
  azure_location = var.azure_location
}
