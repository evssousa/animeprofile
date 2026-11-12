import { type RouteConfig, index, route } from "@react-router/dev/routes";

// Os endereços seguem o site antigo (docs/enderecos.md).
export default [
  index("routes/home.tsx"),
  route("robots.txt", "routes/robots.ts"),
  route("api/health", "routes/api.health.ts"),
  route("api/cron/:job", "routes/api.cron.ts"),
] satisfies RouteConfig;
