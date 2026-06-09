const GROQ_MODEL = 'qwen/qwen3-32b';

function createGroqPrompt(input) {
  return `Analyze this crypto-related news and predict its possible short-term market impact.

Current time:
- now: ${input.currentTime || new Date().toISOString()}

News:
- title: ${input.title}
- source: ${input.source || 'unknown'}
- published_at: ${input.publishedAt || 'unknown'}
- target_symbols: ${(input.targetSymbols || []).join(', ') || 'unknown'}
- description: ${input.description || 'N/A'}
- content: ${input.content || 'N/A'}

Return only JSON with this exact schema:
{
  "is_relevant": true,
  "symbols": ["BTC"],
  "category": "macro | regulation | exchange | etf | hack_security | listing_delisting | partnership | technical_upgrade | token_unlock | whale_activity | market_analysis | other",
  "event_type": "short_snake_case_event_type",
  "sentiment_label": "positive | negative | neutral | mixed",
  "sentiment_score": 0.0,
  "impact_score": 0.0,
  "predicted_direction": "BULLISH | BEARISH | NEUTRAL",
  "predicted_affect_start_time": "ISO-8601 datetime string greater than or equal to now",
  "predicted_time_horizon": "5m | 15m | 1h | 4h | 24h",
  "confidence_score": 0.0,
  "reasoning": "short explanation"
}

Rules:
- sentiment_score must be between -1 and 1.
- impact_score must be between 0 and 1 and represents the expected absolute coin price movement percentage in decimal percent units. Example: impact_score=0.85 means the coin is expected to move about 0.85%, not 85%.
- For ordinary short-term crypto news, prefer realistic values such as 0.05 to 1.0 depending on expected percentage move size.
- confidence_score must be between 0 and 1.
- If the news is not relevant to crypto or market movement, set is_relevant=false, predicted_direction=NEUTRAL, impact_score=0.
- predicted_affect_start_time must be an ISO-8601 datetime string and must be greater than or equal to now.
- Choose predicted_affect_start_time based on the freshness of the news and when its market impact should start. Do not use a fixed formula.
- If published_at is in the future or the event has a future effective time, predicted_affect_start_time should be that future impact time when appropriate.
- If published_at is old, evaluate whether the news is still likely to affect price at now. If its market impact has likely already happened or expired, set predicted_direction=NEUTRAL, impact_score=0, predicted_affect_start_time=now, and explain that the news is stale.
- Only return BULLISH or BEARISH when the news can still plausibly affect future price after predicted_affect_start_time.
- Do not invent facts that are not in the news.`;
}

module.exports = {
  GROQ_MODEL,
  createGroqPrompt,
};
