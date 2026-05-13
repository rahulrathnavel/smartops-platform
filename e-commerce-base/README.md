# Ammazone — Dual-Cloud E-Commerce Microservices Platform

A production-grade e-commerce platform built on a microservices architecture, deployed across AWS and Azure using Kubernetes, Terraform, and Docker. The system demonstrates real-world cloud-native patterns including event-driven communication, distributed tracing, and infrastructure as code.

---

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Services Overview](#services-overview)
- [Infrastructure](#infrastructure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [API Reference](#api-reference)
- [Cost Considerations](#cost-considerations)
- [Teardown](#teardown)

---

## Architecture

The platform follows a microservices architecture distributed across two cloud providers:

- **AWS (ap-south-1)** handles compute (EKS), container registry (ECR), and payment storage (DynamoDB).
- **Azure (centralindia)** handles data persistence (Cosmos DB with MongoDB API), monitoring (Application Insights), and log aggregation (Log Analytics).

```
                          +-------------------+
                          |   User Browser    |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |   Frontend        |
                          |   (React + Nginx) |
                          +--------+----------+
                                   |
                          +--------v----------+
                          |   API Gateway     |
                          |   (Express.js)    |
                          +---+---+---+---+---+
                              |   |   |   |
              +---------------+   |   |   +----------------+
              |               |   |   |                    |
     +--------v--+    +------v-+ | +--v--------+   +------v------+
     |  User     |    |Catalog | | |  Cart      |   |  Payment    |
     |  Service  |    |Service | | |  Service   |   |  Service    |
     +-----+-----+    +---+---+ | +------+-----+   +------+------+
           |               |    |        |                 |
     +-----v-----+   +----v--+ |  +-----v-----+   +------v------+
     | Cosmos DB  |   |Cosmos | |  |   Redis    |   |  DynamoDB   |
     | (Users)    |   |(Catalog)| |  (Cache)    |   | (Payments)  |
     +------------+   +--------+ |  +-----------+   +-------------+
                                  |
                          +-------v--------+
                          | Order Service  |
                          +-------+--------+
                                  |
                    +-------------+-------------+
                    |                           |
              +-----v------+            +------v------+
              |  Cosmos DB  |            |  RabbitMQ   |
              |  (Orders)   |            |  (Events)   |
              +-------------+            +-------------+
```

### Data Flow

1. **Browse products**: Frontend calls the API Gateway, which proxies to the Catalog Service. Products are stored in and fetched from Azure Cosmos DB.
2. **User authentication**: Registration and login requests route through the API Gateway to the User Service, which stores credentials (bcrypt-hashed) in Cosmos DB.
3. **Cart management**: Cart operations are handled by the Cart Service using Redis for fast in-memory storage with TTL expiry.
4. **Order placement**: The Order Service creates an order record in Cosmos DB and publishes an `order.created` event to RabbitMQ.
5. **Payment processing**: The Payment Service consumes the order event, processes payment, stores the record in DynamoDB, and publishes a `payment.completed` event back through RabbitMQ.
6. **Order completion**: The Order Service listens for payment events and updates the order status accordingly.

---

## Technology Stack

### Compute and Orchestration

| Technology | Role |
|---|---|
| AWS EKS | Managed Kubernetes cluster hosting all microservices |
| Docker | Container runtime; each service is packaged as a lightweight Alpine Linux image |
| AWS ECR | Private container registry for storing Docker images |
| Helm | Package manager used to install the AWS Load Balancer Controller |
| kubectl | Kubernetes CLI for deployment and operations |

### Backend Services

| Technology | Role |
|---|---|
| Node.js 22 (Alpine) | Runtime for all microservices |
| Express.js 4 | HTTP framework for REST APIs |
| Mongoose 6 | MongoDB ODM for Cosmos DB communication |
| http-proxy-middleware | API Gateway request routing and trace propagation |
| amqplib | RabbitMQ client for event-driven messaging |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT-based authentication |

### Frontend

| Technology | Role |
|---|---|
| React 18 | Single-page application framework |
| Vite | Build tool and development server |
| React Router | Client-side routing |
| Framer Motion | UI animations |
| Nginx | Production static file server with reverse proxy to API |

### Data Stores

| Technology | Cloud | Role |
|---|---|---|
| Azure Cosmos DB (MongoDB API) | Azure | Three databases: users, catalog, orders |
| AWS DynamoDB | AWS | Payment transaction records (on-demand capacity) |
| Redis | EKS (self-hosted) | Cart session cache with TTL |
| RabbitMQ | EKS (self-hosted) | Asynchronous event broker between Order and Payment services |

### Infrastructure as Code

| Technology | Role |
|---|---|
| Terraform | Provisions all cloud resources across AWS and Azure (42+ resources) |
| HCL modules | Separate AWS and Azure modules for clean separation of concerns |

### Monitoring and Observability

| Technology | Role |
|---|---|
| OpenTelemetry SDK | Distributed tracing instrumented in all services |
| Azure Application Insights | Trace collection, performance monitoring, failure tracking |
| Azure Log Analytics | Centralized log aggregation and KQL-based querying |
| Structured JSON logging | Every service outputs machine-parseable JSON logs with trace IDs |

---

## Project Structure

```
e-commerce-base/
|
|-- e-commerce-main/              # Frontend application
|   |-- src/
|   |   |-- components/           # Reusable UI components (Navbar, ProductCard, Footer)
|   |   |-- context/              # StoreContext - global state with API integration
|   |   |-- data/                 # Static fallback data (products, testimonials)
|   |   |-- pages/                # Route pages (Home, Products, Cart, Checkout, Login)
|   |-- nginx.conf                # Production Nginx config with /api/ reverse proxy
|   |-- Dockerfile                # Multi-stage build: Node (build) -> Nginx (serve)
|
|-- services/
|   |-- api-gateway/              # Central request router with trace propagation
|   |   |-- src/
|   |   |   |-- index.js          # Express app with proxy middleware and analytics endpoint
|   |   |   |-- tracing.js        # OpenTelemetry SDK initialization
|   |
|   |-- user-service/             # User registration and authentication
|   |   |-- src/
|   |   |   |-- index.js          # Express app with Cosmos DB connection
|   |   |   |-- routes/auth.js    # Register, login, profile endpoints
|   |   |   |-- models/User.js    # Mongoose user schema
|   |
|   |-- catalog-service/          # Product catalog management
|   |   |-- src/
|   |   |   |-- index.js          # Express app with Cosmos DB connection
|   |   |   |-- routes/products.js # Product listing, filtering, search
|   |   |   |-- models/Product.js # Mongoose product schema
|   |   |   |-- seed/seed.js      # Database seed script (20 products)
|   |
|   |-- cart-service/             # Shopping cart with Redis backend
|   |   |-- src/
|   |   |   |-- index.js          # Express app with Redis connection
|   |   |   |-- routes/cart.js    # Cart CRUD operations
|   |
|   |-- order-service/            # Order lifecycle management
|   |   |-- src/
|   |   |   |-- index.js          # Express app with Cosmos DB + RabbitMQ
|   |   |   |-- routes/orders.js  # Order creation, status tracking
|   |   |   |-- models/Order.js   # Mongoose order schema
|   |
|   |-- payment-service/          # Payment processing simulation
|       |-- src/
|       |   |-- index.js          # Express app with DynamoDB + RabbitMQ
|       |   |-- lib/dynamo.js     # AWS DynamoDB client configuration
|
|-- k8s/                          # Kubernetes manifests
|   |-- namespace.yaml            # ammazone namespace
|   |-- configmap.yaml            # Service URLs and environment configuration
|   |-- secrets.yaml              # Template for sensitive values (Cosmos DB, JWT)
|   |-- ingress.yaml              # ALB Ingress routing rules
|   |-- services/                 # Deployment + Service manifests for all 7 services
|   |-- infra/                    # Redis, RabbitMQ, and OpenTelemetry Collector manifests
|
|-- infrastructure/
|   |-- terraform/
|       |-- main.tf               # Root module calling AWS and Azure submodules
|       |-- providers.tf          # AWS and Azure provider configuration
|       |-- variables.tf          # Input variable definitions
|       |-- terraform.tfvars      # Variable values (instance types, regions, budget)
|       |-- outputs.tf            # Exported values (endpoints, connection strings)
|       |-- modules/
|           |-- aws/              # EKS cluster, ECR repos, VPC, DynamoDB, IAM roles
|           |-- azure/            # Cosmos DB, App Insights, Log Analytics, budgets
|
|-- scripts/
    |-- deploy.ps1                # Automated deployment pipeline
    |-- teardown.ps1              # Infrastructure cleanup script
```

---

## Services Overview

### API Gateway (Port 3000)

Central entry point for all client requests. Routes traffic to downstream services using `http-proxy-middleware`. Propagates OpenTelemetry trace context headers across service boundaries. Includes a dedicated analytics endpoint that logs every user interaction event (page views, product clicks, cart additions, purchases) as structured JSON.

### User Service (Port 3001)

Handles user registration and authentication. Passwords are hashed using bcrypt before storage. Issues JWT tokens on successful login. Connected to Azure Cosmos DB (ammazone-users database).

### Catalog Service (Port 3002)

Manages the product catalog with support for category filtering, price range queries, and text search. Includes a seed script that populates the database with 20 curated products. Connected to Azure Cosmos DB (ammazone-catalog database). Queries are designed to work within Cosmos DB MongoDB API limitations (in-memory boolean sorting, single-field regex).

### Cart Service (Port 3003)

Provides fast cart operations using Redis as a session store. Cart data is stored with a 24-hour TTL and supports add, update, remove, and clear operations.

### Payment Service (Port 3004)

Simulates payment processing. Listens for `order.created` events from RabbitMQ, processes the payment, stores transaction records in AWS DynamoDB, and publishes `payment.completed` or `payment.failed` events.

### Order Service (Port 3005)

Manages the full order lifecycle. Creates orders in Cosmos DB, publishes events to RabbitMQ, and listens for payment completion events to update order status.

### Frontend (Port 80)

A React single-page application built with Vite and served by Nginx. The Nginx configuration includes a reverse proxy that routes `/api/*` requests to the API Gateway service within the Kubernetes cluster. The frontend fetches product data from the backend API and sends analytics events for every user interaction.

---

## Infrastructure

### AWS Resources

- VPC with 2 public subnets across availability zones
- EKS cluster (Kubernetes 1.31) with managed node group (t3.micro instances)
- ECR repositories for 7 service images
- DynamoDB table for payment records (on-demand capacity)
- IAM roles and policies for EKS nodes, ECR access, and ALB ingress
- Budget alarm set at configurable threshold

### Azure Resources

- Resource group for all Azure resources
- Cosmos DB account with MongoDB API (serverless tier)
- Three MongoDB databases: users, catalog, orders
- Application Insights instance for distributed tracing
- Log Analytics workspace for centralized logging

### Terraform Configuration

All infrastructure is defined as code in the `infrastructure/terraform/` directory. The configuration uses a modular structure with separate AWS and Azure modules. Resource provisioning is idempotent and can be applied repeatedly.

Key variables (defined in `terraform.tfvars`):

| Variable | Description | Default |
|---|---|---|
| `aws_region` | AWS region for compute resources | ap-south-1 |
| `azure_location` | Azure region for data resources | centralindia |
| `project_name` | Prefix for all resource names | ammazone |
| `eks_node_instance_type` | EC2 instance type for worker nodes | t3.micro |
| `eks_node_count` | Number of EKS worker nodes | 7 |
| `budget_limit` | Monthly cost alert threshold (USD) | 90 |

---

## Prerequisites

- AWS CLI configured with a named profile
- Azure CLI installed and authenticated
- Terraform (v1.5+)
- Docker Desktop
- kubectl
- Helm 3
- Node.js 22 (for local development)
- PowerShell (deployment scripts are written for Windows)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/rahulrathnavel/ammazone.git
cd ammazone
```

### 2. Provision cloud infrastructure

```powershell
cd infrastructure/terraform
$env:Path = "$env:Path;C:\terraform;C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
terraform init
terraform apply -auto-approve
```

### 3. Configure kubectl

```powershell
aws eks update-kubeconfig --name ammazone-eks --region ap-south-1 --profile <your-profile>
```

### 4. Build and push Docker images

```powershell
cd ../..
$REGISTRY = "683444362809.dkr.ecr.ap-south-1.amazonaws.com/ammazone"

aws ecr get-login-password --region ap-south-1 --profile <your-profile> | docker login --username AWS --password-stdin $REGISTRY

$services = @("api-gateway", "user-service", "catalog-service", "cart-service", "payment-service", "order-service")
foreach ($svc in $services) {
    docker build -t "${REGISTRY}/${svc}:latest" "services/$svc"
    docker push "${REGISTRY}/${svc}:latest"
}

docker build -t "${REGISTRY}/frontend:latest" e-commerce-main
docker push "${REGISTRY}/frontend:latest"
```

### 5. Deploy to Kubernetes

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Create secrets with Terraform outputs
$COSMOS = terraform output -raw cosmosdb_connection_string
$AI = terraform output -raw appinsights_connection_string
$JWT = [guid]::NewGuid().ToString()

kubectl create secret generic ammazone-secrets --namespace ammazone `
  --from-literal="JWT_SECRET=$JWT" `
  --from-literal="COSMOS_USERS_URI=$($COSMOS -replace '/\?', '/ammazone-users?')" `
  --from-literal="COSMOS_CATALOG_URI=$($COSMOS -replace '/\?', '/ammazone-catalog?')" `
  --from-literal="COSMOS_ORDERS_URI=$($COSMOS -replace '/\?', '/ammazone-orders?')" `
  --from-literal="APPINSIGHTS_CONNECTION_STRING=$AI"

kubectl apply -f k8s/infra/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
```

### 6. Seed the product catalog

```powershell
$pod = kubectl get pod -l app=catalog-service -n ammazone -o jsonpath="{.items[0].metadata.name}"
kubectl exec $pod -n ammazone -- node src/seed/seed.js
```

### 7. Access the application

```powershell
# Get the node external IP
kubectl get nodes -o jsonpath="{.items[0].status.addresses[?(@.type=='ExternalIP')].address}"

# Frontend is available at http://<NODE_IP>:30536
# API is available at http://<NODE_IP>:31106
```

---

## Deployment

For a full automated deployment, use the included deployment script:

```powershell
.\scripts\deploy.ps1
```

The script performs all steps above in sequence, including infrastructure provisioning, image building, Kubernetes resource creation, and database seeding.

---

## Monitoring and Observability

### Kubernetes Logs

Every service outputs structured JSON logs. View them in real-time:

```powershell
# All API traffic with trace IDs
kubectl logs -f -l app=api-gateway -n ammazone

# User authentication events
kubectl logs -f -l app=user-service -n ammazone

# Product catalog queries
kubectl logs -f -l app=catalog-service -n ammazone

# Order and payment processing
kubectl logs -f -l app=order-service -n ammazone
kubectl logs -f -l app=payment-service -n ammazone
```

Sample log output:

```json
{
  "level": "info",
  "service": "api-gateway",
  "ts": "2026-05-07T23:20:47.259Z",
  "msg": "Proxying GET /api/products -> http://catalog-service:3002",
  "traceId": "fccd95eb8cb2ec2a3f76cc9e31184305"
}
```

### Azure Application Insights

Navigate to the Azure Portal, then Resource Groups, then ammazone-rg, then ammazone-appinsights. Available views include:

- **Live Metrics**: Real-time request rate and response times
- **Transaction Search**: Query individual requests by trace ID
- **Application Map**: Visualize service-to-service dependencies
- **Failures**: Error tracking with stack traces
- **Performance**: End-to-end latency breakdown

### Azure Log Analytics

Navigate to ammazone-logs in the Azure Portal. Run KQL queries against collected logs:

```kusto
traces
| where timestamp > ago(1h)
| order by timestamp desc
```

### Cosmos DB Data Explorer

Navigate to ammazone-cosmos in the Azure Portal, then click Data Explorer to browse:

- **ammazone-catalog**: Product data (20 seeded items)
- **ammazone-users**: User registration records
- **ammazone-orders**: Order history and status

### AWS DynamoDB

Navigate to the DynamoDB console, then the ammazone-payments table to view payment transaction records.

---

## API Reference

All API endpoints are accessible through the API Gateway.

### Products

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/products | List all products (supports ?category, ?search, ?sort, ?maxPrice, ?minRating) |
| GET | /api/products/:id | Get a single product by productId |
| GET | /api/products/categories | List distinct product categories |

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register a new user (body: name, email, password) |
| POST | /api/auth/login | Login and receive JWT token (body: email, password) |

### Cart

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/cart | Get current cart contents (requires JWT) |
| POST | /api/cart | Add item to cart (body: productId, name, price, quantity) |
| DELETE | /api/cart/:productId | Remove item from cart |

### Orders

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/orders | Place a new order (requires JWT, body: items array) |
| GET | /api/orders | List user orders (requires JWT) |

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/analytics/track | Log a user interaction event (body: event, productId, page) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | API Gateway health check |

---

## Cost Considerations

Estimated monthly costs when running:

| Resource | Estimated Cost (USD) |
|---|---|
| EKS control plane | 72.00 |
| 6-7 t3.micro instances | 22.00-26.00 |
| Cosmos DB (serverless, low usage) | 1.00-5.00 |
| DynamoDB (on-demand, low usage) | 0.25 |
| ECR storage | 0.10 |
| **Total** | **95.00-103.00** |

An AWS Budget alarm is configured at the threshold defined in `terraform.tfvars` (default: 90 USD).

To stop all charges, run the teardown procedure below.

---

## Teardown

To destroy all cloud resources and stop billing:

```powershell
cd infrastructure/terraform
$env:Path = "$env:Path;C:\terraform;C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
terraform destroy -auto-approve
```

Alternatively, use the teardown script:

```powershell
.\scripts\teardown.ps1
```

This removes all AWS resources (EKS cluster, ECR repositories, VPC, DynamoDB) and all Azure resources (Cosmos DB, App Insights, Log Analytics).

---

## License

This project is for educational and demonstration purposes.
