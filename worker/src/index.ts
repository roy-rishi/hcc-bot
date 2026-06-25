/* index.ts: Cloudlfare Worker */
import { Path } from "./constants";
import * as handlers from "./endpoints";


export default {
    async fetch(request, env, ctx): Promise<Response> {
        // parse request
        const reqPath = (new URL(request.url)).pathname;
        const reqMethod = request.method;
        const reqBodyRaw = await request.text();
        console.log(reqBodyRaw);

        // # validate JWT and grant permissions
        if (reqPath === Path.VERIFY && reqMethod === "POST")
            return await handlers.verification(reqBodyRaw);

        // # discord interactions endpoint
        if (reqPath === Path.INTERACTIONS && reqMethod === "POST")
            return await handlers.discordInteraction(reqBodyRaw, request.headers);

        // # browser pre-flight CORS check
        if (reqMethod === "OPTIONS")
            return handlers.preflightCorsCheck();

        // # invalid path (404)
        return await handlers.notFound(env);
    },
} satisfies ExportedHandler<Env>;
