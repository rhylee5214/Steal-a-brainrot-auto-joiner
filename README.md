# Steal a Brainrot Auto-Joiner

Auto-joiner script and Discord notifier server for Roblox game "Steal a Brainrot" (PlaceId: 109983668079237).

## Features

### Roblox Auto-Joiner Script
- **Server Scanner**: Automatically scans public servers for the target game (PlaceId 109983668079237)
- **Auto-Join**: Joins servers with high-value Brainrots
- **ESP Highlighting**: Highlights the highest-value Brainrot on the server
- **Auto-Grab**: Automatically teleports to and grabs high-value Brainrots
- **Safe Anti-Hit (Auto-Dodge)**: Evades incoming attacks without modifying hitboxes
- **Discord Integration**: Sends notifications to Discord webhook when high-value targets are found

### Node.js Notifier Server
- **Discord Webhooks**: Sends formatted embeds to Discord with server join links
- **Rate Limiting**: 30 requests per IP per 15 seconds
- **Deduplication**: Prevents duplicate notifications within 60 seconds
- **Authentication**: Optional token-based security
- **Health Monitoring**: `/health` and `/status` endpoints for monitoring
- **Debug Logs**: `/debug/last` shows recent payload summaries

## Deployment to Render

### Prerequisites
- [Render account](https://render.com/)
- Discord webhook URLs (one for low-value, one for high-value alerts)

### Steps

1. **Fork/Clone this repository**

2. **Create a new Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure the service**
   - **Name**: `steal-brainrot-notifier` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

4. **Set Environment Variables**
   
   Add these environment variables in the Render dashboard:
   
   | Key | Value | Required |
   |-----|-------|----------|
   | `WEBHOOK_LOW` | Your Discord webhook URL for low-value alerts (1-10M) | ✅ Yes |
   | `WEBHOOK_HIGH` | Your Discord webhook URL for high-value alerts (>10M) | ✅ Yes |
   | `SECRET_TOKEN` | Optional authentication token | ❌ No |
   | `PORT` | Auto-set by Render | ❌ No |

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note your service URL: `https://your-service-name.onrender.com`

## Testing the Server

### Test Health Endpoint
```bash
curl https://your-service-name.onrender.com/health
```

Expected response:
```json
{"ok":true,"status":"healthy"}
```

### Test Status Endpoint
```bash
curl https://your-service-name.onrender.com/status
```

Expected response:
```json
{
  "ok": true,
  "webhooksConfigured": true,
  "authEnabled": false,
  "uptime": 123.456,
  "timestamp": "2026-01-08T12:00:00.000Z"
}
```

### Test Data Endpoint (without auth)
```bash
curl -X POST https://your-service-name.onrender.com/data \
  -H "Content-Type: application/json" \
  -d '{
    "placeId": 109983668079237,
    "jobId": "test-job-id-123",
    "brainrots": [
      {"name": "TestPlayer", "value": 5000000}
    ]
  }'
```

### Test Data Endpoint (with auth)
```bash
curl -X POST https://your-service-name.onrender.com/data \
  -H "Content-Type: application/json" \
  -H "x-notifier-token: your_secret_token_here" \
  -d '{
    "placeId": 109983668079237,
    "jobId": "test-job-id-123",
    "brainrots": [
      {"name": "TestPlayer", "value": 5000000}
    ]
  }'
```

## Using the Roblox Script

### Configuration in Auto-joiner

Update the Notifier config in the Auto-joiner script:

```lua
Config.Notifier = {
    Url = "https://your-service-name.onrender.com/data",
    Secret = "your_secret_token_here" -- Optional, omit if not using auth
}
```

### Roblox RequestAsync Example

The script uses `HttpService:RequestAsync` to send notifications:

```lua
local HttpService = game:GetService("HttpService")

local payload = {
    placeId = 109983668079237,
    jobId = game.JobId,
    brainrots = {
        {name = "HighValuePlayer", value = 15000000}
    }
}

local headers = {
    ["Content-Type"] = "application/json"
}

-- Add secret header if configured
if Config.Notifier.Secret then
    headers["x-notifier-token"] = Config.Notifier.Secret
end

local success, response = pcall(function()
    return HttpService:RequestAsync({
        Url = Config.Notifier.Url,
        Method = "POST",
        Headers = headers,
        Body = HttpService:JSONEncode(payload)
    })
end)
```

## Important Notes

### Server Listing Limitations
- The Roblox API **does not provide income/economy data** from game servers
- The servers list is **locked to PlaceId 109983668079237** (Steal a Brainrot)
- Income values shown as **"N/A/s"** in the UI since they cannot be fetched from the API
- Server scanning fetches real server data (players, jobId, ping) but cannot determine income without joining

### Anti-Hit Feature
- Uses **safe evasive movement** without modifying hitboxes
- Detects nearby players with tools facing the character
- Performs short lateral dodge steps on Heartbeat
- **No replication tampering** or server-side exploits

### Rate Limiting
- The notifier server implements rate limiting to prevent abuse
- Max 30 requests per IP per 15-second window
- Duplicate notifications are blocked for 60 seconds per jobId

### Payload Limits
- Brainrot arrays are automatically truncated to 25 entries
- Only the top-value brainrot per tier is sent to Discord

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/status` | GET | Server status and configuration |
| `/data` | POST | Receive brainrot data from Roblox |
| `/notifications/high` | GET | Get last high-value notification |
| `/notifications/low` | GET | Get last low-value notification |
| `/debug/last` | GET | Get last 50 payload summaries |

## Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file based on `.env.example`
4. Run development server:
   ```bash
   npm run dev
   ```

## Troubleshooting

### Server Returns 401 Unauthorized
- Check that `x-notifier-token` header matches `SECRET_TOKEN` env var
- If not using auth, remove `SECRET_TOKEN` from environment variables

### Server Returns 429 Rate Limit Exceeded
- Wait 15 seconds before retrying
- Check that you're not sending duplicate requests

### Discord Messages Not Appearing
- Verify webhook URLs are correct and active
- Check `/debug/last` endpoint to see if requests are being received
- Ensure brainrot values are >= 1,000,000 (1M)

### Server Shows "webhooksConfigured: false"
- Missing `WEBHOOK_LOW` or `WEBHOOK_HIGH` environment variables
- Server will exit immediately on startup if these are missing

## License

This project is for educational purposes. Use responsibly and in accordance with Roblox Terms of Service.
