const apiPort = process.env.POLYCHAT_E2E_API_PORT ?? "8787";
const appPort = process.env.POLYCHAT_E2E_APP_PORT ?? "5173";

export const E2E_API_BASE_URL = `http://localhost:${apiPort}`;
export const E2E_APP_BASE_URL = `http://localhost:${appPort}`;
