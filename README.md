# E-Commerce Microservices - Infrastructure Docker & CI/CD

## Table des Matières

1. [Introduction](#introduction)
2. [Architecture du Projet](#architecture-du-projet)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Configuration et Déploiement](#configuration-et-déploiement)
5. [Bonnes Pratiques](#bonnes-pratiques)
6. [Tests et Sécurité](#tests-et-sécurité)
7. [Annexes](#annexes)

---

## Introduction

Application e-commerce complète basée sur une architecture **microservices**, conteneurisée avec Docker et orchestrée via Docker Swarm en production. Le projet inclut un pipeline CI/CD moderne avec GitHub Actions.

### Composants

| Service | Technologie | Port | Description |
|---------|-------------|------|-------------|
| **Frontend** | Vue.js + Vite | 8080 | Interface utilisateur |
| **Auth Service** | Node.js + Express | 3001 | Authentification JWT |
| **Product Service** | Node.js + Express | 3000 | Produits & Panier |
| **Order Service** | Node.js + Express | 3002 | Commandes |
| **MongoDB** | Mongo 7 | 27017 | Base de données |
| **Nginx** | Nginx Alpine | 80/443 | Reverse proxy |

---

## Architecture du Projet

### Structure des Répertoires

```
.
├── .github/workflows/          # CI/CD GitHub Actions
│   ├── ci.yml                  # Pipeline principal (orchestrateur)
│   ├── scan.yml                # Scan Trivy (réutilisable)
│   ├── build.yml               # Build & push (réutilisable)
│   ├── deploy-staging.yml      # Déploiement staging (réutilisable)
│   ├── deploy-production.yml   # Déploiement production (réutilisable)
│   └── security-scan.yml       # Scan quotidien planifié
├── frontend/                   # Application Vue.js
│   ├── Dockerfile              # Multi-stage build
│   ├── server.cjs              # Serveur Express avec proxy API
│   └── src/                    # Source Vue.js
├── services/                   # Microservices backend
│   ├── auth-service/           # Service d'authentification
│   ├── product-service/        # Service produits/panier
│   └── order-service/          # Service commandes
├── nginx/                      # Configuration Nginx
│   ├── Dockerfile              # Image Nginx optimisée
│   └── nginx.conf              # Configuration reverse proxy
├── scripts/                    # Scripts utilitaires
│   └── init-products.sh        # Initialisation des produits
├── docker-compose.yml          # Environnement développement
├── docker-compose.prod.yml     # Environnement staging
└── docker-compose.swarm.yml    # Environnement production (Swarm)
```

### Séparation Environnement Staging / Production

| Élément | Staging | Production |
|---------|---------|------------|
| **Fichier** | `docker-compose.prod.yml` | `docker-compose.swarm.yml` |
| **Orchestration** | Docker Compose | Docker Swarm |
| **Port Public** | 8080 | 80 |
| **Réseau** | `staging-network` | `production-network` |
| **Volume MongoDB** | `staging-mongodb-data` | `production-mongodb-data` |
| **Réplicas** | 1 par service | 2 par service (HA) |
| **Registry** | GHCR | GHCR |

---

## CI/CD Pipeline

### Architecture Workflow Call

Le pipeline utilise **GitHub Actions avec `workflow_call`** pour une orchestration modulaire :

```
ci.yml (entry point)
  ├─ test (matrice de services)
  ├─ scan.yml (Trivy)
  ├─ build.yml (build + push GHCR)
  └─ deploy-staging.yml (develop)
      ou
      deploy-production.yml (main)
```

### Workflows

| Workflow | Déclenchement | Description |
|----------|---------------|-------------|
| **ci.yml** | push on main/develop/feature/** | Pipeline principal |
| **scan.yml** | appelé par ci.yml | Scan Trivy (bloque sur CRITICAL) |
| **build.yml** | appelé par ci.yml | Build & push images GHCR |
| **deploy-staging.yml** | appelé par ci.yml | Déploie sur VPS staging |
| **deploy-production.yml** | appelé par ci.yml | Déploie sur VPS production (Swarm) |
| **security-scan.yml** | quotidien à 2AM UTC | Scan de sécurité planifié |

### Tags des Images

Les images sont taguées de manière cohérente :
- `:latest` - Dernière version (branche)
- `:main-<sha>` - Commit spécifique (main)
- `:develop-<sha>` - Commit spécifique (develop)
- `:feature-ci-cd-<sha>` - Tests CI/CD

### Registry GitHub (GHCR)

```
ghcr.io/gouirahfarid/e-commerce-vue-main-frontend:latest
ghcr.io/gouirahfarid/e-commerce-vue-main-auth-service:latest
ghcr.io/gouirahfarid/e-commerce-vue-main-product-service:latest
ghcr.io/gouirahfarid/e-commerce-vue-main-order-service:latest
ghcr.io/gouirahfarid/e-commerce-vue-main-nginx:latest
```

---

## Configuration et Déploiement

### 1. Développement Local (Hot-Reload)

```bash
# Clone du dépôt
git clone <URL_DU_DÉPÔT>
cd e-commerce-vue-main

# Démarrage avec volumes pour hot-reload
docker-compose up

# Initialisation des produits
docker-compose exec -T product-service sh /scripts/init-products.sh

# Accès: http://localhost:8080
```

### 2. Déploiement Staging (Docker Compose)

**Déclenchement automatique** : Merge/Push sur `develop`

```bash
# Manuel sur VPS
cd /var/www/e-commerce
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

**Accès** : `http://<VPS_IP>:8080`

### 3. Déploiement Production (Docker Swarm)

**Déclenchement automatique** : Merge/Push sur `main`

```bash
# Manuel sur VPS
cd /var/www/e-commerce
docker stack deploy -c docker-compose.swarm.yml e-commerce
docker stack services e-commerce
```

**Accès** : `http://<VPS_IP>`

### Variables d'Environnement Requises

| Secret | Description | Usage |
|--------|-------------|-------|
| `STAGING_VPS_HOST` | IP VPS staging | Déploiement staging |
| `STAGING_VPS_USER` | User SSH staging | Déploiement staging |
| `STAGING_VPS_SSH_KEY` | Clé SSH staging | Déploiement staging |
| `PROD_VPS_HOST` | IP VPS production | Déploiement production |
| `PROD_VPS_USER` | User SSH production | Déploiement production |
| `PROD_VPS_SSH_KEY` | Clé SSH production | Déploiement production |
| `JWT_SECRET` | Secret JWT | Authentification |

### Commandes Utiles

```bash
# Vérifier les services Swarm
docker stack services e-commerce
docker stack ps e-commerce --no-trunc

# Logs des services
docker service logs e-commerce_frontend --tail 50 -f
docker service logs e-commerce_auth-service --tail 50

# Health checks
docker inspect e-commerce_frontend --format='{{.State.Health.Status}}'

# Nettoyer
docker stack rm e-commerce
docker volume prune
```

---

## Bonnes Pratiques

### Docker Multi-Stage Builds

Chaque service utilise un **build multi-stage** pour optimiser la taille :

```dockerfile
# Build stage
FROM node:20-alpine AS builder
RUN apk upgrade --no-cache libexpat zlib  # Sécurité
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Production stage
FROM node:20-alpine
RUN apk upgrade --no-cache libexpat zlib && apk add --no-cache curl
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
WORKDIR /app
COPY --from=builder --chown=nodejs:nodejs /app ./
```

### Sécurité

| Mesure | Implémentation |
|--------|----------------|
| **Utilisateur non-root** | Tous les services tournent avec `nodejs` (UID 1001) |
| **Vulnérabilités Alpine** | `apk upgrade libexpat zlib` (fix CVE-2026-32767, CVE-2026-22184) |
| **Vulnérabilités npm** | `package.json` overrides pour glob, minimatch, tar, cross-spawn |
| **Scan Trivy** | CI bloquant sur vulnérabilités CRITICAL |
| **Secrets** | GitHub Secrets, jamais dans le code |
| **Health checks** | Tous les services ont un health check |

### Ressources Limits

Production avec limites CPU/mémoire :

```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Haute Disponibilité (Swarm)

| Configuration | Valeur |
|---------------|--------|
| **Réplicas** | 2 par service |
| **Update strategy** | Rolling update (parallelism: 1) |
| **Restart policy** | on-failure, max 3 tentatives |
| **MongoDB placement** | node.role == manager uniquement |

---

## Tests et Sécurité

### Tests Automatisés

| Type | Framework | Execution |
|------|-----------|-----------|
| **Frontend** | Vitest | `npm test` dans `frontend/` |
| **Backend** | Jest | `npm test` dans chaque service |
| **Sécurité** | Trivy | Scan à chaque push + quotidien |

### Résultats des Scans

Les résultats Trivy sont disponibles dans l'onglet **Security** de GitHub.

### Exécution Locale des Tests

```bash
# Frontend
cd frontend && npm test

# Backend (un service)
cd services/auth-service && npm test

# Tous les services
./scripts/run-tests.sh
```

---

## Annexes

### API Endpoints

#### Auth Service
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/profile` - Profil utilisateur (JWT requis)

#### Product Service
- `GET /api/products` - Liste des produits
- `GET /api/products/:id` - Détails produit
- `POST /api/cart/add` - Ajouter au panier
- `GET /api/cart/:userId` - Voir le panier
- `DELETE /api/cart/:userId/items/:itemId` - Supprimer du panier

#### Order Service
- `POST /api/orders` - Créer une commande
- `GET /api/orders/user/:userId` - Historique commandes

### Dépannage

| Problème | Solution |
|----------|----------|
| **MongoDB crash (exit 100)** | `docker volume rm e-commerce_production-mongodb-data` + redeploy |
| **Network already exists** | Déjà géré par le CI (rm auto avant deploy) |
| **504 Gateway Timeout** | Vérifier health checks des services |
| **Trivy scan bloque** | Downgrader dépendances ou ajouter override |

### Git Flow

```
main (production)
  └── develop (staging)
      └── feature/** (branches temporaires)
```

- `main` → Déploiement production automatique
- `develop` → Déploiement staging automatique
- `feature/**` → Tests + build + scan, pas de déploiement

---

**Auteurs** : Groupe de projet ESGI
**Année** : 2025
**Technologies** : Docker, Docker Swarm, GitHub Actions, Node.js, Vue.js, MongoDB