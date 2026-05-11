# Kubernetes Deployment Guide

**Kubernetes Deployment, Helm Charts, Autoscaling, and Monitoring**

Complete guide for deploying Friendly AI AEP on Kubernetes.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Helm Charts](#helm-charts)
4. [Deployment](#deployment)
5. [Services and Ingress](#services-and-ingress)
6. [Autoscaling](#autoscaling)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Ingress Controller                   │
│              (NGINX / Traefik / ALB)                    │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  API     │ │ Builder  │ │ Preview  │
│ Gateway  │ │   UI     │ │  Host    │
│  Pods    │ │  Pods    │ │  Pods    │
└─────┬────┘ └────┬─────┘ └────┬─────┘
      │           │            │
      └───────────┼────────────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │  Redis   │ │ InfluxDB │
│ StatefulSet│ StatefulSet│ StatefulSet
└──────────┘ └──────────┘ └──────────┘
```

---

## Prerequisites

### Install Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
kubectl version --client
helm version
```

### Cluster Access

```bash
# Configure kubectl
export KUBECONFIG=~/.kube/config

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

---

## Helm Charts

### Chart Structure

```
deploy/helm/
├── Chart.yaml
├── values.yaml
├── values.staging.yaml
├── values.production.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── _helpers.tpl
└── charts/
```

### Chart.yaml

```yaml
apiVersion: v2
name: friendly-aep
description: Friendly AI AEP Helm Chart
type: application
version: 1.0.0
appVersion: "1.2.3"

dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 17.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### values.yaml

```yaml
replicaCount: 2

image:
  registry: ghcr.io/svdwalt007/friendly-aep
  pullPolicy: IfNotPresent
  tag: "latest"

imagePullSecrets: []

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

service:
  type: ClusterIP
  port: 80
  targetPort: 3001

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.friendly-aiaep.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: friendly-aep-tls
      hosts:
        - api.friendly-aiaep.com

resources:
  limits:
    cpu: 500m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

env:
  - name: NODE_ENV
    value: "production"
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: database-credentials
        key: url

postgresql:
  enabled: true
  auth:
    username: friendly
    password: ""
    database: friendly_aep

redis:
  enabled: true
  auth:
    enabled: false
```

---

## Deployment

### Create Namespace

```bash
kubectl create namespace friendly-production
kubectl create namespace friendly-staging
```

### Create Secrets

```bash
# Database credentials
kubectl create secret generic database-credentials \
  --from-literal=url="${DATABASE_URL}" \
  --namespace friendly-production

# Anthropic API key
kubectl create secret generic anthropic-credentials \
  --from-literal=api-key="${ANTHROPIC_API_KEY}" \
  --namespace friendly-production

# JWT secrets
kubectl create secret generic jwt-credentials \
  --from-literal=secret="${JWT_SECRET}" \
  --from-literal=refresh-secret="${REFRESH_TOKEN_SECRET}" \
  --namespace friendly-production
```

### Deploy with Helm

```bash
# Install
helm install friendly-aep ./deploy/helm \
  --namespace friendly-production \
  --values deploy/helm/values.production.yaml \
  --wait \
  --timeout 10m

# Upgrade
helm upgrade friendly-aep ./deploy/helm \
  --namespace friendly-production \
  --values deploy/helm/values.production.yaml \
  --wait

# Verify
kubectl get pods -n friendly-production
kubectl get services -n friendly-production
kubectl get ingress -n friendly-production
```

---

## Services and Ingress

### Service Definition

```yaml
apiVersion: v1
kind: Service
metadata:
  name: friendly-aep-api-gateway
  namespace: friendly-production
  labels:
    app: friendly-aep
    component: api-gateway
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3001
      protocol: TCP
      name: http
  selector:
    app: friendly-aep
    component: api-gateway
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: friendly-aep-ingress
  namespace: friendly-production
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.friendly-aiaep.com
      secretName: friendly-aep-tls
  rules:
    - host: api.friendly-aiaep.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: friendly-aep-api-gateway
                port:
                  number: 80
```

---

## Autoscaling

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: friendly-aep-hpa
  namespace: friendly-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: friendly-aep-api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

### Cluster Autoscaler

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-autoscaler
  namespace: kube-system
data:
  min-nodes: "3"
  max-nodes: "10"
```

---

## Monitoring

### Prometheus ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: friendly-aep-monitor
  namespace: friendly-production
  labels:
    app: friendly-aep
spec:
  selector:
    matchLabels:
      app: friendly-aep
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

### Grafana Dashboard

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard
  namespace: friendly-production
data:
  friendly-aep.json: |
    {
      "dashboard": {
        "title": "Friendly AEP - Kubernetes",
        "panels": [...]
      }
    }
```

---

## Troubleshooting

### Common Issues

**1. Pod CrashLoopBackOff:**
```bash
kubectl logs -f POD_NAME -n friendly-production
kubectl describe pod POD_NAME -n friendly-production
```

**2. Image Pull Errors:**
```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=$GITHUB_USERNAME \
  --docker-password=$GITHUB_TOKEN \
  --namespace friendly-production
```

**3. Service Not Accessible:**
```bash
kubectl get endpoints -n friendly-production
kubectl port-forward svc/friendly-aep-api-gateway 3001:80 -n friendly-production
```

---

## Related Documentation

- [Deployment Guide](../guides/DEPLOYMENT-GUIDE.md)
- [Docker Guide](./DOCKER-GUIDE.md)
- [CI/CD Pipeline](./CICD-PIPELINE.md)

---

**Last Updated**: 2026-04-15
**Version**: 2.0.0
**Maintained by**: Friendly Technology DevOps Team
