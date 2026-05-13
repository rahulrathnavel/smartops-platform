#!/bin/bash

# Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install kube-prom prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace

# ServiceMonitor for Result Portal
kubectl apply -f servicemonitor.yaml

# Kafka using stable KRaft manifest (Dual Listener: Internal/External)
kubectl apply -f kafka-simple.yaml

echo "Setup complete. Run these port forwards for local dev:"
echo "kubectl port-forward svc/kube-prom-kube-prometheus-prometheus -n monitoring 9090:9090 &"
echo "kubectl port-forward svc/kafka -n kafka 9092:9094 &"
