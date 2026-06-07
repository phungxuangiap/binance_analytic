const GROQ_MODEL = 'qwen/qwen3-32b';

function createGroqPrompt(input) {
  return `Analyze this crypto-related news and predict its possible short-term market impact.

News:
- title: ${input.title}
- source: ${input.source || 'unknown'}
- published_at: ${input.publishedAt || 'unknown'}
- target_symbols: ${(input.targetSymbols || []).join(', ') || 'unknown'}
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
  "predicted_time_horizon": "5m | 15m | 1h | 4h | 24h",
  "confidence_score": 0.0,
  "reasoning": "short explanation"
}

Rules:
- sentiment_score must be between -1 and 1.
- impact_score must be between 0 and 1.
- confidence_score must be between 0 and 1.
- If the news is not relevant to crypto or market movement, set is_relevant=false, predicted_direction=NEUTRAL, impact_score=0.
- Do not invent facts that are not in the news.`;
}

module.exports = {
  GROQ_MODEL,
  createGroqPrompt,
};
