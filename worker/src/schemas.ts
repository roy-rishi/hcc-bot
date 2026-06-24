import * as z from "zod";

// environment types
export interface Env {
    // discord
    DISCORD_CLIENT_ID: string;
    DISCORD_CLIENT_SECRET: string;
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    DISCORD_ROLE_ID: string;
    DISCORD_LOGS_CHANNEL_ID: string;
    DISCORD_ANNOUNCEMENT_CHANNEL_ID: string;
    PUBLIC_KEY: string;
    // resend
    RESEND_KEY: string;
    // jwt
    JWT_KEY: string;
    // static files
    ASSETS: Fetcher;
}

// # resend bounced email
export const EmailBounced = z.object({
    type: z.literal("email.bounced"),
    data: z.object({
        email_id: z.string(),
        to: z.string().array(),
        bounce: z.object({
            message: z.string()
        })
    })
});
export type EmailBounced = z.infer<typeof EmailBounced>;

// # simple token object
export const Token = z.object({
    token: z.string()
});
export type Token = z.infer<typeof Token>;

// # JWT payload
export const JwtPayload = z.object({
    discordId: z.string(),
    name: z.string(),
    interactionToken: z.string()
});
export type JwtPayload = z.infer<typeof JwtPayload>;

// # generic interaction to be extended based on the valud of the type code
export const Interaction = z.object({
    type: z.number()
});
export type Interaction = z.infer<typeof Interaction>;

// # specific interaction for modal form submissions
export const ModalSubmissionInteraction = Interaction.extend({
    token: z.string(),
    member: z.object({
        user: z.object({
            id: z.string(),
            global_name: z.string()
        })
    }),
    data: z.object({
        components: z.object({
            component: z.object({
                custom_id: z.string(),
                value: z.string()
            })
        }).array()
    })
});
export type ModalSubmissionInteraction = z.infer<typeof ModalSubmissionInteraction>;
