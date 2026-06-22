import 'dotenv/config';

// send message with button
(async () => {
    const res = await fetch(
        `https://discord.com/api/v10/channels/${process.env.DISCORD_CHANNEL_ID}/messages`, {
        method: "POST",
        headers: {
            "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "User-Agent": `DiscordBot (rishiroy.com, 1.0.0)`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Welcome to Husky Cycling – we're glad you're here! This community is open to UW students, staff, alumni, and special guests. **Before we can grant you full access to this server, we need to verify your identity**. Please choose one of the following options:\n- **If you have a current UW NetID, select the button below**, and enter your NetID in the pop-up. You will receive an email with instructions to grant you immediate access to this server.\n- If you do not have a current NetID, please email us so we can manually verify you.`,
            "components": [
                {
                    "type": 1,  // action row
                    "components": [
                        {
                            "type": 2,  // button
                            "custom_id": "startButton",
                            "label": "Verify with UW NetID",
                            "style": 1
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
