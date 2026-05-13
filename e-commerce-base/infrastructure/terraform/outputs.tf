# ─────────────────────────────────────────────────────────────
# Root Outputs
# ─────────────────────────────────────────────────────────────

# AWS Outputs
output "eks_cluster_name" {
  description = "EKS cluster name for kubectl config"
  value       = module.aws.eks_cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.aws.eks_cluster_endpoint
}

output "ecr_repository_urls" {
  description = "ECR repository URLs for Docker push"
  value       = module.aws.ecr_repository_urls
}

output "dynamodb_table_name" {
  description = "DynamoDB table name for Payment Service"
  value       = module.aws.dynamodb_table_name
}

# Azure Outputs
output "cosmosdb_connection_string" {
  description = "Cosmos DB MongoDB connection string"
  value       = module.azure.cosmosdb_connection_string
  sensitive   = true
}

output "cosmosdb_users_db" {
  description = "Cosmos DB database name for User Service"
  value       = module.azure.cosmosdb_users_db
}

output "cosmosdb_catalog_db" {
  description = "Cosmos DB database name for Catalog Service"
  value       = module.azure.cosmosdb_catalog_db
}

output "cosmosdb_orders_db" {
  description = "Cosmos DB database name for Order Service"
  value       = module.azure.cosmosdb_orders_db
}

output "appinsights_connection_string" {
  description = "Application Insights connection string for OTel Collector"
  value       = module.azure.appinsights_connection_string
  sensitive   = true
}

output "appinsights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = module.azure.appinsights_instrumentation_key
  sensitive   = true
}
