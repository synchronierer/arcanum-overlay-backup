# Deployment

Deployment is intentionally outside the Codex development workflow.

Required sequence:

1. build and test the source change;
2. review the diff and visible behavior;
3. receive explicit approval for commit and push;
4. create a signed commit and push it;
5. receive separate explicit approval for production deployment;
6. back up the current runtime artifact;
7. install the reviewed JAR;
8. restart only through the approved user service;
9. verify authenticated and public routes;
10. roll back on failure.

Codex must not access real student data, modify runtime files, or restart the
production service.
