# SmartOps Autonomous Incident Resolution Platform

## 1. High-Level Architecture Overview

SmartOps is a self-healing e-commerce infrastructure platform deployed on AWS Elastic Kubernetes Service (EKS). It observes cluster metrics, diagnoses failures autonomously using an AI agent (Root Cause Analysis - RCA), and resolves incidents in real-time, visualizing the entire flow on a React/D3.js dashboard.

The system is composed of three major pillars:
1.  **Ammazone E-commerce Application:** A set of microservices (Node.js/Express) generating real-world traffic, metrics, and simulated failures.
2.  **SmartOps Agent:** The "brain" of the operation. It intercepts Prometheus alerts, queries an AI/LLM for root cause diagnosis, auto-generates fixes, and triggers Kubernetes self-healing commands.
3.  **SmartOps Dashboard:** A real-time visual control center that aggregates telemetry data and maps the live topology of incidents and AI interventions.

---

## 2. Directory Structure & Components

### `/e-commerce-base` (The Target Application)
The target application is a fully functional microservices-based e-commerce platform.
*   **`frontend/` or `e-commerce-main/`:** The React frontend for the e-commerce store.
*   **`services/`:**
    *   **`api-gateway`:** Routes traffic to internal services and propagates OpenTelemetry traces.
    *   **`user-service`:** Handles authentication and profiles. Connects to Azure Cosmos DB (MongoDB API).
    *   **`catalog-service`:** Manages products. Connects to Cosmos DB.
    *   **`cart-service`:** Manages user shopping carts. Uses Redis for fast state management.
    *   **`order-service`:** Processes checkouts and pushes messages to RabbitMQ.
    *   **`payment-service`:** Consumes RabbitMQ messages, processes payments, and stores records in AWS DynamoDB.
*   **`infrastructure/terraform/`:** Contains Terraform scripts (AWS + Azure) to provision the EKS cluster, VPCs, and databases.
*   **`k8s/`:** Kubernetes manifests for deploying the e-commerce microservices, Redis, RabbitMQ, and the Prometheus observability stack.

### `/smartops-agent` (The Autonomous Brain)
A Node.js application running within the Kubernetes cluster (`smartops-system` namespace) that orchestrates self-healing.
*   **`src/core/incident-detector.js`:** Continuously polls Prometheus and Kubernetes APIs for anomalies (e.g., HTTP 500 errors).
*   **`src/core/incident-manager.js`:** The state machine for incident resolution. It receives anomalies, runs the RCA reasoning chain, proposes a fix via Slack, and auto-merges GitHub PRs to deploy fixes.
*   **`src/core/reasoning-chain.js`:** Interfaces with the AI model (NVIDIA NIM/Qwen) to diagnose errors and generate Git commits/patches.
*   **`src/server.js`:** Exposes a root status endpoint (`/`), health checks, and webhooks for Slack interactions and GitHub events.

### `/dashboard` (The Visual Control Center)
*   **`smartops-backend/`:** Node.js WebSocket server that aggregates real-time data. It uses Collectors (`kubernetes.js`, `prometheus.js`, `agent-bridge.js`) to pull metrics from the cluster and the Agent, broadcasting them to the frontend.
*   **`smartops-frontend/`:** React dashboard. Uses `socket.io-client` to receive real-time updates. Visualizes metrics (Grafana-style) and the live cluster topology (using D3.js or similar) where failing nodes turn red during an incident.

### `/rca_model`
Contains the Python Jupyter notebook (`smartops-rca.ipynb`) representing the Graph Neural Network (GNN) logic used for analyzing telemetry data and pinpointing the exact microservice causing an outage. (Currently, the agent simulates this model's output to fit within AWS Free Tier limits).

---

## 3. The Full Autonomous Workflow

1.  **Observation:** The `prom-client` in each Node.js microservice exposes metrics. The `kube-prometheus-stack` scrapes these metrics continuously.
2.  **Detection:** A failure occurs (e.g., `cart-service` crashes due to a memory leak). The SmartOps Agent's `incident-detector` identifies a spike in HTTP 500s or pod restarts.
3.  **Diagnosis:** The Agent intercepts the logs and telemetry and feeds them into the RCA diagnosis engine. The engine pinpoints the root cause (e.g., "Redis connection timeout in cart-service").
4.  **Dashboard Visualization:** The Agent emits a WebSocket event. The Dashboard instantly turns the `cart-service` node red and displays the AI's diagnosis confidence score.
5.  **Remediation & Human-in-the-Loop:** 
    *   The Agent formulates a fix (e.g., a Kubernetes pod restart or a code rollback) and sends a Slack message asking for approval.
    *   An SRE clicks "Approve" in Slack.
    *   The Agent autonomously executes the Kubernetes API command to resolve the issue.
6.  **Resolution:** The failing pods recover. The Agent broadcasts the resolution, and the Dashboard topology turns green.

---

## 4. Current State & Recent Fixes
*   **AWS Migration:** Infrastructure successfully migrated to AWS EKS `t3.micro` nodes using VPC CNI prefix delegation to overcome pod density limits.
*   **Dashboard Connectivity:** Configured the Dashboard Frontend (`nginx`) to reverse-proxy WebSocket traffic directly to the Dashboard Backend, solving Cross-Origin and port exposure issues.
*   **Agent Stability:** Added robust root routing to the SmartOps Agent and synchronized Docker image tags (`v5`) to ensure smooth deployment.
*   **Security:** All API keys, AWS credentials, and Azure connection strings have been strictly segregated into `.gitignore` and Kubernetes Secrets to prevent credential leakage.
