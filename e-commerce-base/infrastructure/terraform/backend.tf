# Local state backend for POC
# No remote backend configured - state stored locally
terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
