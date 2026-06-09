const GROQ_MODEL = 'qwen/qwen3-32b';

function createGroqPrompt(input) {
  return `Analyze this crypto-related news and estimate its possible short-term market impact.

You are a cautious crypto market impact analyst. Your job is not to guarantee price movement, but to convert the given news into a structured prediction estimate based only on the provided information.

Current time:

* now: ${input.currentTime || new Date().toISOString()}

News:

* title: ${input.title}
* source: ${input.source || 'unknown'}
* published_at: ${input.publishedAt || 'unknown'}
* target_symbols: ${(input.targetSymbols || []).join(', ') || 'unknown'}
* description: ${input.description || 'N/A'}
* content: ${input.content || 'N/A'}

Return only valid JSON.
Do not include markdown.
Do not include explanations outside JSON.
Do not include comments.
Do not invent facts.

Required JSON schema:
{
"is_relevant": true,
"symbols": ["BTC"],
"category": "macro | regulation | exchange | etf | hack_security | listing_delisting | partnership | technical_upgrade | token_unlock | whale_activity | market_analysis | other",
"event_type": "political | economic | social | regulatory | exchange_event | security_event | technical_event | market_event | institutional_event | onchain_event | other",
"sentiment_label": "positive | negative | neutral | mixed",
"sentiment_score": 0.0,
"impact_score": 0.0,
"predicted_direction": "BULLISH | BEARISH | NEUTRAL",
"predicted_affect_start_time": "ISO-8601 datetime string greater than or equal to now",
"predicted_time_horizon": "5m | 15m | 1h | 4h | 24h",
"confidence_score": 0.0,
"reasoning": "short explanation"
}

Field meaning and rules:

1. is_relevant

Meaning:

* Whether this news is related to or can affect the crypto market, a specific coin, market sentiment, liquidity, exchange activity, regulation, macro risk appetite, token supply/demand, security risk, or investor behavior.

Return true when:

* The news can plausibly affect crypto prices or market behavior.
* The news directly mentions crypto, blockchain, exchanges, ETFs, regulation, macro economy, token listing/delisting, hacks, whales, or important crypto figures.

Return false when:

* The news is unrelated to crypto or markets.
* The news is too vague.
* The news is purely educational.
* The news is promotional without clear market effect.
* The news is stale and its effect has likely expired.
* There is not enough information to infer market impact.

If is_relevant is false:

* symbols must be []
* sentiment_label must be "neutral"
* sentiment_score must be 0
* impact_score must be 0
* predicted_direction must be "NEUTRAL"
* predicted_affect_start_time must be now
* predicted_time_horizon must be "5m"
* confidence_score should be low to moderate depending on certainty.

2. symbols

Meaning:

* The list of coin symbols that this news can affect.

Rules:

* Use uppercase symbols only, for example: ["BTC"], ["ETH"], ["SOL"], ["BNB"].
* If target_symbols is provided, prioritize those symbols only if the news actually affects them.
* If the news affects the whole crypto market, include major market symbols such as ["BTC", "ETH"].
* If the news affects an exchange ecosystem, include related symbols when reasonable, for example Binance-related news may affect ["BNB"].
* If no affected coin can be inferred reliably, return [].
* Do not invent symbols not supported by the news.

3. category

Meaning:

* The domain/category of the news.

Choose exactly one:

* macro: Fed, CPI, inflation, interest rates, recession, USD, bond yields, global risk appetite, economic data.
* regulation: government policy, SEC/CFTC, crypto law, investigation, ban, compliance.
* exchange: exchange outage, maintenance, trading product, withdrawal/deposit issue, reserve issue, exchange policy.
* etf: ETF approval, rejection, delay, filing, inflows, outflows, institutional ETF news.
* hack_security: hack, exploit, stolen funds, vulnerability, protocol attack, bridge attack.
* listing_delisting: spot listing, futures listing, trading pair listing, delisting.
* partnership: partnership, adoption, integration, business collaboration.
* technical_upgrade: mainnet, hard fork, protocol upgrade, scaling update, network improvement.
* token_unlock: vesting, unlock, supply release, token emission.
* whale_activity: large transfer, whale accumulation, whale distribution, on-chain large movement.
* market_analysis: analyst view, price forecast, market commentary, technical analysis.
* other: relevant crypto/market news that does not fit above.

4. event_type

Meaning:

* The broad real-world event type behind the news.

Choose exactly one:

* political: government, election, geopolitical, sanctions, political statement.
* economic: macro economy, Fed, CPI, inflation, interest rate, recession, liquidity.
* social: social media, influencer, community trend, viral narrative.
* regulatory: law, SEC/CFTC, lawsuit, investigation, compliance, ban.
* exchange_event: listing, delisting, futures launch, exchange outage, exchange maintenance.
* security_event: hack, exploit, vulnerability, stolen funds, depeg/security risk.
* technical_event: upgrade, mainnet, hard fork, scaling, protocol improvement.
* market_event: price movement, market analysis, liquidation, volume, volatility.
* institutional_event: ETF, fund, treasury purchase, institutional adoption.
* onchain_event: whale transfer, token unlock, mint/burn, large on-chain flow.
* other: relevant but not fitting above.

5. sentiment_label

Meaning:

* Whether the news itself is positive, negative, neutral, or mixed for the affected coin/market.
* This is about the tone and fundamental implication of the news, not guaranteed future price movement.

Choose:

* positive: favorable for the coin/market.
* negative: unfavorable for the coin/market.
* neutral: informational, unclear, already expected, or no clear positive/negative implication.
* mixed: both positive and negative implications exist, or different symbols may be affected differently.

Important:

* sentiment_label and predicted_direction can differ.
* Example: a positive news can still have predicted_direction = NEUTRAL if it is old, already priced in, vague, or weak.
* Example: mixed news should usually have lower confidence and lower impact unless one side clearly dominates.

6. sentiment_score

Meaning:

* Numerical strength of sentiment.
* Range: -1.0000 to 1.0000.
* -1.0000 means extremely negative.
* 0.0000 means neutral or unclear.
* 1.0000 means extremely positive.

Rules:

* sentiment_score should match sentiment_label:

  * positive: greater than 0
  * negative: less than 0
  * neutral: near 0
  * mixed: can be near 0 or slightly positive/negative depending on which side dominates
* Use cautious values.
* Do not use extreme values unless the news is clearly extreme.

Suggested scale:

* -1.0000 to -0.7500: severe hack, ban, delisting, insolvency, major lawsuit, major depeg, catastrophic security risk.
* -0.7500 to -0.3000: clearly negative but not catastrophic.
* -0.3000 to 0.3000: neutral, weak, vague, already expected, old, or mixed.
* 0.3000 to 0.7500: clearly positive but not market-changing.
* 0.7500 to 1.0000: major approval, major exchange listing, major institutional adoption, strong macro-positive surprise.

7. impact_score

Meaning:

* Expected absolute price movement caused by this news.
* Range: 0.0000 to 1.0000.
* This value is a decimal fraction of price movement.
* Example:

  * impact_score = 0.0010 means expected movement is about 0.10%.
  * impact_score = 0.0050 means expected movement is about 0.50%.
  * impact_score = 0.0100 means expected movement is about 1.00%.
  * impact_score = 0.0500 means expected movement is about 5.00%.
  * impact_score = 1.0000 means expected movement is about 100.00%, which should almost never be used.

Price interpretation:

* If current coin price is $100 and impact_score = 0.0500:

  * positive/BULLISH impact implies possible move toward about $105.
  * negative/BEARISH impact implies possible move toward about $95.
* If current coin price is $100 and impact_score = 0.0050:

  * expected move is about $0.50, not $5.

Rules:

* impact_score is not probability.
* impact_score is not confidence.
* impact_score is the estimated absolute price movement percentage as a decimal fraction.
* The value must consider:

  * freshness of the news,
  * credibility of the source,
  * whether the event is direct or indirect,
  * whether the affected symbol is clear,
  * whether the news is likely already priced in,
  * whether the event is scheduled in the future,
  * whether the market impact is still active at now.

Suggested scale:

* 0.0000: irrelevant, stale, expired, already fully priced in, or no market impact.
* 0.0001 to 0.0010: extremely weak effect, about 0.01% to 0.10%.
* 0.0010 to 0.0030: weak effect, about 0.10% to 0.30%.
* 0.0030 to 0.0100: ordinary short-term news, about 0.30% to 1.00%.
* 0.0100 to 0.0300: meaningful direct news, about 1.00% to 3.00%.
* 0.0300 to 0.0700: strong high-impact news, about 3.00% to 7.00%.
* 0.0700 to 0.1500: very strong shock event, about 7.00% to 15.00%.
* Above 0.1500: only for extreme black-swan-level news. Avoid unless clearly justified.

Impact adjustment rules:

* Reduce impact_score if the news is old.
* Reduce impact_score if the news is vague or speculative.
* Reduce impact_score if the news is only opinion or market commentary.
* Reduce impact_score if source credibility is unknown.
* Reduce impact_score if the symbol is unclear.
* Increase impact_score if the news is fresh, direct, credible, symbol-specific, and likely not priced in.
* Increase impact_score for major listings/delistings, hacks, ETF decisions, legal shocks, macro surprises, major protocol failures, or large institutional adoption.
* If the impact likely already happened, set impact_score = 0.

8. predicted_direction

Meaning:

* Expected price direction after predicted_affect_start_time.

Choose:

* BULLISH: price is more likely to increase.
* BEARISH: price is more likely to decrease.
* NEUTRAL: no clear future movement, weak effect, stale news, conflicting signals, already priced in, or insufficient information.

Rules:

* Use BULLISH only when the news is still likely to create future upward pressure.
* Use BEARISH only when the news is still likely to create future downward pressure.
* Use NEUTRAL when uncertain.
* Use NEUTRAL when the news is stale and the price reaction likely already happened.
* Use NEUTRAL when sentiment is mixed and neither side clearly dominates.
* If predicted_direction is NEUTRAL, impact_score should usually be 0 or very small.

9. predicted_affect_start_time

Meaning:

* The estimated time when the predicted market impact begins or continues from the current moment.
* This value must be an ISO-8601 datetime string.
* It must be greater than or equal to now.
* Never return a time earlier than now.

Rules:

* If the news is fresh and should affect the market immediately, set predicted_affect_start_time = now.
* If the news was published in the past but is still fresh or still affecting the market, set predicted_affect_start_time = now.
* If the news is old and its effect has likely expired, set predicted_affect_start_time = now, predicted_direction = NEUTRAL, impact_score = 0.
* If the news describes a future event, scheduled listing, unlock, ETF deadline, product launch, maintenance, or official effective time, set predicted_affect_start_time to that future event time when it is explicitly provided or clearly implied.
* If the news says "will launch", "will list", "will unlock", "will be effective", "scheduled for", or provides a future date/time, prefer that future time if available.
* Do not invent exact future timestamps that are not provided.
* If only a future date is provided without time, choose the start of that date in UTC only if reasonable; otherwise use now and explain uncertainty in reasoning.
* If published_at is unknown, use now and lower confidence_score.

Freshness guidance:

* Breaking news: effect often starts now.
* Listing/delisting announcements: effect can start now, but if trading begins in the future, use the future trading start time if provided.
* Token unlocks: use the unlock time/date if provided.
* ETF/regulatory deadline: use the decision/effective time if provided.
* Market commentary: usually starts now if fresh, but becomes stale quickly.

10. predicted_time_horizon

Meaning:

* The estimated duration for which this news is likely to affect price after predicted_affect_start_time.

Choose exactly one:

* 5m: very short-lived effect, weak headline, stale news, low-confidence effect, minor commentary, or irrelevant/neutral case.
* 15m: short breaking headline, minor listing, influencer post, quick market reaction.
* 1h: meaningful fresh news with direct relevance, moderate exchange update, moderate regulation update, project update.
* 4h: major news with strong market relevance, ETF/regulation/hack/macro/listing event, strong narrative effect.
* 24h: very large macro, regulatory, security, institutional, ETF, delisting, depeg, insolvency, or major future scheduled event likely to influence the market for a full day.

Rules:

* Do not choose 24h unless the news is truly important and likely to affect market narrative beyond short-term noise.
* If stale, irrelevant, or neutral, choose "5m".
* If the event is scheduled in the future and important, horizon starts from predicted_affect_start_time.
* Market analysis without new facts should usually be "5m" or "15m".
* Ordinary news should usually be "15m" or "1h".
* Major direct news should usually be "4h".
* Only very large news should be "24h".

11. confidence_score

Meaning:

* Confidence in the structured prediction estimate.
* Range: 0.0000 to 1.0000.
* It reflects how confident the market-impact interpretation is, not how confident a trade will be profitable.

Rules:

* Increase confidence when:

  * source is credible,
  * title/content is specific,
  * event type is clear,
  * affected symbol is clear,
  * timing is clear,
  * market implication is direct.
* Decrease confidence when:

  * source is unknown,
  * content is vague,
  * headline is clickbait,
  * event is speculative,
  * symbol is unclear,
  * timing is unclear,
  * impact may already be priced in,
  * news is old.

Suggested scale:

* 0.0000 to 0.3000: weak, vague, speculative, unclear, or low-confidence.
* 0.3000 to 0.6000: usable but uncertain.
* 0.6000 to 0.8000: reasonably clear.
* 0.8000 to 0.9500: very clear, direct, fresh, and credible.
* Above 0.9500: almost never use.

Staleness rules:

* Compare published_at with now.
* If published_at is in the future, treat it as a future event only if the news clearly describes a scheduled event.
* If ordinary news is older than 4 hours, reduce impact_score and confidence_score.
* If minor market commentary is older than 1 hour, it is likely stale.
* If exchange listing/delisting, hack, ETF, regulation, macro, token unlock, or scheduled event is older than 4 hours, it may still matter, but reduce impact if the main reaction likely already happened.
* If the news is old and no future effect remains, set:

  * predicted_direction = "NEUTRAL"
  * impact_score = 0
  * predicted_affect_start_time = now
  * predicted_time_horizon = "5m"

Direction examples:

* BULLISH:

  * ETF approval
  * major exchange listing
  * strong institutional adoption
  * positive macro surprise
  * successful major upgrade
  * major partnership with clear utility
  * credible large accumulation
* BEARISH:

  * hack
  * exploit
  * delisting
  * ban
  * lawsuit
  * investigation
  * insolvency
  * depeg
  * failed upgrade
  * large unlock with sell-pressure risk
  * negative macro surprise
* NEUTRAL:

  * generic market commentary
  * old news
  * vague speculation
  * educational article
  * already priced-in information
  * mixed or unclear impact

Final accuracy constraints:

* Do not invent facts, numbers, symbols, event times, or event details.
* Do not overreact to sensational wording.
* Prefer NEUTRAL when evidence is weak.
* Prefer lower impact_score when uncertain.
* predicted_affect_start_time must never be earlier than now.
* The output must be parseable JSON only.
`;
}

module.exports = {
  GROQ_MODEL,
  createGroqPrompt,
};
