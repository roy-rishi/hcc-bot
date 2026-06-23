import * as z from "zod";

// # Resend bounced email object
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
