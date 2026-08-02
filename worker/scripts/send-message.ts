import process from 'node:process'
import { ComponentType, ButtonStyle } from '../src/constants.ts'

process.loadEnvFile("../.dev.vars");

// send message with button
(async () => {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_ANNOUNCEMENT_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "User-Agent": `DiscordBot (rishiroy.com, 1.0.0)`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Welcome to the Husky Cycling Discord server! This community is open to UW students, staff, and alumni. **TO ACCESS THE DISCUSSION CHANNELS, please verify your identity using one of the following options**:\n- **If you have a current UW NetID**, select *Verify with NetID* and enter your NetID and name in the pop-up. You will receive an email with a link to complete your automatic verification.\n- If you do not have a current NetID, select *Contact Us* to send us an email so we can manually verify you.`,
            "components": [
                {
                    "type": ComponentType.ACTION_ROW,
                    "components": [
                        {
                            "type": ComponentType.BUTTON,
                            "label": "Verify with NetID",
                            "custom_id": "startButton",
                            "style": ButtonStyle.PRIMARY
                        },
                        {
                            "type": ComponentType.BUTTON,
                            "label": "Contact Us",
                            "url": "https://www.huskycyclinguw.com/contact",
                            "style": ButtonStyle.LINK
                        }
                    ]
                }
            ],
        })
    });
    if (!res.ok)
        console.error(await res.text());
})();
export{}
