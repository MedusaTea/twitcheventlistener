import fs from "fs";
import net from "net";
import dotenv from 'dotenv';
import { spawn } from "child_process"
dotenv.config();

// ─── button alias map ────────────────────────────────────────────────────────
const BUTTON_ALIASES = {
  u: "up", up: "up",
  d: "down", down: "down",
  l: "left", left: "left",
  r: "right", right: "right",
  a: "a",
  b: "b",
  start: "start",
  select: "select",
};

function normalizeButton(raw) {
  return BUTTON_ALIASES[raw.toLowerCase()] ?? null;
}

// ─── twitch ──────────────────────────────────────────────────────────────────
class Twitch {
  constructor() {
    this.TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
    this.USER_ID = process.env.USER_ID;
    this.twitch_credentials = JSON.parse(fs.readFileSync("./twitch_auth.json", "utf8"));
    this.accessToken = this.twitch_credentials.accessToken;
    this.lastValidated = new Date(this.twitch_credentials.validated_at || Date.now() - 3_600_000);
  }

  async refreshToken() {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.twitch_credentials.refreshToken,
      client_id: this.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
    });
    const data = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(r => r.json());

    this.twitch_credentials.accessToken = data.access_token;
    this.twitch_credentials.refreshToken = data.refresh_token;
    this.twitch_credentials.validated_at = new Date();
    fs.writeFileSync("./twitch_auth.json", JSON.stringify(this.twitch_credentials, null, 2));
    this.accessToken = this.twitch_credentials.accessToken;
  }

  async validateTokenAndRefresh() {
    if (this.lastValidated.getTime() + 3_600_000 < Date.now()) {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { "Authorization": `Bearer ${this.accessToken}` },
      });
      this.lastValidated = new Date();
      if (response.status === 401) {
        await this.refreshToken();
      } else if (response.status === 200) {
        const json = await response.json();
        if (json.expires_in < 3600) await this.refreshToken();
      }
    }
  }

  async sendPostRequest(url, body) {
    await this.validateTokenAndRefresh();
    return fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Client-Id": this.TWITCH_CLIENT_ID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  }

  async subscribeToEvent(eventType, session_id, version, condition) {
    const res = await this.sendPostRequest("https://api.twitch.tv/helix/eventsub/subscriptions", {
      type: eventType, version, condition,
      transport: { method: 'websocket', session_id }
    });
    await res.json();
    console.log("Subscribed to", eventType);
  }
}

const twitch = new Twitch();


// ─── chat ─────────────────────────────────────────────────────────────────────
async function handleChatMessage(event) {
  const raw = event.message.text.trim();

  console.log(`${event.chatter_user_login}: "${raw}"`);
  //sendToBizhawk(button);
}
// ─── background script ────────────────────────────────────────────────────────
const RANDO_PATH = "/home/fiehra/Downloads/stream/randomize.sh";
const FRIEREN_PATH = "/home/fiehra/Downloads/stream/frieren.sh";
let scriptRunning = false;

function runBackgroundScript(name) {
  if (scriptRunning) {
    console.log("Script already running, skipping redemption.");
    return;
  }
  let path = RANDO_PATH
  if (name === "frieren") {
    path = FRIEREN_PATH
  }
  //const proc = spawn("bash", [path], { detached: true, stdio: "ignore" });
  //proc.unref();
 // scriptRunning = true;
  //proc.on("close", () => { scriptRunning = false; });
  //proc.on("error", (err) => { console.error(err); scriptRunning = false; });
}

// ─── eventsub websocket ───────────────────────────────────────────────────────
const notificationHandler = {
  "channel.chat.message": async (msg) => {
    try { await handleChatMessage(msg.payload.event); }
    catch (err) { console.error("Error handling chat message:", err); }
  },
  "channel.channel_points_custom_reward_redemption.add": async (msg) => {
    const event = msg.payload.event;
    console.log(`${event.user_login} redeemed: ${event.reward.title}`);
    if (event.reward.title === "new terminal background") {
      runBackgroundScript("rando");
    } else if (event.reward.title === "Sousou no frieren terminal background") {
      runBackgroundScript("frieren");
    }
  }
}

const socketMessageHandler = {
  "session_welcome": async (msg) => {
    const session_id = msg.payload.session.id;
    await twitch.validateTokenAndRefresh();
    await twitch.subscribeToEvent("channel.chat.message", session_id, "1", {
      user_id: twitch.USER_ID,
      broadcaster_user_id: twitch.USER_ID
    });
    await twitch.subscribeToEvent(
      "channel.channel_points_custom_reward_redemption.add",
      session_id, "1",
      { broadcaster_user_id: twitch.USER_ID }
    );
  },
  "session_keepalive": null,
  "notification": async (msg) => {
    const handler = notificationHandler[msg.metadata.subscription_type];
    if (handler) handler(msg);
  }
};

const socket = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log('event data', msg)
  const handler = socketMessageHandler[msg.metadata.message_type];
  if (handler) handler(msg);
};
