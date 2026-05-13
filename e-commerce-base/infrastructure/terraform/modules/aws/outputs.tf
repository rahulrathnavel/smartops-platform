output "eks_cluster_name" {
  value = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "eks_cluster_ca_certificate" {
  value     = aws_eks_cluster.main.certificate_authority[0].data
  sensitive = true
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.payments.name
}

output "dynamodb_table_arn" {
  value = aws_dynamodb_table.payments.arn
}

output "ecr_repository_urls" {
  value = { for k, v in aws_ecr_repository.services : k => v.repository_url }
}

output "eks_node_role_arn" {
  value = aws_iam_role.eks_nodes.arn
}
