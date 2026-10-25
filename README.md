# Task 2 – Simple Jenkins CI/CD Pipeline (Jenkins + Docker)

A small Node.js web app that Jenkins automatically **builds → tests → deploys** as a Docker container every time you push a commit.

```
git push ──► Jenkins (webhook / poll) ──► Checkout ──► Build ──► Test ──► Deploy ──► Smoke Test
                                                       (docker   (unit     (docker    (/health
                                                        build)    tests)    run)       check)
```

## Project structure

```
jenkins-cicd-demo/
├── Jenkinsfile              # ⭐ the pipeline (deliverable)
├── Dockerfile               # multi-stage: "test" image + slim "production" image
├── package.json             # npm scripts: start, test, test:ci (JUnit report)
├── src/app.js               # tiny HTTP app:  /  and  /health
├── src/server.js            # starts the app on port 3000
├── test/app.test.js         # 3 unit tests (Node built-in test runner)
└── jenkins/
    ├── Dockerfile           # Jenkins LTS + Docker CLI + plugins
    ├── plugins.txt          # plugins the pipeline needs
    └── docker-compose.yml   # one command to run Jenkins locally
```

**Prerequisites:** Docker Desktop (or Docker Engine), Git, and a GitHub account.

---

## Step 0 – Install Jenkins (with Docker access)

```bash
docker compose -f jenkins/docker-compose.yml up -d --build
```

1. Open **http://localhost:8080**
2. Get the admin password:
   ```bash
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. Choose **Install suggested plugins**, then create your admin user.

> The Jenkins container mounts the host's Docker socket, so pipeline `docker build`/`docker run` commands run on your machine's Docker. Check it works: `docker exec jenkins docker ps`.

## Step a – Put the code + Jenkinsfile in a repo

```bash
cd jenkins-cicd-demo
git init && git add . && git commit -m "Initial commit: app + Jenkinsfile"
git branch -M main
git remote add origin https://github.com/<your-username>/jenkins-cicd-demo.git
git push -u origin main
```

## Step b – Configure Jenkins to run on every commit

1. Jenkins → **New Item** → name `jenkins-cicd-demo` → **Pipeline** → OK.
2. **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git** → Repository URL: your repo URL (add credentials if private — a GitHub Personal Access Token as the password)
   - Branch: `*/main` · Script Path: `Jenkinsfile`
3. **Save**, then click **Build Now** once. *(The first run registers the `triggers {}` block from the Jenkinsfile.)*

The Jenkinsfile defines two triggers:

| Trigger | How it works | When to use |
|---|---|---|
| `pollSCM('H/2 * * * *')` | Jenkins checks the repo ~every 2 minutes and builds if there's a new commit | Works with Jenkins on `localhost` — **no setup needed** |
| `githubPush()` | GitHub calls Jenkins instantly on push | Jenkins must be reachable from the internet |

**Optional – instant webhook:** GitHub repo → *Settings → Webhooks → Add webhook*
- Payload URL: `http://<your-public-jenkins>/github-webhook/` (for a local Jenkins, expose it with `ngrok http 8080` and use the ngrok URL)
- Content type: `application/json` · Event: *Just the push event*
- In the job config, tick **GitHub hook trigger for GITScm polling**.

## Step c – The stages (what the Jenkinsfile does)

| Stage | What happens |
|---|---|
| **Checkout** | Pulls the commit, computes version `<build#>-<git sha>` |
| **Build** | `docker build --target test` (test image) and `--target production` (tagged `:<build#>` and `:latest`) |
| **Test** | Runs `npm run test:ci` in the test container; JUnit report is published to Jenkins (*Test Result* trend) |
| **Deploy** | Replaces the old container with the new image: `docker run -d -p 3000:3000 …` |
| **Smoke Test** | Calls `/health` inside the new container, retries up to 5× — fails the build if the app isn't healthy |
| **post** | Prints success/failure, removes the temporary test image, prunes dangling images |

If **Test** fails, **Deploy never runs** — broken code never reaches the running app.

## Step d – Test the pipeline by pushing a change

1. After the first build, open **http://localhost:3000** — you'll see the page with the build version.
2. Make a visible change, e.g. in `src/app.js` change the heading to `Hello from Jenkins CI/CD – v2!`, **and** update the matching text in `test/app.test.js`.
3. Commit and push:
   ```bash
   git commit -am "Update welcome message" && git push
   ```
4. Watch the Jenkins dashboard: within ~2 minutes (or instantly with a webhook) a new build starts. Open it to see **Stage View**, **Console Output** and **Test Result**.
5. Refresh **http://localhost:3000** — the new message and build number are live.

**Try a failure on purpose:** change only the heading in `src/app.js` (not the test) and push. The **Test** stage turns red, Deploy is skipped, and the previous version keeps running.

## Step e – Outcome

You now have a working DevOps loop: every commit is automatically built into a Docker image, tested, deployed, and health-checked, with build history and test reports on the Jenkins dashboard.

---

### Run things manually (without Jenkins)

```bash
npm test                                          # run unit tests (Node 18+)
docker build --target production -t demo .        # build app image
docker run -d -p 3000:3000 --name demo demo       # run it → http://localhost:3000
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `docker: not found` / permission denied on `docker.sock` in a build | Make sure you started Jenkins with the provided `docker-compose.yml` (it installs the Docker CLI and runs as root for socket access) |
| `No such DSL method 'githubPush'` or `'timestamps'` | Install the **GitHub** and **Timestamper** plugins (pre-installed by `jenkins/plugins.txt`) |
| Pushes don't trigger builds | Run **Build Now** once after creating the job; for webhooks check *Settings → Webhooks → Recent Deliveries* on GitHub |
| Port 3000 already in use | Change `APP_PORT` in the Jenkinsfile's `environment` block |
| On Windows, socket mount fails | Use Docker Desktop with the WSL 2 backend and run `docker compose` from a WSL terminal |

> ⚠️ Running Jenkins as root with the Docker socket mounted is fine for learning, but in production use a dedicated build agent and a container registry.
