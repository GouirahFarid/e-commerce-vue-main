# Rapport de Projet - Infrastructure Docker et CI/CD
## Application E-Commerce Microservices

**Auteurs :** Farid Gouirah
**Formation :** ESGI - Master 2
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
10. [Difficultés Rencontrées et Solutions](#10-difficultés-rencontrées-et-solutions)
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

---

## 2. Architecture de l'Application

### Vue d'ensemble

L'application e-commerce est composée de 4 services principaux :

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                │
│                         Port 80 / 443                        │
│                    gzip + non-root user                     │
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

### Exemple : Dockerfile Nginx (sécurisé)

```dockerfile
FROM nginx:alpine
# Fix CRITICAL libexpat vulnerability (CVE-2026-32767)
RUN apk upgrade --no-cache libexpat && \
    rm -rf /var/cache/apk/* && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /var/run || true

COPY nginx.conf /etc/nginx/nginx.conf

USER nginx

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1
```

### Taille des images obtenues

| Service | Taille finale | Optimisations |
|---------|---------------|---------------|
| Frontend | ~180 MB | Alpine + multi-stage + .dockerignore |
| Auth Service | ~160 MB | Alpine + dependencies only |
| Product Service | ~165 MB | Alpine + dependencies only |
| Order Service | ~160 MB | Alpine + dependencies only |
| Nginx | ~40 MB | Alpine + non-root user |

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

Configuration pour le développement local :

```yaml
version: '3.8'

services:
  nginx:
    build: ./nginx
    ports:
      - "80:80"
    depends_on:
      - frontend
      - auth-service
      - product-service
      - order-service

  frontend:
    build: ./frontend
    environment:
      - NODE_ENV=development
    volumes:
      - ./frontend:/app
      - /app/node_modules
```

### Environnement de Staging

**Fichier :** `docker-compose.prod.yml`

Configuration pour le staging sur VPS :

```yaml
version: '3.8'

services:
  nginx:
    image: ghcr.io/gouirahfarid/e-commerce-vue-main-nginx:latest
    ports:
      - "8080:80"  # Port différent de la prod
    networks:
      - staging-network

  # ... autres services
```

**Réseau :** `staging-network` (driver bridge)
**Volumes :** `staging-mongodb-data`

### Environnement de Production (Docker Swarm)

**Fichier :** `docker-compose.swarm.yml`

Configuration pour la production avec Swarm :

```yaml
version: '3.8'

services:
  nginx:
    image: ghcr.io/gouirahfarid/e-commerce-vue-main-nginx:latest
    deploy:
      mode: replicated
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    networks:
      - production-network

  auth-service:
    image: ghcr.io/gouirahfarid/e-commerce-vue-main-auth-service:latest
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

**Réseau :** `production-network` (driver overlay)
**Volumes :** `production-mongodb-data`
**Réplicas :** 2 par service (haute disponibilité)

### Comparaison des environnements

| Caractéristique | Développement | Staging | Production |
|-----------------|---------------|---------|------------|
| Port Nginx | 80 | 8080 | 80 |
| Réseau | bridge | staging-network | production-network (overlay) |
| Réplicas | 1 | 1 | 2 |
| Hot reload | Oui | Non | Non |
| Healthcheck | Optionnel | Oui | Oui |
| Monitoring | Non | Non | Oui |
| Compression | Non | Oui | Oui |

---

## 5. Pipeline CI/CD avec GitHub Actions

### Architecture du Pipeline (Optimisé)

Nous avons implémenté une architecture **modulaire** avec exécution parallèle :

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
│      ├───────────────┬──────────────────┐                       │
│      ▼               ▼                  ▼                       │
│  ┌────────┐    ┌────────┐        ┌─────────────┐               │
│  │  Scan  │    │ Build  │        │Security Gate│               │
│  │(Trivy) │    │(+registry    │───→│  (blocks if │───→ Deploy   │
│  │        │    │ cache)  │        │   failed)   │               │
│  └────────┘    └────────┘        └─────────────┘               │
│       └───────────────┴──────────────────┘                     │
│           (PARALLEL - gain de 5-8 min)                         │
└─────────────────────────────────────────────────────────────────┘
```

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

      # Cache npm pour accélérer les installs
      - uses: actions/cache@v4
        with:
          path: |
            ~/.npm
            ${{ matrix.service.dir }}/node_modules
          key: ${{ matrix.service.name }}-node-${{ hashFiles('**/package.json') }}
          restore-keys: |
            ${{ matrix.service.name }}-node-

      - name: Install dependencies
        working-directory: ${{ matrix.service.dir }}
        run: npm install --legacy-peer-deps --no-audit --no-fund

      - name: Run tests
        working-directory: ${{ matrix.service.dir }}
        run: npm test
        timeout-minutes: 10

  # Stage 2: Security scan (PARALLÈLE avec build)
  scan:
    needs: test
    uses: ./.github/workflows/scan.yml
    permissions:
      contents: read
      security-events: write
    with:
      sha: ${{ github.sha }}

  # Stage 3: Build and push (PARALLÈLE avec scan)
  build:
    needs: test  # Uniquement test, PAS scan
    uses: ./.github/workflows/build.yml
    permissions:
      contents: read
      packages: write
    with:
      sha: ${{ github.sha }}

  # Security gate : bloque si scan échoue
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

  # Stage 4a: Deploy to Staging
  deploy-staging:
    needs: security-gate
    if: (github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/feature/ci-cd') && github.event_name == 'push'
    uses: ./.github/workflows/deploy-staging.yml
    secrets:
      STAGING_VPS_HOST: ${{ secrets.STAGING_VPS_HOST }}
      STAGING_VPS_USER: ${{ secrets.STAGING_VPS_USER }}
      STAGING_VPS_SSH_KEY: ${{ secrets.STAGING_VPS_SSH_KEY }}

  # Stage 4b: Deploy to Production
  deploy-production:
    needs: security-gate
    if: (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/feature/ci-cd') && github.event_name == 'push'
    uses: ./.github/workflows/deploy-production.yml
    secrets:
      PROD_VPS_HOST: ${{ secrets.PROD_VPS_HOST }}
      PROD_VPS_USER: ${{ secrets.PROD_VPS_USER }}
      PROD_VPS_SSH_KEY: ${{ secrets.PROD_VPS_SSH_KEY }}
      JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Workflow : build.yml (avec registry cache)

```yaml
name: Build and Push

on:
  workflow_call:
    inputs:
      sha:
        required: true
        type: string

jobs:
  build-push:
    name: Build and Push ${{ matrix.service.name }}
    runs-on: ubuntu-latest
    timeout-minutes: 30

    strategy:
      fail-fast: false
      matrix:
        service:
          - { name: frontend, context: ./frontend }
          - { name: auth-service, context: ./services/auth-service }
          - { name: product-service, context: ./services/product-service }
          - { name: order-service, context: ./services/order-service }
          - { name: nginx, context: ./nginx }

    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ github.token }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/gouirahfarid/e-commerce-vue-main-${{ matrix.service.name }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ${{ matrix.service.context }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          # Cache GitHub Actions + Registry
          cache-from: |
            type=gha
            type=registry,ref=ghcr.io/gouirahfarid/e-commerce-vue-main-${{ matrix.service.name }}:buildcache
          cache-to: |
            type=gha,mode=max
            type=registry,ref=ghcr.io/gouirahfarid/e-commerce-vue-main-${{ matrix.service.name }}:buildcache,mode=max
          platforms: linux/amd64
```

### Stratégie de branches

| Branche | Action | Environnement |
|---------|--------|---------------|
| `feature/**` | Test + Scan + Build (parallèle) | - |
| `develop` | → Deploy Staging | Staging (port 8080) |
| `main` / `feature/ci-cd` | → Deploy Production | Production (port 80) |

---

## 6. Déploiement en Production avec Docker Swarm

### Pourquoi Docker Swarm ?

1. **Haute disponibilité** : Réplicas de chaque service
2. **Rolling updates** : Mises à jour sans temps d'arrêt
3. **Load balancing** intégré
4. **Simplicité** : Natif dans Docker
5. **Ressources limitées** : Adapté à notre VPS

### Architecture Swarm

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Swarm Cluster                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Stack: e-commerce                   │  │
│  │                                                        │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐              │  │
│  │  │ Service │  │ Service │  │ Service │  ...         │  │
│  │  │ nginx:2 │  │  auth:2 │  │ prod:2  │              │  │
│  │  └─────────┘  └─────────┘  └─────────┘              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Stack: e-commerce                       │  │
│  │                  (Monitoring)                         │  │
│  │                                                        │  │
│  │  ┌────────────┐  ┌────────────┐                      │  │
│  │  │ Prometheus │  │   Grafana  │  ...                │  │
│  │  │  :9090     │  │   :3000    │                      │  │
│  │  └────────────┘  └────────────┘                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
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
  registers: [register]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});
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
| **Utilisateur** | nodejs (UID 1001), nginx (UID 101) - PAS de root |
| **Vulnérabilités** | Scan Trivy à chaque build (bloquant CRITICAL) |
| **Mises à jour** | `apk upgrade` des packages critiques |
| **Secrets** | GitHub Secrets, jamais dans les images |

### Correction des vulnérabilités CRITICAL

**CVE-2026-32767** dans libexpat (Alpine) :

```dockerfile
# Tous les Dockerfiles
RUN apk upgrade --no-cache libexpat zlib
```

### Nginx : utilisateur non-root + gzip

```dockerfile
FROM nginx:alpine
RUN apk upgrade --no-cache libexpat && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /var/run || true

USER nginx
```

```nginx
# nginx.conf - gzip compression
http {
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss;
}
```

### Scan de sécurité avec Trivy

```yaml
# Bloquant pour les vulnérabilités CRITICAL
- name: Run Trivy vulnerability scanner (blocking)
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ image }}
    severity: 'CRITICAL'
    exit-code: '1'

# Rapport SARIF pour Security tab (CRITICAL + HIGH)
- name: Run Trivy vulnerability scanner (SARIF)
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ image }}
    format: 'sarif'
    output: 'trivy-results.sarif'
    severity: 'CRITICAL,HIGH'
```

---

## 9. Optimisations Apportées

### 9.1 Pipeline CI/CD

| Optimisation | Avant | Après | Gain |
|--------------|-------|-------|------|
| **Exécution** | Séquentielle | Parallèle | 5-8 min |
| **npm cache** | Non | Oui (actions/cache) | 1-3 min |
| **Registry cache** | Non | Oui | 2-5 min |
| **Total** | ~25 min | ~15 min | **~40%** |

**Avant :**
```
test → scan → build → deploy
  ↓      ↓      ↓
(5min) (8min) (8min) = 21 min + deploy
```

**Après :**
```
      ┌─→ scan (8 min) ───┐
test →                  ├→ security-gate → deploy
      └─→ build (8 min) ─┘
  = 13 min + deploy
```

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

### 9.4 Séparation Staging/Production

| Élément | Staging | Production |
|---------|---------|------------|
| Port | 8080 | 80 |
| Réseau | staging-network | production-network |
| Volumes | staging-*-data | production-*-data |
| Réplicas | 1 | 2 |

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

---

## 11. Livrables et Conclusion

### Livrables fournis

1. ✅ **Dépôt Git complet**
   - Dockerfiles multi-stage optimisés
   - Configurations Docker Compose (dev, staging, prod)
   - Pipeline CI/CD modulaire optimisé

2. ✅ **Infrastructure CI/CD**
   - Tests automatisés avec cache
   - Scan de sécurité Trivy (bloquant)
   - Déploiement automatisé
   - Registry cache pour accélérer les builds

3. ✅ **Monitoring en production**
   - Prometheus + Grafana
   - Dashboards configurés
   - Métriques exposées (/metrics)

4. ✅ **Documentation**
   - README.md
   - docs/DEPLOYMENT.md
   - docs/DOCKER_LOCAL_SETUP.md
   - PRESENTATION.md
   - RAPPORT_FINAL.md

### Bonus implémentés

- ✅ CI/CD avec workflow_call + exécution parallèle
- ✅ npm cache et registry cache
- ✅ Monitoring Prometheus + Grafana
- ✅ Docker Swarm pour la production
- ✅ Scan de sécurité Trivy + SARIF
- ✅ Nginx non-root + gzip compression
- ✅ Réplicas et haute disponibilité
- ✅ Healthchecks sur tous les services
- ✅ Métriques applicatives (/metrics)
- ✅ Séparation staging/production

### Conclusion

Ce projet nous a permis de :

1. **Maîtriser Docker** (multi-stage, réseaux, volumes, Swarm)
2. **Implémenter un pipeline CI/CD moderne** (GitHub Actions, workflow_call)
3. **Optimiser les performances** (cache, parallélisme, compression)
4. **Déployer en production** (Docker Swarm, haute disponibilité)
5. **Mettre en place le monitoring** (Prometheus, Grafana)
6. **Appliquer les bonnes pratiques** (sécurité, non-root, scans)

L'infrastructure déployée en production est :

- ✅ **Résiliente** (réplicas, healthchecks, auto-restart)
- ✅ **Sécurisée** (scans, Alpine, non-root)
- ✅ **Observable** (métriques, logs, dashboards)
- ✅ **Performante** (cache, parallélisme, compression)
- ✅ **Scalable** (Swarm, load balancing)

**URL de Production :**
- Application : http://57.129.13.147
- Grafana : http://57.129.13.147:3000 (admin/admin)
- Prometheus : http://57.129.13.147:9090

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
├── docker-compose.prod.yml           # Staging
├── docker-compose.swarm.yml          # Production (Swarm)
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
│   │   └── src/middleware/metrics.js
│   └── order-service/
│       ├── Dockerfile
│       └── src/middleware/metrics.js
├── monitoring/
│   ├── prometheus/prometheus.yml
│   └── grafana/provisioning/
└── docs/
    ├── DEPLOYMENT.md
    └── DOCKER_LOCAL_SETUP.md
```

### B. Commandes utiles

```bash
# Développement
docker compose up --build

# Staging
docker compose -f docker-compose.prod.yml up -d

# Production (Swarm)
docker stack deploy -c docker-compose.swarm.yml e-commerce
docker stack services e-commerce
docker stack ps e-commerce

# Monitoring
docker stack deploy -c docker-compose.monitoring.yml e-commerce

# Logs
docker service logs e-commerce_auth-service -f

# Scale
docker service scale e-commerce_auth-service=3

# Nettoyage images anciennes
docker image prune -af --filter "until=72h"
```

### C. Historique des commits

Commits sur la branche feature/ci-cd :

- `1176da3` feat: optimize CI/CD pipeline and improve security
- `cfbe2ed` feat: optimize Docker layer caching and fix Trivy scan
- `1fa5d61` feat: optimize Docker layer caching for faster rebuilds
- `f4d0462` fix: expose monitoring ports in Swarm mode
- `0106bc3` feat: add Prometheus + Grafana monitoring stack
- `9252e90` feat: run both staging and production
- `3b38bed` feat: use separate networks for staging and production
- `51d32f8` feat: add GitHub Actions CI/CD pipeline
- `1347c15` fix: enable all tests for CI pipeline
- `95f9ede` setup docker compose for the project

Et 50+ autres commits d'amélioration, de fixes et d'optimisations.

---

**Fin du rapport**