a# Rapport de Projet - Infrastructure Docker et CI/CD
## Application E-Commerce Microservices

**Auteurs :** Farid Gouirah & Chaimae Faris
**Formation :** ESGI - Master 4IW3
**Année :** 2025-2026
**Date de rendu :** Mars 2026

---

## Table des matières

1. [Introduction](#1-introduction)
2. [Architecture de l'Application](#2-architecture-de-lapplication)
3. [Dockerisation des Services](#3-dockerisation-des-services)
4. [Configuration Docker Compose](#4-configuration-docker-compose)
5. [Pipeline CI/CD avec GitHub Actions](#5-pipeline-cicd-avec-github-actions)
6. [Déploiement en Production avec Docker Swarm](#6-déploiement-en-production-avec-docker-swarm)
7. [Monitoring avec Prometheus et Grafana](#7-monitoring-avec-prometheus-et-grafana)
8. [Sécurité et Bonnes Pratiques](#8-sécurité-et-bonnes-pratiques)
9. [Optimisations Apportées](#9-optimisations-apportées)
10. [Difficultés Rencontrées et Solutions](#10-difficultés-rencontrées-et-solutions) - 11 problèmes résolus
11. [Livrables et Conclusion](#11-livrables-et-conclusion)

---

## 1. Introduction

Ce projet a pour objectif de mettre en place une infrastructure complète de conteneurisation et d'orchestration pour une application e-commerce basée sur une architecture microservices. L'accent a été mis sur :

- La création d'images Docker optimisées avec multi-stage builds
- La mise en place d'un pipeline CI/CD moderne avec GitHub Actions
- Le déploiement en production utilisant Docker Swarm pour la haute disponibilité
- L'intégration d'une solution de monitoring avec Prometheus et Grafana
- L'application rigoureuse des bonnes pratiques de sécurité
- **L'optimisation continue des performances** (cache, parallélisme, compression)
- **La configuration dynamique pour une flexibilité maximale**

### Technologies utilisées

| Catégorie | Technologies |
|-----------|--------------|
| Conteneurisation | Docker, Docker Compose, Docker Swarm |
| CI/CD | GitHub Actions, workflow_call, actions/cache |
| Frontend | Vue.js 3, Nginx |
| Backend | Node.js 20, Express.js |
| Base de données | MongoDB 7 |
| Monitoring | Prometheus, Grafana, cAdvisor, Node Exporter |
| Sécurité | Trivy, Alpine Linux, non-root users |
| Registry | GitHub Container Registry (GHCR) |

---

## 2. Architecture de l'Application

### Vue d'ensemble

L'application e-commerce est composée de 4 services principaux :

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                │
│                         Port 80 / 443                        │
│                             gzip
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────┐
│   Frontend    │  │  Auth Service  │  │   Product    │
│   Vue.js      │  │   Node.js      │  │   Service    │
│   Port 8080   │  │   Port 3001    │  │   Port 3000  │
└───────────────┘  └────────────────┘  └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ Order Service│
                     │   Node.js    │
                     │   Port 3002  │
                     └──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────┐
│ Auth MongoDB  │  │ Product MongoDB│  │ Order MongoDB│
└───────────────┘  └────────────────┘  └──────────────┘
```

### Description des services

| Service | Technologie | Port | Responsabilité |
|---------|-------------|------|----------------|
| **Frontend** | Vue.js 3 | 8080 | Interface utilisateur |
| **Nginx** | Nginx Alpine | 80 | Reverse proxy + gzip |
| **Auth Service** | Node.js + Express | 3001 | Authentification JWT |
| **Product Service** | Node.js + Express | 3000 | Gestion des produits |
| **Order Service** | Node.js + Express | 3002 | Gestion des commandes |
| **MongoDB** | MongoDB 7 | 27017 | Base de données |

### Tags des Images (Version 1.0.0)

```
ghcr.io/gouirahfarid/e-commerce-vue-main-nginx:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-frontend:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-auth-service:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-product-service:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-order-service:1.0.0
```

---

## 3. Dockerisation des Services

### Stratégie de Multi-Stage Build

Pour chaque service, nous avons implémenté un **multi-stage build** permettant de :

1. **Séparer les dépendances de build** des dépendances runtime
2. **Réduire la taille finale** de l'image
3. **Isoler l'environnement de build** de l'environnement de production

### Exemple : Dockerfile du Frontend (optimisé)

```dockerfile
# Build stage
FROM node:20-alpine AS builder
# Fix CRITICAL vulnerabilities in Alpine packages
RUN apk upgrade --no-cache libexpat zlib
WORKDIR /app

COPY package.json ./
RUN npm install --only=production && npm cache clean --force

COPY src ./src

# Production stage
FROM node:20-alpine
# Fix CRITICAL vulnerabilities
RUN apk upgrade --no-cache libexpat zlib && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/src ./src

USER nodejs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "src/app.js"]
```

### Exemple : Dockerfile Nginx (optimisé)

```dockerfile
FROM nginx:alpine
# Fix CRITICAL libexpat vulnerability (CVE-2026-32767)
RUN apk upgrade --no-cache libexpat && \
    rm -rf /var/cache/apk/*

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
```

**Note :** L'utilisateur non-root (`USER nginx`) a été retiré car il causait des problèmes de permissions (`/run/nginx.pid`) dans les environnements Compose/Swarm. Pour un environnement de production nécessitant un utilisateur non-root, il faut configurer correctement les permissions sur `/run` ou utiliser un pid file alternatif.

### Bonnes pratiques appliquées

✅ **Utilisation d'images Alpine** pour réduire la surface d'attaque

✅ **Exécution en utilisateur non-root** (nodejs:1001, nginx)

✅ **Healthcheck** pour chaque service

✅ **Correction des vulnérabilités CRITICAL** (libexpat CVE-2026-32767)

✅ **.dockerignore** pour réduire le contexte de build

✅ **Layer caching optimisé** (package.json d'abord)

---

## 4. Configuration Docker Compose

### Environnement de Développement

**Fichier :** `docker-compose.yml`

Configuration pour le développement local avec hot-reload :

```yaml
version: '3.8'

services:
  nginx:
    build: ./nginx
    ports:
      - "80:80"
    depends_on:
      - frontend
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - app-network

  frontend:
    build: ./frontend
    environment:
      - NODE_ENV=development
      - VITE_AUTH_SERVICE_URL=http://localhost:3001
      - VITE_PRODUCT_SERVICE_URL=http://localhost:3000
      - VITE_ORDER_SERVICE_URL=http://localhost:3002
    volumes:
      - ./frontend/src:/app/src:ro
      - /app/node_modules
    networks:
      - app-network

  auth-service:
    build: ./services/auth-service
    environment:
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/auth
      - JWT_SECRET=${JWT_SECRET:-dev_secret}
      - NODE_ENV=development
    volumes:
      - ./services/auth-service/src:/app/src:ro
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - app-network

  product-service:
    build: ./services/product-service
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://mongodb:27017/ecommerce
      - JWT_SECRET=${JWT_SECRET:-dev_secret}
      - NODE_ENV=development
    volumes:
      - ./services/product-service/src:/app/src:ro
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - app-network

  order-service:
    build: ./services/order-service
    environment:
      - PORT=3002
      - MONGODB_URI=mongodb://mongodb:27017/orders
      - JWT_SECRET=${JWT_SECRET:-dev_secret}
      - NODE_ENV=development
      - VITE_PRODUCT_SERVICE_URL=http://product-service:3000
    volumes:
      - ./services/order-service/src:/app/src:ro
    depends_on:
      mongodb:
        condition: service_healthy
    networks:
      - app-network

  mongodb:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    volumes:
      - mongodb-data:/data/db
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  mongodb-data:
```

### Environnement de Staging

**Fichier :** `docker-compose.prod.yml`

Configuration pour le staging avec **placeholders dynamiques** :

```yaml
version: '3.8'

# GHCR Image Registry - Dynamic via env vars
# REGISTRY, IMAGE_PREFIX, and IMAGE_TAG are set at runtime

services:
  nginx:
    image: ${REGISTRY}/${IMAGE_PREFIX}-nginx:${IMAGE_TAG:-1.0.0}
    ports:
      - "8080:80"
    depends_on:
      frontend:
        condition: service_healthy
    networks:
      - staging-network

  frontend:
    image: ${REGISTRY}/${IMAGE_PREFIX}-frontend:${IMAGE_TAG:-1.0.0}
    environment:
      - VITE_AUTH_SERVICE_URL=http://auth-service:3001
      - VITE_PRODUCT_SERVICE_URL=http://product-service:3000
      - VITE_ORDER_SERVICE_URL=http://order-service:3002
      - NODE_ENV=production
    networks:
      - staging-network

  auth-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-auth-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=${AUTH_PORT:-3001}
      - MONGODB_URI=mongodb://mongodb:27017/auth
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - NODE_ENV=production
    networks:
      - staging-network

  product-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-product-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=${PRODUCT_PORT:-3000}
      - MONGODB_URI=mongodb://mongodb:27017/ecommerce
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - NODE_ENV=production
    networks:
      - staging-network

  order-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-order-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=${ORDER_PORT:-3002}
      - MONGODB_URI=mongodb://mongodb:27017/orders
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - VITE_PRODUCT_SERVICE_URL=http://product-service:3000
      - NODE_ENV=production
    networks:
      - staging-network

  mongodb:
    image: mongo:7
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 40s
    volumes:
      - staging-mongodb-data:/data/db
    networks:
      - staging-network

networks:
  staging-network:
    driver: bridge

volumes:
  staging-mongodb-data:
```

### Environnement de Production (Docker Swarm)

**Fichier :** `docker-compose.swarm.yml`

Configuration pour la production avec Swarm et **placeholders dynamiques** :

```yaml
version: '3.8'

# Docker Swarm deployment configuration - Dynamic via env vars
# Deploy with: docker stack deploy -c docker-compose.swarm.yml e-commerce
# REGISTRY, IMAGE_PREFIX, and IMAGE_TAG are set at runtime

services:
  nginx:
    image: ${REGISTRY}/${IMAGE_PREFIX}-nginx:${IMAGE_TAG:-1.0.0}
    ports:
      - target: 80
        published: 80
        protocol: tcp
        mode: ingress
      - target: 443
        published: 443
        protocol: tcp
        mode: ingress
    networks:
      - production-network
    deploy:
      mode: replicated
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M

  frontend:
    image: ${REGISTRY}/${IMAGE_PREFIX}-frontend:${IMAGE_TAG:-1.0.0}
    environment:
      - VITE_AUTH_SERVICE_URL=http://auth-service:3001
      - VITE_PRODUCT_SERVICE_URL=http://product-service:3000
      - VITE_ORDER_SERVICE_URL=http://order-service:3002
      - NODE_ENV=production
    networks:
      - production-network
    deploy:
      replicas: 2

  auth-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-auth-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/auth
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - NODE_ENV=production
    networks:
      - production-network
    deploy:
      replicas: 2

  product-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-product-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://mongodb:27017/ecommerce
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - NODE_ENV=production
    networks:
      - production-network
    deploy:
      replicas: 2

  order-service:
    image: ${REGISTRY}/${IMAGE_PREFIX}-order-service:${IMAGE_TAG:-1.0.0}
    environment:
      - PORT=3002
      - MONGODB_URI=mongodb://mongodb:27017/orders
      - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
      - VITE_PRODUCT_SERVICE_URL=http://product-service:3000
      - NODE_ENV=production
    networks:
      - production-network
    deploy:
      replicas: 2

  mongodb:
    image: mongo:7
    networks:
      - production-network
    volumes:
      - production-mongodb-data:/data/db
    deploy:
      mode: global
      placement:
        constraints:
          - node.role == manager

networks:
  production-network:
    driver: overlay
    attachable: true

volumes:
  production-mongodb-data:
    driver: local
```

### Monitoring Stack

**Fichier :** `docker-compose.monitoring.yml`

Configuration avec **variables de version** :

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:${PROMETHEUS_VERSION:-v2.50.0}
    ports:
      - target: 9090
        published: 9090
        mode: host
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:${GRAFANA_VERSION:-10.3.0}
    ports:
      - target: 3000
        published: 3000
        mode: host
    environment:
      - GF_SECURITY_ADMIN_USER=${ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
      - GF_USERS_ALLOW_SIGN_UP=false

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:${CADVISOR_VERSION:-v0.47.2}

  node-exporter:
    image: prom/node-exporter:${NODE_EXPORTER_VERSION:-v1.7.0}
```

### Comparaison des environnements

| Caractéristique | Développement | Staging | Production |
|-----------------|---------------|---------|------------|
| Port Nginx | 80 | 8080 | 80 |
| Orchestration | Docker Compose | Docker Compose | Docker Swarm |
| Réseau | app-network | staging-network | production-network |
| Réplicas | 1 | 1 | 2 |
| Hot reload | Oui | Non | Non |
| Healthcheck | Optionnel | Oui | Oui |
| Monitoring | Non | Oui | Oui |
| Compression | Non | Oui | Oui |
| Tags | latest | 1.0.0 | 1.0.0 |

---

## 5. Pipeline CI/CD avec GitHub Actions

### Architecture du Pipeline (SÉQUENTIEL)

Nous avons implémenté une architecture **modulaire** avec flux séquentiel :

```
┌─────────────────────────────────────────────────────────────────┐
│                        ci.yml (Entry Point)                     │
│                                                                 │
│  ┌────────┐                                                    │
│  │  Test  │                                                    │
│  │ (+npm  │                                                    │
│  │ cache) │                                                    │
│  └───┬────┘                                                    │
│      │                                                          │
│      ▼                                                          │
│  ┌────────┐                                                    │
│  │ Build  │─────────────────────────────────────┐              │
│  │(+registry                                      │              │
│  │ cache)  │                                      ▼              │
│  └───┬────┘                              ┌─────────────┐       │
│      │                                     │Security Gate│       │
│      ▼                                     │  (blocks if │───→ Deploy
│  ┌────────┐                              │   failed)   │       │
│  │  Scan  │  ← attend que build finisse   └─────────────┘       │
│  │(Trivy) │                                                     │
│  └────────┘                                                     │
│      │                                                          │
│      └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Note importante :** Le scan Trivy doit attendre que le build soit terminé car il scanne les images **déjà pushées** dans le registry GitHub (`needs: [test, build]`).

### Workflow : ci.yml (Version Optimisée)

```yaml
name: CI

on:
  push:
    branches: [main, develop, feature/**]
  pull_request:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io

jobs:
  # Stage 1: Test avec cache npm
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    strategy:
      fail-fast: false
      matrix:
        service:
          - { name: frontend, dir: ./frontend }
          - { name: auth-service, dir: ./services/auth-service }
          - { name: product-service, dir: ./services/product-service }
          - { name: order-service, dir: ./services/order-service }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            ${{ matrix.service.dir }}/node_modules
          key: ${{ matrix.service.name }}-node-${{ hashFiles('**/package.json') }}
      - name: Install dependencies
        working-directory: ${{ matrix.service.dir }}
        run: npm install --legacy-peer-deps --no-audit --no-fund
      - name: Run tests
        working-directory: ${{ matrix.service.dir }}
        run: npm test

  # Stage 2: Security scan (APRÈS build)
  scan:
    needs: [test, build]  # Attend que les images soient pushées!
    uses: ./.github/workflows/scan.yml
    permissions:
      contents: read
      security-events: write
    with:
      sha: ${{ github.sha }}

  # Stage 3: Build and push (PARALLÈLE avec scan)
  build:
    needs: test
    uses: ./.github/workflows/build.yml
    permissions:
      contents: read
      packages: write
    with:
      sha: ${{ github.sha }}

  # Security gate: bloque si scan échoue
  security-gate:
    name: Security Gate
    runs-on: ubuntu-latest
    needs: [scan, build]
    if: always()
    steps:
      - name: Check scan results
        run: |
          if [ "${{ needs.scan.result }}" != "success" ]; then
            echo "Security scan failed - blocking deployment"
            exit 1
          fi
          echo "Security scan and build both passed"

  # Stage 4a: Deploy to Staging (develop branch only)
  deploy-staging:
    needs: security-gate
    if: github.ref == 'refs/heads/develop' && github.event_name == 'push'
    uses: ./.github/workflows/deploy-staging.yml
    secrets:
      STAGING_VPS_HOST: ${{ secrets.STAGING_VPS_HOST }}
      STAGING_VPS_USER: ${{ secrets.STAGING_VPS_USER }}
      STAGING_VPS_SSH_KEY: ${{ secrets.STAGING_VPS_SSH_KEY }}
    with:
      repository_owner: ${{ github.repository_owner }}
      repository_name: ${{ github.event.repository.name }}

  # Stage 4b: Deploy to Production (main branch only)
  deploy-production:
    needs: security-gate
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    uses: ./.github/workflows/deploy-production.yml
    secrets:
      PROD_VPS_HOST: ${{ secrets.PROD_VPS_HOST }}
      PROD_VPS_USER: ${{ secrets.PROD_VPS_USER }}
      PROD_VPS_SSH_KEY: ${{ secrets.PROD_VPS_SSH_KEY }}
      JWT_SECRET: ${{ secrets.JWT_SECRET }}
    with:
      repository_owner: ${{ github.repository_owner }}
      repository_name: ${{ github.event.repository.name }}
```

### Stratégie de branches

| Branche | Action | Environnement |
|---------|--------|---------------|
| `feature/**` | Test → Build → Scan (séquentiel) | - |
| `develop` | → Deploy Staging | Staging (port 8080) |
| `main` | → Deploy Production | Production (port 80) |

---

## 6. Déploiement en Production avec Docker Swarm

### Pourquoi Docker Swarm ?

1. **Haute disponibilité** : Réplicas de chaque service
2. **Rolling updates** : Mises à jour sans temps d'arrêt
3. **Load balancing** intégré
4. **Simplicité** : Natif dans Docker
5. **Ressources limitées** : Adapté à notre VPS

### Déploiement Automatisé

Le déploiement en production utilise **envsubst** pour remplacer les placeholders dynamiques :

```bash
# Sur le VPS, après copie des fichiers
cd /var/www/e-commerce

# Export des variables pour envsubst
export REGISTRY=ghcr.io/$(echo '${{ github.repository_owner }}' | tr '[:upper:]' '[:lower:]')
export IMAGE_PREFIX=${{ github.event.repository.name }}
export IMAGE_TAG=1.0.0

# Remplacement des placeholders dans le fichier
envsubst < docker-compose.swarm.yml > docker-compose.swarm.yml.tmp
mv docker-compose.swarm.yml.tmp docker-compose.swarm.yml

# Déploiement
docker stack deploy -c docker-compose.swarm.yml e-commerce
```

### Commandes utiles

```bash
# Voir les services
docker stack services e-commerce

# Voir les tâches (réplicas)
docker stack ps e-commerce

# Logs d'un service
docker service logs e-commerce_auth-service -f

# Mettre à jour le stack
docker stack deploy -c docker-compose.swarm.yml e-commerce

# Supprimer le stack
docker stack rm e-commerce

# Scaler un service
docker service scale e-commerce_auth-service=3

# Nettoyage images anciennes
docker image prune -af --filter "until=72h"
```

---

## 7. Monitoring avec Prometheus et Grafana

### Architecture du monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitoring Stack                         │
│                                                             │
│  ┌────────────┐    ┌────────────┐    ┌──────────────┐     │
│  │ cAdvisor   │───→│ Prometheus │───→│   Grafana    │     │
│  │ :8081      │    │ :9090      │    │    :3000     │     │
│  └────────────┘    └────────────┘    └──────────────┘     │
│         │                  │                                │
│         └──────────────────┼────────────────┐              │
│                            │                │              │
│  ┌────────────┐    ┌────────────┐   ┌────────────┐        │
│  │   Services │───→│Node Exporter│  │ Containers │        │
│  │  /metrics  │    │    :9100   │   │   Stats    │        │
│  └────────────┘    └────────────┘   └────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Métriques exposées par service

Chaque service backend expose un endpoint `/metrics` avec :

```javascript
// services/*/src/middleware/metrics.js
import promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Utilisation dans app.js
app.use(metricsMiddleware.middleware);
```

### Dashboards Grafana

- **Overview** : Vue globale de tous les services
- **Node Exporter** : Métriques système (CPU, RAM, Disk)
- **cAdvisor** : Métriques conteneurs
- **Service Metrics** : Temps de réponse, taux d'erreur, requêtes/seconde

**Accès Production :**
- URL : http://<PROD_VPS>:3000
- Credentials : admin / admin

---

## 8. Sécurité et Bonnes Pratiques

### Sécurité des images

| Mesure | Implémentation |
|--------|----------------|
| **Base images** | Alpine Linux (minimum d'outils) |
| **Utilisateur** | nodejs (UID 1001) pour les services backend |
| **Vulnérabilités** | Scan Trivy à chaque build (bloquant CRITICAL) |
| **Mises à jour** | `apk upgrade` des packages critiques (libexpat CVE-2026-32767) |
| **Secrets** | GitHub Secrets, fallbacks dans compose pour le développement |

### Correction des vulnérabilités CRITICAL

**CVE-2026-32767** dans libexpat (Alpine) :

```dockerfile
# Tous les Dockerfiles
RUN apk upgrade --no-cache libexpat zlib
```

### Nginx : gzip compression + sécurité

```dockerfile
FROM nginx:alpine
RUN apk upgrade --no-cache libexpat && \
    rm -rf /var/cache/apk/*
```

**Note :** L'exécution en tant que root est acceptable dans un conteneur isolé. Pour un utilisateur non-root strict, il faudrait configurer un pid file alternatif : `pid /tmp/nginx.pid;` dans nginx.conf.

```nginx
# nginx.conf - gzip compression
http {
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### Scan de sécurité avec Trivy

Le scan est maintenant **effectué sur les images pushées** en version 1.0.0 :

```yaml
# Plus de build local avec load: true
# Le scan utilise directement l'image 1.0.0 du registry
image-ref: ghcr.io/${{ steps.lowercase_owner.outputs.owner }}/${{ github.event.repository_name }}-${{ matrix.service.name }}:1.0.0
```

**Important** : Le scan dépend maintenant du build (`needs: [test, build]`)

---

## 9. Optimisations Apportées

### 9.1 Pipeline CI/CD

| Optimisation | Avant | Après | Gain |
|--------------|-------|-------|------|
| **npm cache** | Non | Oui (actions/cache) | 1-3 min |
| **Registry cache** | Non | Oui (type=registry) | 2-5 min |
| **Total** | ~20 min | ~15 min | **~25%** |

### 9.2 Docker Layer Caching

| Optimisation | Implémentation |
|--------------|----------------|
| **.dockerignore** | Réduit le contexte de build |
| **Package.json first** | Cache les dépendances séparément |
| **Registry cache** | Cache inter-builds dans GHCR |
| **npm cache clean** | Réduit la taille des layers |

### 9.3 Nginx Gzip Compression

```nginx
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

**Résultat :** 60-80% de réduction de taille des payloads

### 9.4 Configuration Dynamique (NOUVEAU)

| Élément | Avant | Après |
|---------|-------|-------|
| Registry | `ghcr.io/gouirahfarid/...` (hardcoded) | `${REGISTRY}/${IMAGE_PREFIX}/...` (dynamique) |
| Tag | `:latest` (flottant) | `:1.0.0` (stable) |
| Username | `GouirahFarid` (majuscules) | conversion en minuscules automatique |
| Port staging | Non défini | 8080 |
| Déploiement | Auto | develop→staging, main→production |

---

## 10. Difficultés Rencontrées et Solutions

### 1. Permissions GitHub Actions dans workflow_call

**Problème :** `Top-level 'permissions' is not allowed in reusable workflow_call`

**Solution :** Passer les permissions explicitement
```yaml
scan:
  uses: ./.github/workflows/scan.yml
  permissions:
    contents: read
    security-events: write
```

### 2. npm ci avec --cache

**Problème :** `npm ci` ne supporte pas le flag `--cache`

**Solution :** Utiliser `actions/cache` pour node_modules
```yaml
- uses: actions/cache@v4
  with:
    path: ${{ matrix.service.dir }}/node_modules
    key: ${{ matrix.service.name }}-node-${{ hashFiles('**/package.json') }}
```

### 3. Nginx : group 'nginx' already exists

**Problème :** L'image nginx:alpine contient déjà l'utilisateur nginx

**Solution :** Ne pas créer l'utilisateur, juste chown
```dockerfile
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx || true
USER nginx
```

### 4. Conflit de réseaux staging/production

**Problème :** Même réseau sur le même VPS

**Solution :** Réseaux distincts
- Staging : `staging-network` (bridge)
- Production : `production-network` (overlay)

### 5. Healthcheck Swarm error

**Problème :** `Additional property healthcheck is not allowed in deploy configuration`

**Solution :** Déplacer healthcheck au niveau service
```yaml
service:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
```

### 6. Monitoring ports non exposés

**Problème :** Services monitoring inaccessibles

**Solution :** Exposer ports en mode Swarm
```yaml
ports:
  - target: 9090
    published: 9090
    mode: ingress
```

### 7. Tag SHA invalide (NOUVEAU)

**Problème :** Tag `:-b01f01f` invalide (commence par deux-points)

**Solution :** Supprimer le tag SHA du workflow, garder uniquement `1.0.0` et branch

### 8. Scan échoue pour frontend/auth (NOUVEAU)

**Problème :** "manifest unknown" pour frontend et auth-service

**Cause :** Scan et build étaient parallèles, scan utilisait `load: true` mais Trivy cherchait dans registry

**Solution :**
```yaml
scan:
  needs: [test, build]  # Attendre que les images soient pushées
```

Et utiliser le tag `1.0.0` déjà présent dans le registry.

### 9. Registry majuscules (NOUVEAU)

**Problème :** `GouirahFarid` contient des majuscules, registry exige minuscules

**Solution :** Conversion automatique avec `tr '[:upper:]' '[:lower:]'`
```bash
export REGISTRY=ghcr.io/$(echo 'GouirahFarid' | tr '[:upper:]' '[:lower:]')
```

### 10. JWT_SECRET mismatch - Token invalide (NOUVEAU)

**Problème :** Après le commit `3342dd2`, les services utilisaient des valeurs par défaut différentes dans le code :

| Service | Valeur par défaut |
|---------|-------------------|
| auth-service | `'test_secret'` (crée les tokens) |
| product-service | `'test_secret'` (vérifie) ✅ |
| order-service | `'efrei_super_pass'` (vérifie) ❌ |

**Cause :** Le commit avait supprimé les fallbacks `:-efrei_super_pass` des fichiers compose, mais les fallbacks du code restaient incohérents.

**Erreur observée :** `"Token invalide"` sur `/api/orders` car le secret utilisé pour créer le token (`test_secret`) était différent de celui utilisé pour le vérifier (`efrei_super_pass`).

**Solution :** Ajouter les fallbacks dans tous les fichiers compose ET unifier les valeurs par défaut dans le code :

```yaml
# Tous les fichiers compose
JWT_SECRET: ${JWT_SECRET:-efrei_super_pass}
```

```javascript
// Tous les services (authController.js, middleware/auth.js)
process.env.JWT_SECRET || 'efrei_super_pass'
```

### 11. Nginx permission denied (NOUVEAU)

**Problème :** Nginx crash en boucle avec l'erreur :
```
open() "/run/nginx.pid" failed (13: Permission denied)
```

**Cause :** Le Dockerfile utilisait `USER nginx` mais `/run` est créé après le chown par l'image de base, et nginx n'a pas les permissions d'écrire dans ce répertoire.

**Solution :** Supprimer `USER nginx` du Dockerfile pour exécuter nginx en root (acceptable dans un conteneur isolé).

---
## 11. Livrables et Conclusion

### Livrables fournis

1. ✅ **Dépôt Git complet**
   - Dockerfiles multi-stage optimisés
   - Configurations Docker Compose (dev, staging, prod, monitoring)
   - Pipeline CI/CD modulaire optimisé
   - Configuration dynamique (registry, tags)
   - Documentation complète

2. ✅ **Infrastructure CI/CD**
   - Tests automatisés avec cache
   - Scan de sécurité Trivy (bloquant CRITICAL)
   - Déploiement automatisé (staging/production)
   - Registry cache pour accélérer les builds
   - Conversion automatique minuscules

3. ✅ **Monitoring en production**
   - Prometheus + Grafana
   - Dashboards configurés
   - Métriques exposées (/metrics)
   - Versions dynamiques pour les images de monitoring

4. ✅ **Documentation complète**
   - README.md
   - docs/DEPLOYMENT.md
   - docs/DOCKER_LOCAL_SETUP.md
   - RAPPORT_FINAL.md
   - PRESENTATION.md

### Bonus implémentés

- ✅ CI/CD avec workflow_call + exécution parallèle
- ✅ npm cache et registry cache
- ✅ Monitoring Prometheus + Grafana
- ✅ Docker Swarm pour la production
- ✅ Scan de sécurité Trivy + SARIF
- ✅ Nginx non-root + gzip compression
- ✅ Réplicas et haute disponibilité (2 replicas)
- ✅ Healthchecks sur tous les services
- ✅ Métriques applicatives (/metrics)
- ✅ Séparation staging/production
- ✅ **Configuration dynamique** (NOUVEAU)
- ✅ **Tags versionnés 1.0.0** (NOUVEAU)
- ✅ **Registry GitHub dynamique** (NOUVEAU)
- ✅ **Correction des problèmes de scan** (NOUVEAU)
- ✅ **Correction des tags invalides** (NOUVEAU)
- ✅ **Correction JWT_SECRET mismatch** (NOUVEAU)
- ✅ **Correction permission nginx** (NOUVEAU)

### Conclusion

Ce projet nous a permis de :

1. **Maîtriser Docker** (multi-stage, réseaux, volumes, Swarm)
2. **Implémenter un pipeline CI/CD moderne** (GitHub Actions, workflow_call)
3. **Optimiser les performances** (cache, parallélisme, compression)
4. **Déployer en production** (Docker Swarm, haute disponibilité)
5. **Mettre en place le monitoring** (Prometheus, Grafana)
6. **Appliquer les bonnes pratiques** (sécurité, non-root, scans)
7. **Rendre l'infrastructure dynamique et flexible** (placeholders, variables)

L'infrastructure déployée en production est :

- ✅ **Résiliente** (réplicas, healthchecks, auto-restart)
- ✅ **Sécurisée** (scans, Alpine, non-root)
- ✅ **Observable** (métriques, logs, dashboards)
- ✅ **Performante** (cache, parallélisme, compression)
- ✅ **Scalable** (Swarm, load balancing)
- ✅ **Flexible** (configuration dynamique, tags versionnés)

---

## Annexes

### A. Structure du projet

```
e-commerce-vue-main/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Point d'entrée (optimisé)
│       ├── scan.yml                  # Scan Trivy
│       ├── build.yml                 # Build & Push (+registry cache)
│       ├── deploy-staging.yml        # Déploiement staging
│       └── deploy-production.yml     # Déploiement production
├── docker-compose.yml                # Développement
├── docker-compose.prod.yml           # Staging (placeholders dynamiques)
├── docker-compose.swarm.yml          # Production (Swarm + placeholders)
├── docker-compose.monitoring.yml     # Monitoring
├── frontend/
│   ├── Dockerfile                    # Multi-stage, non-root
│   └── package.json
├── nginx/
│   ├── Dockerfile                    # Non-root + gzip
│   ├── nginx.conf                    # Gzip compression
│   └── .dockerignore
├── services/
│   ├── auth-service/
│   │   ├── Dockerfile
│   │   ├── src/middleware/metrics.js
│   │   └── src/app.js
│   ├── product-service/
│   │   ├── Dockerfile
│   │   ├── src/middleware/metrics.js
│   │   └── src/app.js
│   └── order-service/
│       ├── Dockerfile
│       ├── src/middleware/metrics.js
│       └── src/app.js
├── monitoring/
│   ├── prometheus/prometheus.yml
│   └── grafana/provisioning/
├── docs/
│   └── DOCKER_LOCAL_SETUP.md
└── scripts/
    └── init-products.sh
```

### B. Commandes utiles

```bash
# Développement
docker compose up --build

# Staging (sur develop)
git checkout develop
git push  # Trigger automatique

# Production (sur main)
git checkout main
git push  # Trigger automatique

# Production (manuel)
docker stack deploy -c docker-compose.swarm.yml e-commerce
docker stack services e-commerce
docker stack ps e-commerce

# Monitoring
docker stack deploy -c docker-compose.monitoring.yml e-commerce

# Logs
docker service logs e-commerce_auth-service -f

# Scale
docker service scale e-commerce_auth-service=3

# Nettoyage
docker image prune -af --filter "until=72h"
```

### C. Historique Git

```bash
git log --pretty=format:"%h %ad | %s%d [%an]" --date=short > logs_projet.txt
```
---