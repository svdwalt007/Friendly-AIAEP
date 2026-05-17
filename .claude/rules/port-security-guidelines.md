# Port and Firewall Security Guidelines

## Port Selection Rules

### ✅ DO: Use High Ports (45000+)

**Avoid Below 1024:** System ports (0-1023) require root privileges and are heavily scanned/used.

**Avoid Common Registered Ports:** Do not use 1433 (SQL), 3306 (MySQL), 5432 (PostgreSQL), 3389 (RDP), 8080 (HTTP alternate), or 8443.

**Configure, Don't Hardcode:** Ensure your app allows the port to be changed via a config file, in case of future conflicts.

**Firewall Isolation:** For maximum security, do not expose these 10-20 ports to the public internet. Use a reverse proxy (like Nginx/Traefik) to map 443 to your private high-port app, or restrict access via firewalls.

## Recommended Port Ranges

- **UI Applications:** 45000-45999
- **APIs:** 46000-46999  
- **Databases:** 47000-47999
- **Message Queues:** 48000-48999
- **Observability:** 49000-49999

## Security Requirements

1. **Always use reverse proxy** for production (Nginx/Traefik/Caddy)
2. **Configure firewall** to block external access to high ports
3. **Use environment variables** for port configuration
4. **Document all ports** in PORT-ALLOCATION.md
5. **Never expose high ports** directly to the internet

See complete guidelines in this repository's PORT-ALLOCATION.md
