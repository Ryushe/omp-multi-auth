# omp-multi-auth

Multi-account login for [omp (Oh My Pi)](https://github.com/can1357/oh-my-pi). Add, authenticate, and switch between multiple accounts per provider. OMP handles request retries and configured model fallbacks.

## Install

```bash
omp install git+https://github.com/Ryushe/omp-multi-auth.git
```

Use a recent OMP release with its OpenCode Go model catalog. The Go integration has been checked with OMP 18.13.3.

## Features

- Multiple OAuth accounts per provider
- Switch active account with `/multi-auth switch`
- Cross-provider model presets with `/multi-auth-preset`
- Built-in quota checks with `/multi-auth limits`
- Project affinity through `.omp/multi-auth.json` and `allowedSubs`
- Labels for organizing accounts
- Interactive TUI management

## Commands

### `/multi-auth`

| Command | Description |
|---|---|
| `/multi-auth` | Open account management menu |
| `/multi-auth list` | List configured accounts |
| `/multi-auth add` | Add an account |
| `/multi-auth remove` | Remove an account |
| `/multi-auth login` | Authenticate an account |
| `/multi-auth logout` | Sign out an account |
| `/multi-auth switch` | Switch active account/provider |
| `/multi-auth status` | Show account and authentication status |
| `/multi-auth limits` | Check provider quota and usage |

### `/multi-auth-preset`

| Command | Description |
|---|---|
| `/multi-auth-preset` | Open preset menu |
| `/multi-auth-preset activate` | Activate a preset's best available entry |
| `/multi-auth-preset <name>` | Activate preset by name |
| `/multi-auth-preset create` | Create a preset |
| `/multi-auth-preset list` | List presets |
| `/multi-auth-preset toggle` | Enable or disable a preset |
| `/multi-auth-preset remove` | Delete a preset |

Presets select models across providers. OMP can retry or use a configured fallback after a rate-limit error; the quota display itself does not automatically switch accounts.

## Project-level configuration

Create `.omp/multi-auth.json` in a project to restrict which subscription provider names are available. `allowedSubs` is an exact allow-list; omit it to allow all configured accounts.

```json
{
  "allowedSubs": ["openai-codex-2", "anthropic-2"]
}
```

## Supported providers

### OAuth

| Provider | Service |
|---|---|
| `anthropic` | Anthropic (Claude Pro/Max) |
| `openai-codex` | ChatGPT Plus/Pro (Codex) |
| `github-copilot` | GitHub Copilot |
| `google-gemini-cli` | Google Cloud Code Assist |
| `google-antigravity` | Antigravity |
| `kimi-code` | Kimi Code |
| `xai-oauth` | xAI Grok OAuth |
| `cursor` | Cursor (browser PKCE OAuth or API key) |
### API key

| Provider | Service |
|---|---|
| `openai` | OpenAI (API key) |
| `deepseek` | DeepSeek |
| `mistral` | Mistral |
| `groq` | Groq |
| `xai` | xAI (API key) |
| `google` | Google Gemini (API key) |
| `openrouter` | OpenRouter |
| `together` | Together AI |
| `fireworks` | Fireworks AI |
| `cerebras` | Cerebras |
| `moonshot` | Moonshot (Kimi) |
| `zai` | Z.AI (GLM) |
| `minimax` | MiniMax (Global) |
| `minimax-cn` | MiniMax (China) |
| `opencode-go` | OpenCode Go |
| `cursor` | Cursor (dashboard API key `crsr_...` / `cursor_...` or browser sign-in) |

API-key providers support full multi-account operation. Add an account with `/multi-auth add`, select the provider, then authenticate via `/multi-auth login` (or `/login <name>`) and paste your API key when prompted. Each account stores its own key independently in OMP auth storage.

For `cursor`, `/multi-auth login` prompts for a dashboard API key (`crsr_...`/`cursor_...`). Submit a key to use token exchange, or leave it blank to sign in via browser PKCE OAuth. Both methods refresh automatically.

For OpenCode Go, create a subscription and copy its API key from the [OpenCode Console](https://opencode.ai/console). Use `/multi-auth add`, choose `opencode-go`, and save the key when prompted. Repeat for each independently configured account, then use `/multi-auth switch` to select one. Models use OMP's Go catalog and its native transport for each model.

## Built-in quotas

Run `/multi-auth limits` to inspect quota and usage information for Codex, Google, and OpenCode Go accounts. Results depend on provider availability and authenticated account state.

For Go, the extension queries the provider's usage endpoint with each account's active key and shows the five-hour, weekly, and monthly included-usage windows and their reset times. The status line shows the most constrained window, including a window reported as limited. Go's limits are shared usage meters, and models can consume the allowance at different rates. Free models can remain available after an included Go limit is reached.

If OMP has several Go keys saved under one provider and the selected key is rejected, the usage check tries other enabled saved keys and marks a successful result as an **alternate saved key**. This identifies its usage only; OMP still decides which key handles requests.

The usage endpoint does not indicate whether **Extra Usage** is enabled. When an included limit is reached, requests may still succeed and be charged to your Console balance; check the Console for that setting. A low or exhausted included allowance is a snapshot, not proof that inference is blocked. The extension does not change billing settings or automatically switch accounts based on the snapshot.

To let OMP try another account after a usage-limit error, configure an OMP fallback chain. For example, when starting on `opencode-go-2/glm-5.3-flash`, this entry in `~/.omp/agent/config.yml` offers the same model on account 3:

```yaml
retry:
  fallbackChains:
    opencode-go-2/glm-5.3-flash:
      - opencode-go-3/glm-5.3-flash
```

Merge this with any existing retry settings and replace the model and account names as needed. See [OMP's retry settings](https://github.com/can1357/oh-my-pi/blob/main/docs/settings.md#retry-and-fallback) for more fallback options. If Extra Usage allows the request to succeed, no limit error is raised and this fallback will not run. Keys for the same workspace or member can share an allowance; adding keys alone does not create separate quota.

## Configuration files

| Scope | Path | Contents |
|---|---|---|
| Global | `~/.omp/agent/multi-auth.json` | Subscriptions and presets |
| Project | `.omp/multi-auth.json` | `allowedSubs` allow-list |

## Credits

Originally based on [`pi-multi-pass`](https://github.com/hjanuschka/pi-multi-pass).

## License

MIT
