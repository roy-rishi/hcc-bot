// worker paths
export enum Path {
    INTERACTIONS = "/interactions",
    VERIFY = "/verify",
    EMAIL_BOUNCE = "/email-bounced"
}

// interaction type codes
export enum InteractionType {
    PING = 1,
    MESSAGE_COMPONENT = 3,
    MODAL_SUBMIT = 5,
}

// interaction response type codes
export enum InteractionCallbackType {
    PONG = 1,
    CHANNEL_MESSAGE_WITH_SOURCE = 4,
    MODAL = 9,
}

// component type codes
export enum ComponentType {
    ACTION_ROW = 1,
    BUTTON = 2,
    TEXT_INPUT = 4,
    LABEL = 18,
}

// button style codes
export enum ButtonStyle {
    PRIMARY = 1,
    LINK = 5,
}

// text input field styles
export enum TextInputStyle {
    SHORT = 1,
}

// CORS headers to enable Squarespace site to reach worker
export const CorsHeaders = {
    "Access-Control-Allow-Origin": "https://www.huskycyclinguw.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
};
