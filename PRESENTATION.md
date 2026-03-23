# Présentation Projet E-Commerce Microservices

## Slide 1: Introduction

**Titre**: Infrastructure Docker & CI/CD pour E-Commerce Microservices

**Points clés**:
- Application e-commerce architecture microservices
- Conteneurisation complète avec Docker
- Orchestration Docker Swarm en production
- Pipeline CI/CD moderne avec GitHub Actions

---

## Slide 2: Architecture Globale

**Composants**:
- Frontend: Vue.js avec Vite
- 3 Microservices Node.js (Auth, Products, Orders)
- MongoDB comme base de données
- Nginx comme reverse proxy

**Diagramme**:
```
User → Nginx (80/8080) → Frontend (Vue.js)
                        ↓
                    API Routes
                  ↙  ↓  ↘
         Auth   Products  Orders
         (3001)  (3000)   (3002)
            ↓       ↓        ↓
          MongoDB (databases séparées)
```

---

## Slide 3: Docker Multi-Stage Builds

**Pourquoi multi-stage?**
- Séparation build vs runtime
- Image finale optimisée (+ petite)
- Sécurité: pas d'outils de build en prod

**Exemple Auth Service**:
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
# Installation + build

# Stage 2: Runtime
FROM node:20-alpine
# Uniquement le nécessaire pour l'exécution
```

**Résultat**: Image ~200MB au lieu de ~800MB

---

## Slide 4: Sécurité - Bonnes Pratiques

**Mesures implémentées**:

1. **Utilisateur non-root** (UID 1001)
   - Réduit surface d'attaque
   - Appliqué à tous les services Node.js

2. **Vulnérabilités corrigées**
   - libexpat (CVE-2026-32767)
   - zlib (CVE-2026-22184)
   - npm packages (overrides)

3. **Secrets management**
   - GitHub Secrets pour CI/CD
   - Variables d'environnement pour JWT

4. **Scans de sécurité**
   - Trivy à chaque commit
   - Rapports SARIF dans GitHub Security

---

## Slide 5: CI/CD - Architecture Modulaire

**Workflow Call Pattern**:
```
ci.yml (orchestrateur)
  ├─ Test (matrice de services)
  ├─ scan.yml (réutilisable)
  ├─ build.yml (réutilisable)
  └─ deploy-staging ou deploy-production
```

**Avantages**:
- Code DRY (Don't Repeat Yourself)
- Maintenance simplifiée
- Workflow clair et lisible

---

## Slide 6: Staging vs Production

| Élément | Staging | Production |
|---------|---------|------------|
| Orchestration | Docker Compose | Docker Swarm |
| Port | 8080 | 80 |
| Réseau | staging-network | production-network |
| Volume | staging-mongodb-data | production-mongodb-data |
| Réplicas | 1 | 2 (HA) |

**Pourquoi séparer?**
- Tests sans casser la prod
- Déploiement progressif
- Rollback facile

---

## Slide 7: Docker Swarm - Haute Disponibilité

**Configuration Production**:
- 2 replicas par service
- Rolling updates (mise à jour sans downtime)
- Restart automatique (max 3 tentatives)
- MongoDB sur manager nodes uniquement

**Commandes**:
```bash
docker stack deploy -c docker-compose.swarm.yml e-commerce
docker stack services e-commerce
```

---

## Slide 8: Difficultés Rencontrées

**1. Network conflicts (staging + prod sur même VPS)**
- Problème: Port 80 déjà utilisé
- Solution: Staging sur 8080, Production sur 80

**2. MongoDB crash (exit code 100)**
- Problème: Volume corrompu/perms incorrectes
- Solution: Volumes séparés par environnement

**3. Health check Swarm**
- Problème: `healthcheck` mal placé dans `deploy:`
- Solution: Déplacer au niveau service

**4. Trivy trop strict**
- Problème: Bloque sur HIGH (vuln npm internes)
- Solution: Bloquer uniquement CRITICAL

---

## Slide 9: Démo

**Scénario de démonstration**:

1. **Déploiement staging** (push sur develop)
   - Pipeline exécute: test → scan → build → deploy
   - Accès: http://<VPS_IP>:8080

2. **Déploiement production** (push sur main)
   - Pipeline Swarm avec 2 replicas
   - Accès: http://<VPS_IP>

3. **Health checks**
   - `docker stack services e-commerce`
   - Vérifier tous les services "running"

4. **Test fonctionnel**
   - Inscription utilisateur
   - Ajout au panier
   - Création commande

---

## Slide 10: Bonus Réalisés

✅ CI/CD complet avec GitHub Actions
✅ Docker Swarm pour production
✅ Scans de sécurité Trivy
✅ Séparation staging/production
✅ Auto-recovery MongoDB
✅ Health checks tous services
✅ Multi-stage builds optimisés
✅ Utilisateur non-root

---

## Slide 11: Conclusion

**Ce que nous avons appris**:
- Docker multi-stage builds
- Docker Swarm vs Compose
- CI/CD modulaire avec workflow_call
- Gestion des secrets
- Hardening conteneurs

**Perspectives d'amélioration**:
- Monitoring Prometheus/Grafana
- TLS avec Let's Encrypt
- Multi-nœud Swarm
- CI/CD avec tests d'intégration

---

## Questions Fréquentes (Q&A)

**Q: Pourquoi GitHub Actions et pas GitLab CI?**
R: Workflow_call plus flexible, meilleure UI pour les workflows modulaires

**Q: Pourquoi Swarm et pas Kubernetes?**
R: Plus simple pour un projet de cette taille, intégré à Docker

**Q: Comment gérer les mises à jour sans downtime?**
R: Swarm rolling updates avec replicas - update un par un

**Q: Comment monitorer en production?**
R: Docker logs + health checks, pourrait ajouter Prometheus

---

## Références

- Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/
- Docker Swarm: https://docs.docker.com/engine/swarm/
- Trivy: https://aquasecurity.github.io/trivy/
- GitHub Actions: https://docs.github.com/actions