# CI/CD Deployment Guide

This document describes how to set up and use the GitHub Actions CI/CD pipeline for deploying the e-commerce microservices application.

---

## Overview

The CI/CD pipeline consists of four workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to main/develop, PRs to main | Run tests and linting |
| `build-push.yml` | Push to main/develop, manual | Build and push Docker images to GHCR |
| `deploy-staging.yml` | Push to develop, manual | Deploy to staging VPS |
| `deploy-production.yml` | Push to main, manual | Deploy to production VPS |

---

## Prerequisites

### 1. GitHub Container Registry (GHCR)

The pipeline pushes Docker images to GitHub's container registry. Make sure packages are enabled for your repository.

### 2. OVH VPS Access

You need access to an OVH VPS with:
- SSH access configured
- Docker and Docker Compose installed
- Git installed

---

## GitHub Secrets Configuration

Configure the following secrets in your GitHub repository: **Settings → Secrets and variables → Actions → New repository secret**

### Staging Environment Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `STAGING_VPS_HOST` | Staging VPS IP address or hostname | `123.45.67.89` or `staging.example.com` |
| `STAGING_VPS_USER` | SSH username | `ubuntu` or `root` |
| `STAGING_VPS_SSH_KEY` | Private SSH key | Contents of your `.pem` or private key file |

### Production Environment Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `PROD_VPS_HOST` | Production VPS IP address or hostname | `98.76.54.32` or `www.example.com` |
| `PROD_VPS_USER` | SSH username | `ubuntu` or `root` |
| `PROD_VPS_SSH_KEY` | Private SSH key | Contents of your `.pem` or private key file |

---

## VPS Setup

### Initial Setup on Each VPS

Run these commands on your VPS to prepare it for deployment:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group (optional, if not using root)
sudo usermod -aG docker $USER

# Create project directory
sudo mkdir -p /var/www/e-commerce
sudo chown $USER:$USER /var/www/e-commerce

# Clone repository (with SSH)
cd /var/www/e-commerce
git clone git@github.com:GouirahFarid/e-commerce-vue-main.git .

# OR clone with HTTPS (if SSH not configured)
# git clone https://github.com/GouirahFarid/e-commerce-vue-main.git .
```

### Create Environment File

```bash
cd /var/www/e-commerce
cp .env.example .env
nano .env  # Edit with your production values
```

### Log in to GHCR (First Time Only)

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

---

## SSH Key Setup

### Generate SSH Key (if needed)

```bash
# Generate new SSH key pair
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Add public key to VPS authorized_keys
ssh-copy-id -i ~/.ssh/github_actions.pub user@your-vps-host
```

### Add Private Key to GitHub Secrets

1. Copy the private key content:
   ```bash
   cat ~/.ssh/github_actions
   ```

2. Go to your GitHub repository: **Settings → Secrets and variables → Actions**

3. Click **New repository secret**

4. Name: `STAGING_VPS_SSH_KEY` (or `PROD_VPS_SSH_KEY`)

5. Paste the entire private key content (including `-----BEGIN` and `-----END` lines)

---

## Deployment Workflows

### Staging Deployment

Triggered automatically on push to `develop` branch:

```bash
git checkout develop
git add .
git commit -m "feat: new feature"
git push origin develop
```

### Production Deployment

Triggered automatically on push to `main` branch:

```bash
git checkout main
git merge develop
git push origin main
```

### Manual Deployment

You can also trigger workflows manually from GitHub:

1. Go to **Actions** tab
2. Select the workflow (e.g., "Build and Push")
3. Click **Run workflow**
4. Select branch and click **Run workflow**

---

## Docker Images on GHCR

After successful build, images will be available at:

```
ghcr.io/GouirahFarid/e-commerce-vue-main-frontend:latest
ghcr.io/GouirahFarid/e-commerce-vue-main-auth-service:latest
ghcr.io/GouirahFarid/e-commerce-vue-main-product-service:latest
ghcr.io/GouirahFarid/e-commerce-vue-main-order-service:latest
ghcr.io/GouirahFarid/e-commerce-vue-main-nginx:latest
```

### Pull Images Locally

```bash
docker pull ghcr.io/GouirahFarid/e-commerce-vue-main-frontend:latest
```

---

## Troubleshooting

### SSH Connection Issues

If the deployment fails with SSH errors:

1. Verify the SSH key is correct
2. Check VPS firewall allows SSH (port 22)
3. Test SSH connection locally:
   ```bash
   ssh -i ~/.ssh/your_key user@vps-host
   ```

### Docker Pull Issues

If images can't be pulled:

1. Verify GHCR login on VPS:
   ```bash
   docker login ghcr.io
   ```

2. Check repository visibility (must be public or you must be authenticated)

### Health Check Failures

If services fail health checks:

1. Check service logs:
   ```bash
   docker-compose logs frontend
   docker-compose logs auth-service
   ```

2. Verify environment variables in `.env`

3. Check MongoDB connection:
   ```bash
   docker-compose logs mongodb
   ```

### Rollback Deployment

To rollback to a previous version:

```bash
cd /var/www/e-commerce
git log --oneline  # Find commit hash
git checkout <previous-commit-hash>
docker-compose up -d
```

---

## Monitoring

### View Running Containers

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
```

### Check Service Health

```bash
curl http://localhost/api/health
curl http://localhost:8080
```

---

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use strong JWT_SECRET** in production
3. **Enable HTTPS** with Let's Encrypt on nginx
4. **Regular updates**: Keep Docker and dependencies updated
5. **Backups**: Set up automated MongoDB backups
6. **Firewall**: Configure UFW to only allow necessary ports

---

## URL Structure

After deployment:

| Environment | URL |
|-------------|-----|
| Local | http://localhost |
| Staging | http://staging.your-domain.com |
| Production | https://www.your-domain.com |
