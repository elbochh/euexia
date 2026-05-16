# Euexia Writeup

## Summary

Euexia is a mobile-first post-consultation support system that turns medical follow-up into a gamified daily journey. Instead of leaving patients with static discharge papers and low motivation to continue, Euexia transforms care plans into day-based checkpoints, actionable tasks, and progress rewards.

The current system uses Gemma 4 on Google Vertex AI for clinical summarization, multimodal document interpretation, checklist event structuring, map-spec generation, and contextual chat. The output is persisted in MongoDB and reused in a RAG-powered "Dr. Gemma" chat assistant for follow-up support.

## Approach

Users can provide consultation information as text, image, or PDF inputs. The backend extracts clinical details, merges them into a care-plan paragraph, generates scheduled checklist events, stores those events, and maps them into game checkpoints.

The gamified layer supports:

- Map progression through day-based care checkpoints
- Coins and rewards for completed tasks
- Character customization
- Leaderboard-based social motivation
- Contextual follow-up chat grounded in the user’s saved care plan

## Model Use

- **Gemma 4 on Vertex AI:** text summarization, image/document interpretation, checklist event generation, map-spec generation, and RAG chat responses
- **Rule-based validators:** medication completeness checks, checklist normalization, deduplication, and fallback tasks when model output is malformed
- **MongoDB:** consultation storage, checklist storage, user progress, and contextual retrieval data

## Deployment Direction

The project is being moved to Google Cloud for both app deployment and model access. Gemma 4 is accessed through Vertex AI Model-as-a-Service, so the app does not need to provision or manage GPU inference servers.

## Current Limitation

Voice transcription is disabled in production mode after removing non-Google inference paths. To restore voice uploads, add Google Speech-to-Text and pass the transcript into the existing Gemma 4 summarization flow.

## Conclusion

Euexia demonstrates a practical architecture for post-consultation continuity: multimodal consultation ingestion, care-plan structuring, and behavior-oriented delivery through gamification. The system focuses on turning clinical instructions into recurring, understandable, and motivating daily actions.
