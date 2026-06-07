const { GROQ_MODEL, createGroqPrompt } = require('../config/ai');

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIME_HORIZON = '15m';

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function extractJsonObject(content) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Groq response did not contain a JSON object');
  }

  return JSON.parse(content.slice(start, end + 1));
}

function mapDirection(direction) {
  if (direction === 'BULLISH') {
    return 'UP';
  }

  if (direction === 'BEARISH') {
    return 'DOWN';
  }

  return 'SIDEWAYS';
}

function normalizeTimeHorizon(horizon) {
  if (['5m', '15m', '1h', '4h', '24h'].includes(horizon)) {
    return horizon;
  }

  return DEFAULT_TIME_HORIZON;
}

function createPredictionInput(news) {
  return {
    title: news.title,
    source: news.source,
    publishedAt: news.time,
    targetSymbols: [news.symbol],
    content: news.content,
  };
}

function logAiPredictionSummary(prefix, prediction) {
  console.log(prefix, {
    isRelevant: prediction.is_relevant,
    symbols: prediction.symbols,
    category: prediction.category,
    eventType: prediction.event_type,
    sentimentLabel: prediction.sentiment_label,
    sentimentScore: prediction.sentiment_score,
    impactScore: prediction.impact_score,
    predictedDirection: prediction.predicted_direction,
    predictedTimeHorizon: prediction.predicted_time_horizon,
    confidenceScore: prediction.confidence_score,
    reasoning: prediction.reasoning,
  });
}

async function requestGroqPrediction(input) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required');
  }

  const startedAt = Date.now();
  console.log('[ai:groq] request start', {
    model: GROQ_MODEL,
    title: input.title,
    source: input.source,
    publishedAt: input.publishedAt,
    targetSymbols: input.targetSymbols,
    hasContent: Boolean(input.content),
  });

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: createGroqPrompt(input),
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    console.error('[ai:groq] request failed', {
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: message,
    });
    throw new Error(`Groq API request failed with ${response.status}: ${message}`);
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;

  console.log('[ai:groq] response received', {
    status: response.status,
    durationMs: Date.now() - startedAt,
    choiceCount: Array.isArray(body.choices) ? body.choices.length : 0,
    contentLength: typeof content === 'string' ? content.length : 0,
    finishReason: body.choices?.[0]?.finish_reason,
  });

  if (typeof content !== 'string' || content.length === 0) {
    throw new Error('Groq API response is missing message content');
  }

  const prediction = extractJsonObject(content);
  logAiPredictionSummary('[ai:groq] parsed prediction', prediction);
  return prediction;
}

async function createPrediction(news) {
  console.log('[prediction:ai] creating prediction', {
    newsId: news.id,
    symbol: news.symbol,
    title: news.title,
    source: news.source,
    time: news.time,
  });

  const newsTime = new Date(news.time).getTime();
  const affectStartTime = new Date(newsTime + 60_000);
  const aiPrediction = await requestGroqPrediction(createPredictionInput(news));
  const predictedDirection = mapDirection(aiPrediction.predicted_direction);
  const impactScore = clamp(Number(aiPrediction.impact_score), 0, 1) * 100;

  const prediction = {
    type: 'prediction',
    news_id: news.id,
    symbol: news.symbol,
    predicted_direction: aiPrediction.is_relevant === false ? 'SIDEWAYS' : predictedDirection,
    predicted_time_horizon: normalizeTimeHorizon(aiPrediction.predicted_time_horizon),
    impact_score: Number(impactScore.toFixed(2)),
    predicted_affect_start_time: affectStartTime.toISOString(),
    ai_prediction: aiPrediction,
  };

  console.log('[prediction:ai] mapped prediction', {
    newsId: prediction.news_id,
    symbol: prediction.symbol,
    aiDirection: aiPrediction.predicted_direction,
    internalDirection: prediction.predicted_direction,
    aiImpactScore: aiPrediction.impact_score,
    internalImpactScore: prediction.impact_score,
    aiTimeHorizon: aiPrediction.predicted_time_horizon,
    internalTimeHorizon: prediction.predicted_time_horizon,
    affectStartTime: prediction.predicted_affect_start_time,
  });

  return prediction;
}

module.exports = {
  createPrediction,
};
