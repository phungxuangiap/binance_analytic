const {
  deactivatePrediction,
  findOverlappingActivePredictions,
  insertPrediction,
  updatePrediction,
} = require('../db/predictionRepository');

const IMPACT_SCORE_DIFF_THRESHOLD = 50;
const MIN_SHORTENED_HORIZON_SECONDS = 60;

function parseTimeHorizonToSeconds(horizon) {
  const match = horizon.match(/^(\d+)(m|h)$/);

  if (!match) {
    return 15 * 60;
  }

  const value = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(value) || value <= 0) {
    return 15 * 60;
  }

  return unit === 'h' ? value * 3600 : value * 60;
}

function formatTimeHorizon(seconds) {
  const safeSeconds = Math.max(60, Math.floor(seconds));

  if (safeSeconds % 3600 === 0) {
    return `${safeSeconds / 3600}h`;
  }

  return `${Math.ceil(safeSeconds / 60)}m`;
}

function getPredictionStartTime(prediction) {
  return Math.floor(new Date(prediction.predicted_affect_start_time).getTime() / 1000);
}

function getPredictionEndTime(prediction) {
  if (prediction.predicted_affect_end_time) {
    return Math.floor(new Date(prediction.predicted_affect_end_time).getTime() / 1000);
  }

  return getPredictionStartTime(prediction) + parseTimeHorizonToSeconds(prediction.predicted_time_horizon);
}

function withPredictionEndTime(prediction) {
  const endTime = getPredictionEndTime(prediction);

  return {
    ...prediction,
    predicted_affect_end_time: new Date(endTime * 1000).toISOString(),
  };
}

function createDeleteEvent(prediction, reason) {
  return {
    type: 'prediction_deleted',
    news_id: prediction.news_id,
    symbol: prediction.symbol,
    reason,
    prediction: {
      ...prediction,
      status: 'deleted',
      reason,
    },
  };
}

function createEditedPrediction(prediction, edit, reason) {
  return {
    ...prediction,
    status: 'edited',
    edit,
    reason,
  };
}

