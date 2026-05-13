variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "eks_node_instance_type" {
  type = string
}

variable "eks_node_count" {
  type = number
}

variable "budget_limit" {
  type = number
}

variable "budget_alert_email" {
  type = string
}
