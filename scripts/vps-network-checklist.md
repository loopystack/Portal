# VPS: Access app at 95.216.225.37:3000

When you get **"took too long to respond"** or **ERR_CONNECTION_TIMED_OUT**, the request is blocked before reaching your app. Do these steps **on the VPS** (SSH into 95.216.225.37).

---

## 1. Restart the app (so Vite uses `host: true`)

In the project folder on the VPS:

```bash
# Stop current dev server (Ctrl+C), then:
npm run dev
```

You should see something like:
```text
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://95.216.225.37:3000/
```
If you see "Network: http://..." then Vite is listening on all interfaces.

---

## 2. Check that something is listening on port 3000

On the VPS:

```bash
# Linux
sudo ss -tlnp | grep 3000
# or
sudo netstat -tlnp | grep 3000
```

You want to see `0.0.0.0:3000` or `*:3000` (not only `127.0.0.1:3000`). If you only see `127.0.0.1:3000`, the app is still bound to localhost; restart after the vite config change.

---

## 3. Open port 3000 in the VPS firewall

Run **one** of these on the VPS, depending on what you use.

**If you use `ufw`:**
```bash
sudo ufw allow 3000/tcp
sudo ufw status
sudo ufw reload
```

**If you use `firewalld`:**
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

**If you don’t use ufw/firewalld**, skip this step (but then check the provider firewall below).

---

## 4. Open port 3000 in the **cloud provider** firewall

Most VPS providers have their own firewall / security group. You must allow **inbound TCP port 3000** there too.

- **Hetzner Cloud**: Security Groups → add rule: Inbound, TCP, port 3000 (or your group).
- **DigitalOcean**: Networking → Firewalls → add Inbound rule: TCP 3000.
- **AWS**: Security Group → Inbound rules → add TCP 3000 from 0.0.0.0/0 (or your IP).
- **Other**: Look for “Firewall”, “Security group”, “Network” and allow TCP 3000.

---

## 5. Test from the VPS itself

On the VPS:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

If you get `200` (or any number), the app is responding locally. If that works but you still can’t reach 95.216.225.37:3000 from your PC, the block is firewall (VPS or provider).

---

## 6. Test from your local machine

In your browser or from your PC:

```text
http://95.216.225.37:3000
```

If it still times out, re-check steps 2, 3 and 4 (listening on 0.0.0.0, VPS firewall, provider firewall).