async function resolvePrediction(rawPrediction) {
  const prediction = withPredictionEndTime(rawPrediction);
  const startTime = getPredictionStartTime(prediction);

  if (!Number.isFinite(startTime)) {
    return [];
  }

  const endTime = getPredictionEndTime(prediction);

  console.log('[prediction:merge] incoming', {
    newsId: prediction.news_id,
    symbol: prediction.symbol,
    direction: prediction.predicted_direction,
    impact: prediction.impact_score,
    startTime: prediction.predicted_affect_start_time,
    horizon: prediction.predicted_time_horizon,
    endTime: new Date(endTime * 1000).toISOString(),
  });

  const overlaps = await findOverlappingActivePredictions({
    symbol: prediction.symbol,
    startTime,
    endTime,
  });

  console.log('[prediction:merge] overlap lookup', {
    newsId: prediction.news_id,
    symbol: prediction.symbol,
    overlapCount: overlaps.length,
  });

  if (overlaps.length === 0) {
    const insertedPrediction = await insertPrediction(prediction, endTime);
    console.log('[prediction:merge] rule no-overlap insert new', {
      newsId: insertedPrediction.news_id,
      symbol: insertedPrediction.symbol,
    });
    return [insertedPrediction];
  }

  const existingPrediction = overlaps[0];

  console.log('[prediction:merge] compare existing', {
    incomingNewsId: prediction.news_id,
    existingNewsId: existingPrediction.news_id,
    incomingDirection: prediction.predicted_direction,
    existingDirection: existingPrediction.predicted_direction,
    incomingImpact: prediction.impact_score,
    existingImpact: existingPrediction.impact_score,
    existingStartTime: existingPrediction.predicted_affect_start_time,
    existingHorizon: existingPrediction.predicted_time_horizon,
  });

  if (existingPrediction.predicted_direction === prediction.predicted_direction) {
    const nextImpactScore = Math.max(existingPrediction.impact_score, prediction.impact_score);
    console.log('[prediction:merge] rule same-direction update existing, drop incoming', {
      existingNewsId: existingPrediction.news_id,
      incomingNewsId: prediction.news_id,
      direction: prediction.predicted_direction,
      previousImpact: existingPrediction.impact_score,
      incomingImpact: prediction.impact_score,
      nextImpact: nextImpactScore,
    });

    const updatedPrediction = await updatePrediction(existingPrediction.news_id, {
      impact_score: nextImpactScore,
    });

    const events = [];
    if (updatedPrediction) {
      events.push(createEditedPrediction(updatedPrediction, {
        field: 'impact_score',
        from: existingPrediction.impact_score,
        to: nextImpactScore,
      }, `same direction overlap: dropped incoming ${prediction.news_id} and kept max impact score`));
    }
    events.push(createDeleteEvent(prediction, `same direction overlap: deleted because existing ${existingPrediction.news_id} kept the shared direction and max impact score`));
    return events;
  }

  if (prediction.impact_score >= existingPrediction.impact_score + IMPACT_SCORE_DIFF_THRESHOLD) {
    const existingStartTime = getPredictionStartTime(existingPrediction);
    const shortenedHorizonSeconds = startTime - existingStartTime;
    const events = [];

    console.log('[prediction:merge] rule opposite incoming-stronger', {
      existingNewsId: existingPrediction.news_id,
      incomingNewsId: prediction.news_id,
      existingImpact: existingPrediction.impact_score,
      incomingImpact: prediction.impact_score,
      shortenedHorizonSeconds,
    });

    if (shortenedHorizonSeconds > MIN_SHORTENED_HORIZON_SECONDS) {
      const nextHorizon = formatTimeHorizon(shortenedHorizonSeconds);
      const updatedExistingPrediction = await updatePrediction(existingPrediction.news_id, {
        predicted_time_horizon: nextHorizon,
        predicted_affect_end_time: prediction.predicted_affect_start_time,
      });

      console.log('[prediction:merge] shortened existing prediction', {
        existingNewsId: existingPrediction.news_id,
        nextHorizon,
        nextEndTime: prediction.predicted_affect_start_time,
      });

      if (updatedExistingPrediction) {
        events.push(createEditedPrediction(updatedExistingPrediction, {
          field: 'predicted_time_horizon',
          from: existingPrediction.predicted_time_horizon,
          to: nextHorizon,
        }, `opposite direction overlap: incoming ${prediction.news_id} is stronger by at least ${IMPACT_SCORE_DIFF_THRESHOLD}, shortened existing prediction before incoming start`));
      }
    } else {
      await deactivatePrediction(existingPrediction.news_id);
      events.push(createDeleteEvent(existingPrediction, `opposite direction overlap: incoming ${prediction.news_id} starts within ${MIN_SHORTENED_HORIZON_SECONDS} seconds of existing prediction, so incoming replaces existing`));
      console.log('[prediction:merge] deleted existing prediction because incoming starts too close to existing', {
        existingNewsId: existingPrediction.news_id,
        incomingNewsId: prediction.news_id,
        shortenedHorizonSeconds,
      });
    }

    const insertedPrediction = await insertPrediction(prediction, endTime);
    events.push(insertedPrediction);
    console.log('[prediction:merge] inserted incoming stronger prediction', {
      incomingNewsId: insertedPrediction.news_id,
      eventCount: events.length,
    });
    return events;
  }

  if (existingPrediction.impact_score >= prediction.impact_score + IMPACT_SCORE_DIFF_THRESHOLD) {
    console.log('[prediction:merge] rule opposite existing-stronger drop incoming', {
      existingNewsId: existingPrediction.news_id,
      incomingNewsId: prediction.news_id,
      existingImpact: existingPrediction.impact_score,
      incomingImpact: prediction.impact_score,
    });
    return [createDeleteEvent(prediction, `opposite direction overlap: deleted because existing ${existingPrediction.news_id} impact is stronger by at least ${IMPACT_SCORE_DIFF_THRESHOLD}`)];
  }

  const existingStartTime = getPredictionStartTime(existingPrediction);
  const shortenedHorizonSeconds = startTime - existingStartTime;

  console.log('[prediction:merge] rule opposite-close-impact shorten existing, drop incoming', {
    existingNewsId: existingPrediction.news_id,
    incomingNewsId: prediction.news_id,
    existingImpact: existingPrediction.impact_score,
    incomingImpact: prediction.impact_score,
    impactDiff: Math.abs(existingPrediction.impact_score - prediction.impact_score),
    shortenedHorizonSeconds,
  });

  if (shortenedHorizonSeconds <= 0) {
    await deactivatePrediction(existingPrediction.news_id);
    console.log('[prediction:merge] deleted existing prediction because incoming starts before existing', {
      existingNewsId: existingPrediction.news_id,
    });
    return [
      createDeleteEvent(existingPrediction, `opposite direction close impact: incoming ${prediction.news_id} starts before existing prediction, so existing duration is invalid`),
      createDeleteEvent(prediction, `opposite direction close impact: deleted because it invalidated existing ${existingPrediction.news_id} duration`),
    ];
  }

  const nextHorizon = formatTimeHorizon(shortenedHorizonSeconds);
  const updatedExistingPrediction = await updatePrediction(existingPrediction.news_id, {
    predicted_time_horizon: nextHorizon,
    predicted_affect_end_time: prediction.predicted_affect_start_time,
  });

  const events = [];
  if (updatedExistingPrediction) {
    events.push(createEditedPrediction(updatedExistingPrediction, {
      field: 'predicted_time_horizon',
      from: existingPrediction.predicted_time_horizon,
      to: nextHorizon,
    }, `opposite direction close impact: shortened existing prediction before incoming ${prediction.news_id} start and dropped incoming`));
  }
  events.push(createDeleteEvent(prediction, `opposite direction close impact: deleted because existing ${existingPrediction.news_id} was shortened instead of keeping incoming`));
  return events;
}

module.exports = {
  getPredictionEndTime,
  parseTimeHorizonToSeconds,
  resolvePrediction,
};
