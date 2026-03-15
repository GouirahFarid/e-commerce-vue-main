# Docker Local Setup Guide

This document explains how to run the E-Commerce microservices application locally using Docker and Docker Compose.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Docker Files Created](#docker-files-created)
4. [Quick Start](#quick-start)
5. [Testing the Application](#testing-the-application)
6. [Health Checks](#health-checks)
7. [Network Security](#network-security)
8. [API Endpoints](#api-endpoints)
9. [Troubleshooting](#troubleshooting)
10. [Stopping the Application](#stopping-the-application)

---

## Prerequisites

- **Docker** version 20.x or higher
- **Docker Compose** version 2.x or higher

Verify installation:
```bash
docker --version
docker-compose --version
```

---

## Project Structure

```
e-commerce-vue-main/
├── docker-compose.yml          # Main orchestration file
├── nginx/
│   ├── Dockerfile              # Nginx reverse proxy
│   └── nginx.conf              # Nginx configuration
├── frontend/
│   ├── Dockerfile              # Multi-stage build for Vue app
│   └── .dockerignore           # Exclude files from build
├── services/
│   ├── auth-service/
│   │   ├── Dockerfile          # Auth service container
│   │   └── .dockerignore
│   ├── product-service/
│   │   ├── Dockerfile          # Product service container
│   │   └── .dockerignore
│   └── order-service/
│       ├── Dockerfile          # Order service container
│       └── .dockerignore
```

---

## Docker Files Created

### 1. Root `docker-compose.yml`

Orchestrates all 6 services with health checks:
- **nginx** (port 80) - Reverse proxy (only exposed port)
- **frontend** (port 8080) - Vue.js application with API proxy
- **auth-service** (port 3001) - Authentication microservice
- **product-service** (port 3000) - Products & cart microservice
- **order-service** (port 3002) - Orders microservice
- **mongodb** (port 27017) - Database with 3 databases (auth, ecommerce, orders)

### 2. Nginx Configuration

**`nginx/nginx.conf`** - Simple reverse proxy:
- All traffic → Frontend Express server
- Frontend handles static files and API proxying internally

### 3. Dockerfiles

**`frontend/Dockerfile`** - Multi-stage build:
1. **Builder stage**: Installs dependencies and builds Vue app with Vite
2. **Production stage**: Copies built files, installs wget for healthchecks, runs Express server

**Backend Service Dockerfiles** (`services/*/Dockerfile`):
- Single-stage builds
- Install production dependencies only
- Install wget for healthchecks
- Run Node.js directly

### 4. `.dockerignore` Files

Excludes from builds:
- `node_modules`
- `dist`
- `.git`
- `.env`
- Coverage and test files

---

## Quick Start

### 1. Start All Services

```bash
docker-compose up --build -d
```

This command:
- Builds all Docker images
- Creates the Docker network (`app-network`)
- Starts MongoDB and waits for it to be healthy
- Starts all 3 backend services and waits for them to be healthy
- Builds and starts the frontend and waits for it to be healthy
- Starts Nginx reverse proxy

### 2. Verify Services are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                                    STATUS                    PORTS
e-commerce-vue-main-nginx-1             Up                        0.0.0.0:80->80/tcp
e-commerce-vue-main-frontend-1          Up (healthy)              8080/tcp
e-commerce-vue-main-auth-service-1      Up (healthy)              3001/tcp
e-commerce-vue-main-product-service-1   Up (healthy)              3000/tcp
e-commerce-vue-main-order-service-1     Up (healthy)              3002/tcp
e-commerce-vue-main-mongodb-1           Up (healthy)              27017/tcp
```

Note: Only port **80** is exposed to the host. All other ports are internal-only.

### 3. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f auth-service
```

---

## Testing the Application

### Access the Application

Open your browser and navigate to:
```
http://localhost
```

You should see the E-TryHard e-commerce application.

### Test API Endpoints

#### 1. Health Checks

```bash
# Auth Service
curl http://localhost/api/auth/health

# Product Service
curl http://localhost/api/products/health

# Order Service (requires auth)
curl http://localhost/api/orders/health
```

#### 2. User Registration

```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "message": "Utilisateur créé avec succès",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "69ad6a6fbd8a713cc852bbac"
}
```

#### 3. User Login

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### 4. Initialize Products (Optional)

```bash
# From within the Docker network
docker exec e-commerce-vue-main-frontend-1 sh -c '
curl -X POST http://product-service:3000/api/products \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smartphone\",\"price\":899,\"description\":\"Latest phone\",\"stock\":15}"
'
```

#### 5. Get Products

```bash
# Set your token from registration/login
TOKEN="your_jwt_token_here"

curl http://localhost/api/products/ \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Add to Cart

```bash
USER_ID="your_user_id_here"
PRODUCT_ID="product_id_from_step_5"

curl -X POST http://localhost/api/cart/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "userid: $USER_ID" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"productId\": \"$PRODUCT_ID\"
  }"
```

#### 7. Create Order

```bash
curl -X POST http://localhost/api/orders/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "products": [{"productId":"'$PRODUCT_ID'","quantity":1}],
    "shippingAddress": {
      "street":"123 Test St",
      "city":"Paris",
      "postalCode":"75001"
    }
  }'
```

---

## Health Checks

All services have health checks configured to ensure proper startup order.

### Health Check Configuration

| Service | Check Command | Interval | Timeout | Retries | Start Period |
|---------|--------------|----------|---------|---------|--------------|
| MongoDB | `mongosh --eval db.adminCommand('ping')` | 10s | 5s | 5 | 20s |
| Auth Service | `wget --spider http://localhost:3001/api/health` | 10s | 5s | 5 | 20s |
| Product Service | `wget --spider http://localhost:3000/api/health` | 10s | 5s | 5 | 20s |
| Order Service | `wget --spider http://localhost:3002/api/health` | 10s | 5s | 5 | 20s |
| Frontend | `wget --spider http://localhost:8080` | 10s | 5s | 3 | 30s |

### Startup Order with Health Checks

```
1. MongoDB → starts → becomes healthy
                  ↓
2. Auth Service → waits for MongoDB healthy → starts → becomes healthy
2. Product Service → waits for MongoDB healthy → starts → becomes healthy
                  ↓
3. Order Service → waits for MongoDB + Product healthy → starts → becomes healthy
                  ↓
4. Frontend → waits for all 3 backends healthy → starts → becomes healthy
                  ↓
5. Nginx → waits for Frontend healthy → starts
```

### Check Health Status

```bash
docker-compose ps
```

Look for `(healthy)` status on each service.

---

## Network Security

### Docker Network Isolation

The application uses Docker networking for security:

| Service | Docker Port | Host Exposure | Accessible From |
|---------|-------------|--------------|-----------------|
| Nginx | 80 | `0.0.0.0:80->80/tcp` | Host machine only |
| Frontend | 8080 | `8080/tcp` (no mapping) | Internal network only |
| Auth Service | 3001 | `3001/tcp` (no mapping) | Internal network only |
| Product Service | 3000 | `3000/tcp` (no mapping) | Internal network only |
| Order Service | 3002 | `3002/tcp` (no mapping) | Internal network only |
| MongoDB | 27017 | `27017/tcp` (no mapping) | Internal network only |

### What This Means

✅ **Accessible from host:**
- `http://localhost` (via Nginx)

❌ **NOT accessible from host:**
- `http://localhost:3000` (Product Service)
- `http://localhost:3001` (Auth Service)
- `http://localhost:3002` (Order Service)
- `mongodb://localhost:27017` (MongoDB)

✅ **Accessible internally (within Docker network):**
- Services can communicate using service names (e.g., `http://auth-service:3001`)
- Frontend proxies API calls to backend services
- Backend services can call each other

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Host Machine                            │
│                 Only http://localhost accessible           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (port 80)                          │
│                   (Exposed to host)                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (port 8080)                       │
│         Express + API Proxy (Internal)                      │
│  • Serves Vue static files                                  │
│  • Proxies /api/auth → auth-service:3001                   │
│  • Proxies /api/products → product-service:3000            │
│  • Proxies /api/cart → product-service:3000                │
│  • Proxies /api/orders → order-service:3002                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Docker Network (app-network)                   │
│                                                             │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Auth      │ │   Product    │ │    Order     │        │
│  │  :3001/tcp  │ │  :3000/tcp   │ │  :3002/tcp   │        │
│  │ (internal)  │ │  (internal)  │ │  (internal)  │        │
│  └─────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │           MongoDB (:27017/tcp)              │           │
│  │              (internal)                     │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Auth Service (`/api/auth/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| GET | `/profile` | Get user profile | Yes |
| GET | `/health` | Health check | No |

### Product Service (`/api/products/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get all products | No |
| GET | `/:id` | Get product by ID | No |
| POST | `/` | Create product | No |
| PUT | `/:id` | Update product | No |
| DELETE | `/:id` | Delete product | No |

### Cart Service (`/api/cart/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user cart | Yes |
| POST | `/add` | Add item to cart | Yes |
| DELETE | `/remove/:productId` | Remove item from cart | Yes |

### Order Service (`/api/orders/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/` | Get user orders | Yes |
| POST | `/` | Create new order | Yes |
| GET | `/:id` | Get order by ID | Yes |
| PATCH | `/:id/status` | Update order status | Yes |
| DELETE | `/:id` | Cancel order | Yes |

---

## Troubleshooting

### Port Already in Use

If port 80 is already in use:
```bash
# Find what's using the port
netstat -ano | findstr :80

# Or change the port in docker-compose.yml
ports:
  - "8080:80"  # Use port 8080 instead
```

### Container Not Starting / Health Check Failing

Check the logs:
```bash
docker-compose logs -f [service-name]
```

Common issues:
- MongoDB connection timeout → Wait for health check to pass (may take 20-30 seconds)
- Missing dependencies → Rebuild with `--no-cache`
```bash
docker-compose build --no-cache [service-name]
```

### Frontend Shows 404

The frontend build needs time. Check:
```bash
docker-compose logs frontend
```

You should see:
```
Frontend server is running on port 8080
```

### Database Issues

To reset the database:
```bash
docker-compose down -v
docker-compose up --build
```

⚠️ **Warning**: This deletes all data!

### Permission Issues (Linux)

If you get permission errors:
```bash
sudo docker-compose up --build
```

### Service Keeps Restarting

Check if the health check is passing:
```bash
docker-compose ps
```

If a service shows `(unhealthy)` or keeps restarting:
```bash
docker-compose logs [service-name]
```

---

## Stopping the Application

### Stop All Services (preserves data)

```bash
docker-compose down
```

### Stop and Remove Volumes (deletes data)

```bash
docker-compose down -v
```

### Restart Services

```bash
docker-compose restart
```

### Rebuild Specific Service

```bash
docker-compose up --build -d frontend
```

### View Service Health

```bash
docker-compose ps
```

---

## Environment Variables

The following environment variables are used in `docker-compose.yml`:

### Frontend
- `VITE_AUTH_SERVICE_URL=http://auth-service:3001`
- `VITE_PRODUCT_SERVICE_URL=http://product-service:3000`
- `VITE_ORDER_SERVICE_URL=http://order-service:3002`

### Auth Service
- `PORT=3001`
- `MONGODB_URI=mongodb://mongodb:27017/auth`
- `JWT_SECRET=efrei_super_pass`

### Product Service
- `PORT=3000`
- `MONGODB_URI=mongodb://mongodb:27017/ecommerce`
- `JWT_SECRET=efrei_super_pass`

### Order Service
- `PORT=3002`
- `MONGODB_URI=mongodb://mongodb:27017/orders`
- `JWT_SECRET=efrei_super_pass`
- `VITE_PRODUCT_SERVICE_URL=http://product-service:3000`

---

## Notes

- All services communicate via the Docker network (`app-network`)
- Backend services are **NOT exposed** to the host machine (only Nginx port 80)
- MongoDB data is persisted in a named volume (`mongodb-data`)
- Services use health checks to ensure proper startup order
- The frontend uses a multi-stage build for optimization
- Nginx acts as a simple reverse proxy to the frontend
- Frontend Express server handles API proxying internally
- Each microservice has its own database:
    - **auth** → User accounts
    - **ecommerce** → Products and carts
    - **orders** → Orders

---

## Summary

| Task | Status |
|------|--------|
| Docker Files Created | ✅ Complete |
| docker-compose.yml with healthchecks | ✅ Complete |
| Nginx Configuration | ✅ Complete |
| Network Isolation (only port 80 exposed) | ✅ Complete |
| Health Checks | ✅ Complete |
| Local Testing | ✅ Verified |
| Documentation | ✅ Complete |

**Project Progress: 3/10 points (Dockerization task complete)**

---

## Next Steps

- [ ] Create GitLab CI/CD pipeline
- [ ] Deploy to staging environment (Railway/Render/Fly.io)
- [ ] Deploy to production environment