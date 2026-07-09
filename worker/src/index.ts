/* index.ts: Cloudlfare Worker */
import { Path, CORS_HEADERS, REQUIRED_ENV_KEYS } from "./constants";
import { verification } from "./handlers/verification";
import { discordInteraction } from "./handlers/interactions";
import { notFound } from './handlers/not-found'
import { assertEnvComplete, errorResponse } from "./helpers";


export default {
    async fetch(request, env, ctx): Promise<Response> {
        try {
            // throws if required environment variables are missing
            assertEnvComplete(REQUIRED_ENV_KEYS, env);

            // parse request
            const reqPath = (new URL(request.url)).pathname;
            const reqMethod = request.method;
            const reqBodyRaw = await request.text();
            console.log(reqBodyRaw);

            // # validate JWT and grant permissions
            if (reqPath === Path.VERIFY && reqMethod === "POST")
                return await verification(reqBodyRaw, env);

            // # discord interactions endpoint
            if (reqPath === Path.INTERACTIONS && reqMethod === "POST")
                return await discordInteraction(reqBodyRaw, request.headers, env);

            // # browser pre-flight CORS check
            if (reqMethod === "OPTIONS")
                return new Response(null, { status: 204, headers: CORS_HEADERS });

            // # invalid path (404)
            return await notFound(request.url, env);
        } catch (e) {
            return errorResponse(500, "Unhandled top-level exception", { e });
        }
    },
} satisfies ExportedHandler<Env>;
