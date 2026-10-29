import * as z from "zod";
import { ComponentType } from "./constants";


// simple token object
export const Token = z.object({
    token: z.string()
});
export type Token = z.infer<typeof Token>;

// JWT payload
export const JwtPayload = z.object({
    discordId: z.string(),
    name: z.string(),
    interactionToken: z.string()
});
export type JwtPayload = z.infer<typeof JwtPayload>;

// generic interaction to be extended based on the value of the type code
export const Interaction = z.object({
    type: z.number(),
    guild_id: z.string().optional()
});
export type Interaction = z.infer<typeof Interaction>;

// message component interaction
export const MsgComponentInteraction = Interaction.extend({
    data: z.object({
        custom_id: z.string(),
    }),
});
export type MsgComponentInteraction = z.infer<typeof Interaction>;

export const RadioGroupResponse = z.object({
    type: z.literal(ComponentType.RADIO_GROUP),
    custom_id: z.string(),
    value: z.string(),
});
export type RadioGroupResponse = z.infer<typeof RadioGroupResponse>;

export const CheckboxResponse = z.object({
    type: z.literal(ComponentType.CHECKBOX),
    custom_id: z.string(),
    value: z.boolean(),
});
export type CheckboxResponse = z.infer<typeof CheckboxResponse>;

export const TextInputResponse = z.object({
    type: z.literal(ComponentType.TEXT_INPUT),
    custom_id: z.string(),
    value: z.string(),
});
export type TextInputResponse = z.infer<typeof TextInputResponse>;

// modal submission interaction
export const ModalSubmissionInteraction = Interaction.extend({
    token: z.string(),
    message: z.object({
        id: z.string(),
        channel_id: z.string(),
        flags: z.number().optional(),
    }),
    member: z.object({
        user: z.object({
            id: z.string(),
        }),
    }),
    data: z.object({
        custom_id: z.string(),
        components: z.object({
            component: z.discriminatedUnion("type", [RadioGroupResponse, CheckboxResponse, TextInputResponse]).optional(),
        }).array(),
    }),
});
export type ModalSubmissionInteraction = z.infer<typeof ModalSubmissionInteraction>;

export const GuildMember = z.object({
    roles: z.string().array(),
    joined_at: z.string(),
});
export type GuildMember = z.infer<typeof GuildMember>;
