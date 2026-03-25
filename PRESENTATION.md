# Présentation Projet E-Commerce Microservices
## Infrastructure Docker & CI/CD - Architecture Microservices

| | |
|---|---|
| **Auteurs** | Farid Gouirah & Chaimae Faris |
| **Formation** | ESGI - Master 4IW3 |
| **Année** | 2025-2026 |
| **Date** | Mars 2026 |

---

## Table des matières

1. [Introduction & Contexte](#introduction)
2. [Architecture de l'Application](#architecture)
3. [Docker Multi-Stage Builds](#slide-3-dockerisation)
4. [Configuration Docker Compose](#slide-4-configuration)
5. [Pipeline CI/CD GitHub Actions](#slide-5-cicd)
6. [Déploiement Staging vs Production](#slide-6-deploiement)
7. [Docker Swarm - Production](#slide-7-swarm)
8. [Monitoring Prometheus & Grafana](#slide-8-monitoring)
9. [Sécurité](#slide-9-securite)
10. [Optimisations](#slide-10-optimisations)
11. [Difficultés & Solutions](#difficultes)
12. [Démo](#demo)
13. [Conclusion](#conclusion)

---

## Introduction

### Contexte du Projet

**Objectif :** Créer une infrastructure complète de conteneurisation pour une application e-commerce en architecture microservices

**Technologies :**
- **Conteneurisation :** Docker, Docker Compose, Docker Swarm
- **CI/CD :** GitHub Actions (workflow_call modulaire)
- **Frontend :** Vue.js 3 + Vite
- **Backend :** Node.js 20 + Express.js (4 microservices)
- **Base de données :** MongoDB 7
- **Monitoring :** Prometheus + Grafana
- **Registry :** GitHub Container Registry (GHCR)

**Services implémentés :**
```
Frontend (Vue.js)     → Port 8080
Auth Service          → Port 3001
Product Service       → Port 3000
Order Service         → Port 3002
Nginx (Reverse Proxy) → Port 80/443
MongoDB               → Port 27017
```

---

## Architecture de l'Application

### Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                 │
│                    Port 80 (prod) / 8080 (staging)          │
│                   gzip compression enabled                   │
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
│ /auth         │  │ /ecommerce     │  │ /orders      │
└───────────────┘  └────────────────┘  └──────────────┘
```

### Tags des Images (Version 1.0.0)

```
ghcr.io/gouirahfarid/e-commerce-vue-main-nginx:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-frontend:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-auth-service:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-product-service:1.0.0
ghcr.io/gouirahfarid/e-commerce-vue-main-order-service:1.0.0
```

---

## Docker Multi-Stage Builds

### Stratégie d'optimisation

**Pourquoi multi-stage ?**
1. Séparation build vs runtime
2. Image finale optimisée (taille réduite)
3. Sécurité : pas d'outils de build en production
4. Layer caching optimisé

### Exemple Auth Service

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
RUN apk upgrade --no-cache libexpat zlib
WORKDIR /app
COPY package.json ./
RUN npm install --only=production && npm cache clean --force
COPY src ./src

# Stage 2: Production
FROM node:20-alpine
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
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/app.js"]
```
---

## Configuration Docker Compose

### 3 Environnements

| Fichier | Usage | Orchestration | Port |
|---------|-------|---------------|------|
| `docker-compose.yml` | Développement | Docker Compose | 80 |
| `docker-compose.prod.yml` | Staging | Docker Compose | 8080 |
| `docker-compose.swarm.yml` | Production | Docker Swarm | 80 |

### Configuration Dynamique

**Avant (hardcoded) :**
```yaml
image: ghcr.io/gouirahfarid/e-commerce-vue-main-auth-service:1.0.1
```

**Après (dynamique) :**
```yaml
image: ${REGISTRY}/${IMAGE_PREFIX}-auth-service:${IMAGE_TAG:-1.0.0}
```

**Variables au runtime :**
```bash
export REGISTRY=ghcr.io/$(echo 'OWNER' | tr '[:upper:]' '[:lower:]')
export IMAGE_PREFIX=repository-name
export IMAGE_TAG=1.0.0
```

### JWT_SECRET - Configuration sécurisée

```yaml
# Avec fallback pour développement
environment:
  - JWT_SECRET=${JWT_SECRET:-efrei_super_pass}
```

**Pour la production :** Le secret est passé via GitHub Secrets et `.env` sur le VPS.

---

## Pipeline CI/CD GitHub Actions

### Architecture SÉQUENTIELLE

```
┌─────────────────────────────────────────────────────────────────┐
│                        ci.yml (Entry Point)                     │
│                                                                 │
│  ┌────────┐                                                     │
│  │  Test  │                                                     │
│  │ (+npm  │                                                     │
│  │ cache) │                                                     │
│  └───┬────┘                                                     │
│      │                                                          │
│      ├──────────────────────┐                                   │
│      ▼                      ▼                                   │
│  ┌────────┐            ┌────────┐                               │
│  │ Build  │            │  Scan  │                               │
│  │(+registry            │(Trivy) │  ← attend que build finisse  │
│  │ cache)  │            └───┬────┘                              │
│  └───┬────┘                │                                    │
│      │                      ▼                                   │
│      │              ┌─────────────┐                             │
│      │              │Security Gate│                             │
│      │              │  (blocks if │───→ Deploy (staging/prod)   │
│      │              │   failed)   │                             │
│      └──────────────┴─────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Workflows modulaires

| Workflow | Rôle | Appelé par |
|----------|------|------------|
| `ci.yml` | Orchestrateur principal | Push sur toutes branches |
| `test` | Tests + cache npm | ci.yml |
| `build.yml` | Build + push images | ci.yml |
| `scan.yml` | Scan de sécurité Trivy | ci.yml |
| `deploy-staging.yml` | Déploiement staging | ci.yml (branche develop) |
| `deploy-production.yml` | Déploiement production | ci.yml (branche main) |

### Stratégie de branches

| Branche | Actions | Environnement |
|---------|----------|---------------|
| `feature/**` | Test → Build → Scan | - |
| `develop` | → Deploy Staging | Port 8080 |
| `main` | → Deploy Production | Port 80 (Swarm) |

---

## Déploiement Staging vs Production

### Comparaison

| Caractéristique | Staging | Production |
|-----------------|---------|------------|
| **Trigger** | Push sur `develop` | Push sur `main` |
| **Orchestration** | Docker Compose | Docker Swarm |
| **Port** | 8080 | 80 |
| **Réseau** | staging-network | production-network (overlay) |
| **Volume** | staging-mongodb-data | production-mongodb-data |
| **Réplicas** | 1 | 2 |
| **Monitoring** | Oui | Oui |

### Déploiement Staging

```bash
# Sur VPS après workflow CI/CD
cd /var/www/e-commerce
sudo docker compose -f docker-compose.prod.yml pull
sudo docker compose -f docker-compose.prod.yml up -d
```

**Accès :** `http://<STAGING_VPS>:8080`

### Déploiement Production

```bash
# envsubst pour remplacer les placeholders
envsubst < docker-compose.swarm.yml > docker-compose.swarm.yml.tmp
docker stack deploy -c docker-compose.swarm.yml.tmp e-commerce
```

**Accès :** `http://<PROD_VPS>`

---

## Docker Swarm - Production

### Pourquoi Docker Swarm ?

1. **Haute disponibilité** - Réplicas de chaque service
2. **Rolling updates** - Mises à jour sans downtime
3. **Load balancing** - Intégré et automatique
4. **Simplicité** - Natif dans Docker, pas de YAML complexe
5. **Ressources limitées** - Adapté aux VPS avec ressources limitées

### Architecture Swarm

```
┌──────────────────────────────────────────────────────────┐
│                   Docker Swarm Cluster                   │
│                                                          │
│  Stack: e-commerce                                       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Services (2 replicas chacun)                      │  │
│  │  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐       │  │
│  │  │ nginx │  │  auth │  │  prod │  │ order │       │  │
│  │  │  x2   │  │  x2   │  │  x2   │  │  x2   │       │  │
│  │  └───────┘  └───────┘  └───────┘  └───────┘       │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  Monitoring Stack                            │  │  │
│  │  │  ┌────────────┐       ┌────────────┐         │  │  │
│  │  │  │ Prometheus │ ────▶ │  Grafana   │         │  │  │
│  │  │  │   :9090    │       │   :3000    │         │  │  │
│  │  │  └────────────┘       └────────────┘         │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Commandes utiles

```bash
# Voir les services
docker stack services e-commerce

# Voir les tâches
docker stack ps e-commerce

# Logs d'un service
docker service logs e-commerce_auth-service -f

# Scaler un service
docker service scale e-commerce_auth-service=3

# Mettre à jour
docker stack deploy -c docker-compose.swarm.yml e-commerce

# Supprimer
docker stack rm e-commerce
```

---

## Monitoring Prometheus & Grafana

### Stack de monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitoring Stack                        │
│                                                             │
│  ┌────────────┐    ┌────────────┐    ┌──────────────┐       │
│  │ cAdvisor   │───→│ Prometheus │───→│   Grafana    │       │
│  │ :8081      │    │ :9090      │    │    :3000     │       │
│  └────────────┘    └────────────┘    └──────────────┘       │
│         │                  │                                │
│         └──────────────────┼────────────────┐               │
│                            │                │               │
│  ┌────────────┐    ┌────────────┐   ┌────────────┐          │
│  │   Services │───→│Node Exporter│  │ Containers │          │
│  │  /metrics  │    │    :9100   │   │   Stats    │          │
│  └────────────┘    └────────────┘   └────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Métriques par service

Chaque backend expose `/metrics` :
- **http_request_duration_seconds** - Histogramme des durées
- **http_requests_total** - Compteur de requêtes
- **Node.js metrics** - Mémoire, CPU, event loop

### Dashboards Grafana

- **Overview** - Vue globale de tous les services
- **Node Exporter** - Métriques système
- **cAdvisor** - Métriques conteneurs
- **Service Metrics** - Temps de réponse, taux d'erreur

---

## Sécurité

### Mesures implémentées

| Mesure | Implémentation |
|--------|----------------|
| **Base images** | Alpine Linux (surface d'attaque réduite) |
| **Utilisateur** | nodejs (UID 1001) pour services backend |
| **Vulnérabilités** | Scan Trivy bloquant CRITICAL |
| **Mises à jour** | `apk upgrade` de libexpat, zlib |
| **Secrets** | GitHub Secrets + fallback compose |
| **Healthchecks** | Tous les services |

### CVE corrigées

```dockerfile
# Tous les Dockerfiles
RUN apk upgrade --no-cache libexpat zlib
```

**CVE-2026-32767** - libexpat vulnerability (CRITICAL)

### Nginx configuration

```nginx
# gzip compression
http {
    gzip on;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript;
}
```

### Scan Trivy

```yaml
scan:
  needs: [test, build]  # Scan les images pushées en version 1.0.0
  image-ref: ghcr.io/.../service:1.0.0
  severity: CRITICAL,HIGH
```

---

## Optimisations

### Pipeline CI/CD

| Optimisation | Gain |
|--------------|------|
| npm cache (actions/cache) | 1-3 min |
| Registry cache (type=registry) | 2-5 min |
| Exécution parallèle (test) | 5-8 min |
| **Total** | **~25%** |

### Docker Layer Caching

- `.dockerignore` - Réduit contexte de build
- `package.json` first - Cache dépendances séparément
- Registry cache - Cache inter-builds dans GHCR
- `npm cache clean` - Réduit taille layers

### Configuration Dynamique

| Élément | Avant | Après |
|---------|-------|-------|
| Registry | hardcoded | `${REGISTRY}` |
| Tag | `:latest` | `:1.0.0` |
| Owner | `GouirahFarid` | conversion lowercase auto |
| Déploiement | manuel | automatisé par branche |

---

## Difficultés & Solutions

### 1. Permissions GitHub Actions dans workflow_call

**Problème :** `Top-level 'permissions' is not allowed in reusable workflow_call`

**Solution :**
```yaml
scan:
  uses: ./.github/workflows/scan.yml
  permissions:
    contents: read
    security-events: write
```

### 2. JWT_SECRET mismatch - "Token invalide"

**Problème :** Services utilisaient des defaults différents :
- auth-service : `'test_secret'`
- order-service : `'efrei_super_pass'`

**Cause :** Commit `3342dd2` avait supprimé les fallbacks compose

**Solution :**
```yaml
# Ajouter fallbacks dans tous les compose
JWT_SECRET: ${JWT_SECRET:-efrei_super_pass}

# Unifier les defaults dans le code
process.env.JWT_SECRET || 'efrei_super_pass'
```

### 3. Nginx permission denied

**Problème :**
```
open() "/run/nginx.pid" failed (13: Permission denied)
```

**Cause :** `USER nginx` dans Dockerfile mais `/run` créé après chown

**Solution :** Supprimer `USER nginx` (acceptable dans conteneur isolé)

### 4. Scan échoue pour frontend/auth

**Problème :** "manifest unknown" - scan utilisait `load: true` mais cherchait dans registry

**Solution :**
```yaml
scan:
  needs: [test, build]  # Attendre que images soient pushées
```

### 5. Registry majuscules

**Problème :** `GouirahFarid` - registry exige minuscules

**Solution :**
```bash
export REGISTRY=ghcr.io/$(echo 'OWNER' | tr '[:upper:]' '[:lower:]')
```

### 6. Healthcheck Swarm error

**Problème :** `healthcheck not allowed in deploy configuration`

**Solution :** Déplacer healthcheck au niveau service

### 7. Monitoring ports non exposés

**Problème :** Services monitoring inaccessibles

**Solution :** Exposer ports en mode Swarm (`mode: ingress`)

---

## Demo
- https://drive.google.com/file/d/10sBfqOKXuk4MeaW8UuCQUjYuMxJ_k2QG/view?usp=sharing

## Conclusion

### Ce que nous avons appris

1. **Docker avancé** - Multi-stage, réseaux, volumes, Swarm
2. **CI/CD moderne** - workflow_call, cache, secrets
3. **Optimisation** - Layer caching, parallélisme
4. **Production** - Haute disponibilité, rolling updates
5. **Monitoring** - Métriques, alertes, dashboards
6. **Sécurité** - Scans, vulnérabilités, hardening
7. **Flexibilité** - Configuration dynamique

### Infrastructure déployée

- ✅ **Résiliente** (réplicas, healthchecks, auto-restart)
- ✅ **Sécurisée** (scans, Alpine, secrets management)
- ✅ **Observable** (métriques, logs, dashboards)
- ✅ **Performante** (cache, parallélisme, compression)
- ✅ **Scalable** (Swarm, load balancing)
- ✅ **Flexible** (configuration dynamique, versioning)

### Perspectives d'amélioration

- TLS/HTTPS avec Let's Encrypt
- Multi-nœud Swarm
- Tests d'intégration automatiques
- Alerting Prometheus
- Blue-Green deployments

---
## Références

- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
- Docker Swarm: https://docs.docker.com/engine/swarm/
- GitHub Actions: https://docs.github.com/actions
- Trivy: https://aquasecurity.github.io/trivy/
- Prometheus: https://prometheus.io/docs/
- Grafana: https://grafana.com/docs/

---