# ─────────────────────────────────────────────────────────────
# DynamoDB Table for Payment Service
# PAY_PER_REQUEST billing to minimize cost for POC
# ─────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "payments" {
  name         = "${var.project_name}-payments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "transactionId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "transactionId"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-payments"
  }
}
