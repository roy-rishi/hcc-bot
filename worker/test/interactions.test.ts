import { test, expect, vi, describe, beforeEach } from 'vitest'
import { getSubmmissionValues } from '../src/handlers/interactions'
import { InteractionType } from '../src/constants'
import * as schema from '../src/schemas'

describe("getSubmissionValues()", () => {
    const boilerplate = {
        type: InteractionType.MODAL_SUBMIT,
        guild_id: "test",
        token: "test",
        member: {
            user: {
                id: "test",
                global_name: "test"
            }
        },
    }

    test("parses valid submission", () => {
        const input: schema.ModalSubmissionInteraction = {
            ...boilerplate,
            data: {
                components: [{
                    component: {
                        custom_id: "netId",
                        value: "jonasv"
                    }
                }, {
                    component: {
                        custom_id: "name",
                        value: "Jonas Vingegaard"
                    }
                }]
            }
        };
        const expected = {
            netId: "jonasv",
            name: "Jonas Vingegaard",
        };

        expect(getSubmmissionValues(input)).toEqual(expected);
    });

    test("throws error on missing field 'netId'", () => {
        const input: schema.ModalSubmissionInteraction = {
            ...boilerplate,
            data: {
                components: [{
                    component: {
                        custom_id: "name",
                        value: "Jonas Vingegaard"
                    }
                }]
            }
        };

        expect(() => {getSubmmissionValues(input)}).toThrow("Missing modal form value(s)");
    });

    test("throws error on missing field 'name'", () => {
        const input: schema.ModalSubmissionInteraction = {
            ...boilerplate,
            data: {
                components: [{
                    component: {
                        custom_id: "netId",
                        value: "jonasv"
                    }
                }]
            }
        };

        expect(() => {getSubmmissionValues(input)}).toThrow("Missing modal form value(s)");
    });

    test("throws error when no fields are provided", () => {
        const input: schema.ModalSubmissionInteraction = {
            ...boilerplate,
            data: {
                components: []
            }
        };

        expect(() => {getSubmmissionValues(input)}).toThrow("Missing modal form value(s)");
    });

});
