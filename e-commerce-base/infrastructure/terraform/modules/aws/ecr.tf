# ─────────────────────────────────────────────────────────────
# ECR Repositories for all microservice Docker images
# ─────────────────────────────────────────────────────────────

locals {
  ecr_repos = [
    "user-service",
    "catalog-service",
    "cart-service",
    "payment-service",
    "order-service",
    "api-gateway",
    "frontend",
    "smartops-dashboard-backend",
    "smartops-dashboard-frontend",
  ]
}

resource "aws_ecr_repository" "services" {
  for_each             = toset(local.ecr_repos)
  name                 = "${var.project_name}/${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = {
    Name = "${var.project_name}-${each.key}"
  }
}

# Lifecycle policy to keep only 3 images per repo (cost saving)
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only 3 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 3
      }
      action = {
        type = "expire"
      }
    }]
  })
}
